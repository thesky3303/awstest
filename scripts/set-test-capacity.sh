#!/usr/bin/env bash
set -eu
set -o pipefail 2>/dev/null || true

# 인자만 반영한다. 중간 저장·restore·annotation 기억 없음 — 같은 명령을 다시 실행해도 항상 그 입력 그대로 패치.
#
#   bash scripts/set-test-capacity.sh -n 25 -wr 35 -r 3 -wk 60
#
# 적용 값:
#   - 노드 그룹: minSize = desiredSize = -n,  maxSize = max(-n + 5, AWS에 현재 설정된 maxSize)  (5는 NODE_MAX_DELTA)
#   - write HPA(burst): 총 -wr 를 primary/secondary 로 80:20 분할해 각 HPA min/max 반영
#   - read HPA(burst): minReplicas = -r, maxReplicas = min + 20
#   - worker KEDA: 총 -wk 를 primary/secondary 로 80:20 분할해 각 ScaledObject min/max 반영 + paused 해제
#
# 버퍼 오버라이드: SET_TEST_CAP_POD_MAX_DELTA (기본 20), SET_TEST_CAP_NODE_MAX_DELTA (기본 5)

NS="${KUBECTL_NAMESPACE:-ticketing}"

POD_MAX_DELTA="${SET_TEST_CAP_POD_MAX_DELTA:-20}"
NODE_MAX_DELTA="${SET_TEST_CAP_NODE_MAX_DELTA:-5}"
# min 모드에서 노드 maxSize까지 강제로 desired로 고정하고 싶을 때 사용.
# (기본 동작은 기존 AWS maxSize(pmax)가 더 크면 줄이지 않음)
FORCE_NODE_MAX="${SET_TEST_CAP_FORCE_NODE_MAX:-0}"

# 예전 스크립트가 남긴 annotation 제거(혼동 방지). 더 이상 읽지 않음.
ANN_PREFIX="ticketing.soldesk/test-capacity"

_die() { echo "ERROR: $*" >&2; exit 1; }

_need() {
  command -v "$1" >/dev/null 2>&1 || _die "missing command: $1"
}

_tf_dir() {
  cd "$(dirname "${BASH_SOURCE[0]:-$0}")/../terraform" && pwd
}

_tf_out() {
  terraform -chdir="$(_tf_dir)" output -raw "$1" 2>/dev/null || true
}

_strip_legacy_annotations() {
  local keys=(
    "${ANN_PREFIX}.prev-min"
    "${ANN_PREFIX}.prev-max"
    "${ANN_PREFIX}.prev-paused"
    "${ANN_PREFIX}.prev-node-min"
    "${ANN_PREFIX}.prev-node-desired"
    "${ANN_PREFIX}.prev-node-max"
    "${ANN_PREFIX}.ts"
  )
  local k
  for k in "${keys[@]}"; do
    kubectl -n "$NS" annotate hpa/write-api-burst-primary-hpa "${k}-" --overwrite >/dev/null 2>&1 || true
    kubectl -n "$NS" annotate hpa/write-api-burst-secondary-hpa "${k}-" --overwrite >/dev/null 2>&1 || true
    kubectl -n "$NS" annotate hpa/read-api-hpa "${k}-" --overwrite >/dev/null 2>&1 || true
    kubectl -n "$NS" annotate scaledobject/worker-svc-sqs-primary "${k}-" --overwrite >/dev/null 2>&1 || true
    kubectl -n "$NS" annotate scaledobject/worker-svc-sqs-secondary "${k}-" --overwrite >/dev/null 2>&1 || true
  done
}

_set_hpa() {
  local name="$1" rep="$2" obj="hpa/$1"
  # read-api burst HPA는 minReplicas=1 기반이라, rep<=0(최소 유지)에서는 HPA를 삭제해
  # "다시 1로 되살아나며 burst를 띄우는" 동작을 막는다.
  # burst Deployment는 0으로 내려 Pending → 노드 증가 트리거를 제거한다.
  if (( rep <= 0 )); then
    case "$name" in
      read-api-hpa)  kubectl -n "$NS" scale deploy/read-api-burst  --replicas=0 >/dev/null 2>&1 || true ;;
    esac
    kubectl -n "$NS" delete "$obj" --ignore-not-found >/dev/null 2>&1 || true
    return 0
  fi

  local new_max=$((rep + POD_MAX_DELTA))
  if (( new_max < rep )); then new_max="$rep"; fi
  kubectl -n "$NS" patch "$obj" --type merge -p "{\"spec\":{\"minReplicas\":${rep},\"maxReplicas\":${new_max}}}" >/dev/null
}

