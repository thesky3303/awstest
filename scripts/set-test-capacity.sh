#!/usr/bin/env bash
set -eu
set -o pipefail 2>/dev/null || true

# 임시로 "테스트 용량"을 설정하고, (--restore)로 원복할 수 있게 만든 스크립트.
#
# 사용:
#   bash scripts/set-test-capacity.sh -n 9 -wr 23 -r 1 -wk 30
#   bash scripts/set-test-capacity.sh --restore
#
# 동작:
# - write/read: HPA min=max 고정(autoscale 범위를 고정해 일정한 부하 테스트를 하기 위함)
# - worker: KEDA ScaledObject min=max 고정 + paused 해제
# - node: EKS managed nodegroup desired/min/max 중 desired를 목표값으로 맞추고,
#         scale-in으로 내려가지 않도록 min도 동일하게 설정
#
# 원복:
# - 최초 적용 시점의 값을 annotation에 저장해 두고, --restore 시 복구한다.

NS="${KUBECTL_NAMESPACE:-ticketing}"

ANN_PREFIX="ticketing.soldesk/test-capacity"
ANN_TS_KEY="${ANN_PREFIX}.ts"

_die() { echo "ERROR: $*" >&2; exit 1; }

_need() {
  command -v "$1" >/dev/null 2>&1 || _die "missing command: $1"
}

_tf_out() {
  # args: <name>
  terraform -chdir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/../terraform" && pwd)" output -raw "$1" 2>/dev/null || true
}

_ann_get() {
  # args: <kind/name> <key>
  kubectl -n "$NS" get "$1" -o "jsonpath={.metadata.annotations['$2']}" 2>/dev/null || true
}

_ann_set() {
  # args: <kind/name> <key> <value>
  kubectl -n "$NS" annotate "$1" "$2=$3" --overwrite >/dev/null
}

_jsonpath() {
  # args: <kind/name> <jsonpath>
  kubectl -n "$NS" get "$1" -o "jsonpath=$2" 2>/dev/null || true
}

_save_if_missing() {
  # args: <obj> <key> <value>
  local obj="$1" key="$2" val="$3"
  local cur
  cur="$(_ann_get "$obj" "$key")"
  if [[ -z "${cur:-}" ]]; then
    _ann_set "$obj" "$key" "$val"
  fi
}

_ensure_saved_once() {
  local ts
  ts="$(_ann_get "hpa/write-api-hpa" "$ANN_TS_KEY")"
  if [[ -n "${ts:-}" ]]; then
    return 0
  fi
  ts="$(date -Is 2>/dev/null || date)"
  _ann_set "hpa/write-api-hpa" "$ANN_TS_KEY" "$ts"
  _ann_set "hpa/read-api-hpa"  "$ANN_TS_KEY" "$ts"
  _ann_set "scaledobject/worker-svc-sqs" "$ANN_TS_KEY" "$ts"
}

_set_hpa_fixed() {
  # args: <hpa-name> <replicas>
  local name="$1" rep="$2" obj="hpa/$1"
  local min max
  min="$(_jsonpath "$obj" '{.spec.minReplicas}')"
  max="$(_jsonpath "$obj" '{.spec.maxReplicas}')"
  _save_if_missing "$obj" "${ANN_PREFIX}.prev-min" "${min:-}"
  _save_if_missing "$obj" "${ANN_PREFIX}.prev-max" "${max:-}"
  kubectl -n "$NS" patch "$obj" --type merge -p "{\"spec\":{\"minReplicas\":${rep},\"maxReplicas\":${rep}}}" >/dev/null
}

_set_keda_fixed() {
  # args: <min=max>
  local rep="$1"
  local obj="scaledobject/worker-svc-sqs"
  local min max paused
  min="$(_jsonpath "$obj" '{.spec.minReplicaCount}')"
  max="$(_jsonpath "$obj" '{.spec.maxReplicaCount}')"
  paused="$(_ann_get "$obj" "autoscaling.keda.sh/paused")"
  _save_if_missing "$obj" "${ANN_PREFIX}.prev-min" "${min:-}"
  _save_if_missing "$obj" "${ANN_PREFIX}.prev-max" "${max:-}"
  _save_if_missing "$obj" "${ANN_PREFIX}.prev-paused" "${paused:-}"
  kubectl -n "$NS" patch "$obj" --type merge -p "{\"spec\":{\"minReplicaCount\":${rep},\"maxReplicaCount\":${rep}}}" >/dev/null
  kubectl -n "$NS" annotate "$obj" autoscaling.keda.sh/paused- >/dev/null 2>&1 || true
}