_set_hpa_write_split() {
  # write burst 는 primary/secondary 로 분리되어 있으므로, 총 rep 를 80:20 으로 나눠 각 HPA에 반영한다.
  local rep="$1"
  if (( rep <= 0 )); then
    kubectl -n "$NS" scale deploy/write-api-burst-primary --replicas=0 >/dev/null 2>&1 || true
    kubectl -n "$NS" scale deploy/write-api-burst-secondary --replicas=0 >/dev/null 2>&1 || true
    kubectl -n "$NS" delete hpa/write-api-burst-primary-hpa --ignore-not-found >/dev/null 2>&1 || true
    kubectl -n "$NS" delete hpa/write-api-burst-secondary-hpa --ignore-not-found >/dev/null 2>&1 || true
    return 0
  fi

  local pri=$(( (rep * 8 + 9) / 10 )) # ceil(rep*0.8)
  local sec=$(( rep - pri ))
  if (( sec < 0 )); then sec=0; fi

  local max_pri=$((pri + POD_MAX_DELTA))
  local max_sec=$((sec + POD_MAX_DELTA))
  if (( max_pri < pri )); then max_pri="$pri"; fi
  if (( max_sec < sec )); then max_sec="$sec"; fi

  kubectl -n "$NS" patch hpa/write-api-burst-primary-hpa --type merge -p "{\"spec\":{\"minReplicas\":${pri},\"maxReplicas\":${max_pri}}}" >/dev/null
  kubectl -n "$NS" patch hpa/write-api-burst-secondary-hpa --type merge -p "{\"spec\":{\"minReplicas\":${sec},\"maxReplicas\":${max_sec}}}" >/dev/null
}

_set_keda() {
  local rep="$1"
  if (( rep <= 0 )); then
    # rep=0은 "클러스터 최소 유지" 모드에서 사용됨:
    # - 큐에 메시지가 남아있으면 KEDA가 즉시 scale-out 하며 Pending → 노드 증가로 이어질 수 있다.
    # - 따라서 rep=0일 때는 paused를 유지/설정해서 burst가 자동으로 다시 올라오지 않게 한다.
    kubectl -n "$NS" scale deploy/worker-svc-burst-primary --replicas=0 >/dev/null 2>&1 || true
    kubectl -n "$NS" scale deploy/worker-svc-burst-secondary --replicas=0 >/dev/null 2>&1 || true
    # maxReplicaCount=0 는 KEDA/CRD에서 거절될 수 있어, min만 0으로 두고 max는 매니페스트 값을 유지한다.
    kubectl -n "$NS" patch scaledobject/worker-svc-sqs-primary --type merge -p "{\"spec\":{\"minReplicaCount\":0}}" >/dev/null 2>&1 || true
    kubectl -n "$NS" patch scaledobject/worker-svc-sqs-secondary --type merge -p "{\"spec\":{\"minReplicaCount\":0}}" >/dev/null 2>&1 || true
    kubectl -n "$NS" annotate scaledobject/worker-svc-sqs-primary autoscaling.keda.sh/paused="true" --overwrite >/dev/null 2>&1 || true
    kubectl -n "$NS" annotate scaledobject/worker-svc-sqs-secondary autoscaling.keda.sh/paused="true" --overwrite >/dev/null 2>&1 || true
    return 0
  fi

  local pri=$(( (rep * 8 + 9) / 10 )) # ceil(rep*0.8)
  local sec=$(( rep - pri ))
  if (( sec < 0 )); then sec=0; fi

  local max_pri=$((pri + POD_MAX_DELTA))
  local max_sec=$((sec + POD_MAX_DELTA))
  if (( max_pri < pri )); then max_pri="$pri"; fi
  if (( max_sec < sec )); then max_sec="$sec"; fi

  kubectl -n "$NS" patch scaledobject/worker-svc-sqs-primary --type merge -p "{\"spec\":{\"minReplicaCount\":${pri},\"maxReplicaCount\":${max_pri}}}" >/dev/null
  kubectl -n "$NS" patch scaledobject/worker-svc-sqs-secondary --type merge -p "{\"spec\":{\"minReplicaCount\":${sec},\"maxReplicaCount\":${max_sec}}}" >/dev/null
  kubectl -n "$NS" annotate scaledobject/worker-svc-sqs-primary autoscaling.keda.sh/paused- >/dev/null 2>&1 || true
  kubectl -n "$NS" annotate scaledobject/worker-svc-sqs-secondary autoscaling.keda.sh/paused- >/dev/null 2>&1 || true
}

_set_nodegroup() {
  local desired="$1"
  local region cluster ng j pmax new_max cand
  region="$(_tf_out aws_region)"
  cluster="$(_tf_out eks_cluster_name)"
  ng="$(_tf_out eks_app_node_group_name)"
  [[ -n "$region" && -n "$cluster" && -n "$ng" ]] || _die "terraform outputs missing (aws_region/eks_cluster_name/eks_app_node_group_name)"

  j="$(aws eks describe-nodegroup --region "$region" --cluster-name "$cluster" --nodegroup-name "$ng" 2>/dev/null || true)"
  [[ -n "$j" ]] || _die "aws eks describe-nodegroup failed (check AWS creds / cluster / nodegroup name)"

  pmax="$(printf "%s" "$j" | python -c 'import json,sys; j=json.load(sys.stdin); sc=j.get("nodegroup",{}).get("scalingConfig",{}) or {}; print(sc.get("maxSize",""))' 2>/dev/null || true)"

  if [[ "${FORCE_NODE_MAX:-0}" = "1" ]]; then
    new_max="$desired"
  else
    cand=$((desired + NODE_MAX_DELTA))
    new_max="$cand"
    if [[ -n "${pmax:-}" && "$pmax" =~ ^[0-9]+$ ]] && (( pmax > new_max )); then
      new_max="$pmax"
    fi
    if (( new_max < desired )); then new_max="$desired"; fi
  fi

  aws eks update-nodegroup-config \
    --region "$region" \
    --cluster-name "$cluster" \
    --nodegroup-name "$ng" \
    --scaling-config "minSize=${desired},desiredSize=${desired},maxSize=${new_max}" \
    >/dev/null

  # burst nodegroups (optional outputs): 80/20 로 desired 분배 (평시 0으로 내리는 것도 가능)
  local ngp ngs dp ds pmaxp pmaxs new_maxp new_maxs candp cands
  ngp="$(_tf_out eks_burst_primary_node_group_name)"
  ngs="$(_tf_out eks_burst_secondary_node_group_name)"
  if [[ -n "$ngp" && -n "$ngs" ]]; then
    dp=$(( (desired * 8 + 9) / 10 )) # ceil(desired*0.8)
    ds=$(( desired - dp ))
    if (( ds < 0 )); then ds=0; fi

    jp="$(aws eks describe-nodegroup --region "$region" --cluster-name "$cluster" --nodegroup-name "$ngp" 2>/dev/null || true)"
    js="$(aws eks describe-nodegroup --region "$region" --cluster-name "$cluster" --nodegroup-name "$ngs" 2>/dev/null || true)"
    pmaxp="$(printf "%s" "$jp" | python -c 'import json,sys; j=json.load(sys.stdin); sc=j.get("nodegroup",{}).get("scalingConfig",{}) or {}; print(sc.get("maxSize",""))' 2>/dev/null || true)"
    pmaxs="$(printf "%s" "$js" | python -c 'import json,sys; j=json.load(sys.stdin); sc=j.get("nodegroup",{}).get("scalingConfig",{}) or {}; print(sc.get("maxSize",""))' 2>/dev/null || true)"

    candp=$((dp + NODE_MAX_DELTA))
    cands=$((ds + NODE_MAX_DELTA))
    new_maxp="$candp"
    new_maxs="$cands"
    if [[ "${FORCE_NODE_MAX:-0}" = "1" ]]; then
      new_maxp="$dp"
      new_maxs="$ds"
    else
      if [[ -n "${pmaxp:-}" && "$pmaxp" =~ ^[0-9]+$ ]] && (( pmaxp > new_maxp )); then new_maxp="$pmaxp"; fi
      if [[ -n "${pmaxs:-}" && "$pmaxs" =~ ^[0-9]+$ ]] && (( pmaxs > new_maxs )); then new_maxs="$pmaxs"; fi
      if (( new_maxp < dp )); then new_maxp="$dp"; fi
      if (( new_maxs < ds )); then new_maxs="$ds"; fi
    fi

    aws eks update-nodegroup-config \
      --region "$region" \
      --cluster-name "$cluster" \
      --nodegroup-name "$ngp" \
      --scaling-config "minSize=${dp},desiredSize=${dp},maxSize=${new_maxp}" \
      >/dev/null || true

    aws eks update-nodegroup-config \
      --region "$region" \
      --cluster-name "$cluster" \
      --nodegroup-name "$ngs" \
      --scaling-config "minSize=${ds},desiredSize=${ds},maxSize=${new_maxs}" \
      >/dev/null || true
  fi
}