_set_nodegroup() {
  # args: <desired>
  local desired="$1"
  local region cluster ng
  region="$(_tf_out aws_region)"
  cluster="$(_tf_out eks_cluster_name)"
  ng="$(_tf_out eks_app_node_group_name)"
  [[ -n "$region" && -n "$cluster" && -n "$ng" ]] || _die "terraform outputs missing (aws_region/eks_cluster_name/eks_app_node_group_name)"

  # nodegroup에 annotation을 직접 남기기 어렵기 때문에, HPA annotation에 저장한다.
  local obj="hpa/write-api-hpa"
  local pmin pdes pmax

  pmin="$(_tf_out eks_node_group_scaling_summary | tr -d '\r' || true)"
  # output이 map이면 -raw가 실패할 수 있음. fallback으로 aws eks describe-nodegroup 사용
  if [[ -z "${pmin:-}" || "$pmin" == *"{"* ]]; then
    local j
    j="$(aws eks describe-nodegroup --region "$region" --cluster-name "$cluster" --nodegroup-name "$ng" 2>/dev/null || true)"
    pmin="$(printf "%s" "$j" | python - <<'PY' 2>/dev/null || true
import json,sys
j=json.load(sys.stdin)
sc=j.get("nodegroup",{}).get("scalingConfig",{}) or {}
print(sc.get("minSize",""))
PY
)"
    pdes="$(printf "%s" "$j" | python - <<'PY' 2>/dev/null || true
import json,sys
j=json.load(sys.stdin)
sc=j.get("nodegroup",{}).get("scalingConfig",{}) or {}
print(sc.get("desiredSize",""))
PY
)"
    pmax="$(printf "%s" "$j" | python - <<'PY' 2>/dev/null || true
import json,sys
j=json.load(sys.stdin)
sc=j.get("nodegroup",{}).get("scalingConfig",{}) or {}
print(sc.get("maxSize",""))
PY
)"
  fi

  _save_if_missing "$obj" "${ANN_PREFIX}.prev-node-min" "${pmin:-}"
  _save_if_missing "$obj" "${ANN_PREFIX}.prev-node-desired" "${pdes:-}"
  _save_if_missing "$obj" "${ANN_PREFIX}.prev-node-max" "${pmax:-}"

  # desired만 올리면 min이 낮아 scale-in으로 내려갈 수 있어, min도 같이 올린다.
  aws eks update-nodegroup-config \
    --region "$region" \
    --cluster-name "$cluster" \
    --nodegroup-name "$ng" \
    --scaling-config "minSize=${desired},desiredSize=${desired},maxSize=${pmax:-$desired}" \
    >/dev/null
}

_restore_hpa() {
  local obj="$1"
  local pmin pmax
  pmin="$(_ann_get "$obj" "${ANN_PREFIX}.prev-min")"
  pmax="$(_ann_get "$obj" "${ANN_PREFIX}.prev-max")"
  [[ -n "${pmin:-}" && -n "${pmax:-}" ]] || return 0
  kubectl -n "$NS" patch "$obj" --type merge -p "{\"spec\":{\"minReplicas\":${pmin},\"maxReplicas\":${pmax}}}" >/dev/null
}

_restore_keda() {
  local obj="scaledobject/worker-svc-sqs"
  local pmin pmax ppaused
  pmin="$(_ann_get "$obj" "${ANN_PREFIX}.prev-min")"
  pmax="$(_ann_get "$obj" "${ANN_PREFIX}.prev-max")"
  ppaused="$(_ann_get "$obj" "${ANN_PREFIX}.prev-paused")"
  [[ -n "${pmin:-}" && -n "${pmax:-}" ]] || return 0
  kubectl -n "$NS" patch "$obj" --type merge -p "{\"spec\":{\"minReplicaCount\":${pmin},\"maxReplicaCount\":${pmax}}}" >/dev/null
  if [[ "${ppaused:-}" == "true" ]]; then
    kubectl -n "$NS" annotate "$obj" autoscaling.keda.sh/paused=true --overwrite >/dev/null 2>&1 || true
  fi
}

_restore_nodegroup() {
  local region cluster ng
  region="$(_tf_out aws_region)"
  cluster="$(_tf_out eks_cluster_name)"
  ng="$(_tf_out eks_app_node_group_name)"
  [[ -n "$region" && -n "$cluster" && -n "$ng" ]] || return 0

  local obj="hpa/write-api-hpa"
  local pmin pdes pmax
  pmin="$(_ann_get "$obj" "${ANN_PREFIX}.prev-node-min")"
  pdes="$(_ann_get "$obj" "${ANN_PREFIX}.prev-node-desired")"
  pmax="$(_ann_get "$obj" "${ANN_PREFIX}.prev-node-max")"
  [[ -n "${pmin:-}" && -n "${pdes:-}" && -n "${pmax:-}" ]] || return 0

  aws eks update-nodegroup-config \
    --region "$region" \
    --cluster-name "$cluster" \
    --nodegroup-name "$ng" \
    --scaling-config "minSize=${pmin},desiredSize=${pdes},maxSize=${pmax}" \
    >/dev/null
}

_need kubectl
_need aws
_need terraform
_need python

if [[ "${1:-}" == "--restore" ]]; then
  _restore_hpa "hpa/write-api-hpa"
  _restore_hpa "hpa/read-api-hpa"
  _restore_keda
  _restore_nodegroup
  echo "restore OK"
  exit 0
fi

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

_ensure_saved_once
_set_hpa_fixed "write-api-hpa" "$wr"
_set_hpa_fixed "read-api-hpa" "$rd"
_set_keda_fixed "$wk"
_set_nodegroup "$nodes"

kubectl -n "$NS" get hpa write-api-hpa read-api-hpa -o wide
kubectl -n "$NS" get scaledobject worker-svc-sqs -o wide
echo "set OK"