_force_scale_targets_now() {
  # HPA/KEDA는 downscale이 안정화 윈도우/쿨다운 때문에 즉시 내려가지 않을 수 있음.
  # 테스트에서는 "명령어 입력값대로 desired가 바로 맞는 것"이 목적이므로 scale을 함께 수행한다.
  # - write/read: HPA 대상 burst Deployment
  # - worker: KEDA 대상 burst Deployment
  local wr="$1" rd="$2" wk="$3"
  if (( wr > 0 )); then
    local wr_pri=$(( (wr * 8 + 9) / 10 ))
    local wr_sec=$(( wr - wr_pri ))
    kubectl -n "$NS" scale deploy/write-api-burst-primary --replicas="$wr_pri" >/dev/null 2>&1 || true
    kubectl -n "$NS" scale deploy/write-api-burst-secondary --replicas="$wr_sec" >/dev/null 2>&1 || true
  else
    kubectl -n "$NS" scale deploy/write-api-burst-primary --replicas=0 >/dev/null 2>&1 || true
    kubectl -n "$NS" scale deploy/write-api-burst-secondary --replicas=0 >/dev/null 2>&1 || true
  fi
  kubectl -n "$NS" scale deploy/read-api-burst --replicas="$rd" >/dev/null 2>&1 || true
  if (( wk > 0 )); then
    local wk_pri=$(( (wk * 8 + 9) / 10 ))
    local wk_sec=$(( wk - wk_pri ))
    kubectl -n "$NS" scale deploy/worker-svc-burst-primary --replicas="$wk_pri" >/dev/null 2>&1 || true
    kubectl -n "$NS" scale deploy/worker-svc-burst-secondary --replicas="$wk_sec" >/dev/null 2>&1 || true
  else
    kubectl -n "$NS" scale deploy/worker-svc-burst-primary --replicas=0 >/dev/null 2>&1 || true
    kubectl -n "$NS" scale deploy/worker-svc-burst-secondary --replicas=0 >/dev/null 2>&1 || true
  fi
}

_need kubectl
_need aws
_need terraform
_need python

nodes="" wr="" rd="" wk=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n)  nodes="$2"; shift 2;;
    -wr) wr="$2"; shift 2;;
    -r)  rd="$2"; shift 2;;
    -wk) wk="$2"; shift 2;;
    *) _die "unknown arg: $1 (use: -n <nodes> -wr <write> -r <read> -wk <worker>)";;
  esac
done

[[ -n "$nodes" && -n "$wr" && -n "$rd" && -n "$wk" ]] || _die "required: -n/-wr/-r/-wk"

_strip_legacy_annotations

_set_hpa_write_split "$wr"
_set_hpa "read-api-hpa" "$rd"
_set_keda "$wk"
_set_nodegroup "$nodes"

_force_scale_targets_now "$wr" "$rd" "$wk"

echo "set OK"
