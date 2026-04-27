#!/usr/bin/env bash
set -eu
set -o pipefail 2>/dev/null || true

# Terminal locale may not be UTF-8; keep output ASCII and
# best-effort force UTF-8 locale to avoid garbled text.
export LC_ALL="${LC_ALL:-C.UTF-8}" 2>/dev/null || true
export LANG="${LANG:-C.UTF-8}" 2>/dev/null || true

# Print k8s snapshot using *host* kubectl credentials.
# This is meant to be independent from the tools-once Pod serviceAccount RBAC.
#
# Usage:
#   bash scripts/k8s-snapshot-host.sh
#   TICKETING_NAMESPACE=ticketing bash scripts/k8s-snapshot-host.sh

NS="${TICKETING_NAMESPACE:-ticketing}"

_jsonpath_ns() {
  local res="$1"
  local jp="$2"
  kubectl -n "$NS" get "$res" -o "jsonpath=${jp}" 2>/dev/null || true
}

_deploy_ready_desired() {
  local name="$1"
  local ready desired
  ready="$(_jsonpath_ns "deploy/${name}" '{.status.readyReplicas}')"
  desired="$(_jsonpath_ns "deploy/${name}" '{.status.replicas}')"
  ready="${ready:-0}"
  desired="${desired:-0}"
  printf "%s / desired=%s" "$ready" "$desired"
}

_deploy_ready_desired_sum() {
  # stable + burst(1~2개) 같이 세는 용도 (예: write-api + write-api-burst-primary/secondary)
  # Usage:
  #   _deploy_ready_desired_sum stable burst
  #   _deploy_ready_desired_sum stable burst_primary burst_secondary
  local stable="$1" pri="$2" sec="${3:-}"
  local s_ready s_desired p_ready p_desired e_ready e_desired
  s_ready="$(_jsonpath_ns "deploy/${stable}" '{.status.readyReplicas}')"; s_ready="${s_ready:-0}"
  s_desired="$(_jsonpath_ns "deploy/${stable}" '{.status.replicas}')";     s_desired="${s_desired:-0}"
  p_ready="$(_jsonpath_ns "deploy/${pri}" '{.status.readyReplicas}')"; p_ready="${p_ready:-0}"
  p_desired="$(_jsonpath_ns "deploy/${pri}" '{.status.replicas}')";     p_desired="${p_desired:-0}"
  e_ready=0
  e_desired=0
  if [[ -n "$sec" ]]; then
    e_ready="$(_jsonpath_ns "deploy/${sec}" '{.status.readyReplicas}')"; e_ready="${e_ready:-0}"
    e_desired="$(_jsonpath_ns "deploy/${sec}" '{.status.replicas}')";     e_desired="${e_desired:-0}"
  fi
  printf "%s / desired=%s" "$((s_ready + p_ready + e_ready))" "$((s_desired + p_desired + e_desired))"
}

_scaledobject_keda_summary() {
  # worker-svc-sqs-primary/secondary 의 min/max/paused 상태를 함께 보여준다(토글/부하 테스트 디버깅용).
  # 권한/리소스 없으면 N/A.
  local parts=()
  local obj min max paused short
  for obj in scaledobject/worker-svc-sqs-primary scaledobject/worker-svc-sqs-secondary; do
    short="${obj#scaledobject/}"
    min="$(_jsonpath_ns "$obj" '{.spec.minReplicaCount}')"; min="${min:-N/A}"
    max="$(_jsonpath_ns "$obj" '{.spec.maxReplicaCount}')"; max="${max:-N/A}"
    paused="$(_jsonpath_ns "$obj" '{.metadata.annotations.autoscaling\.keda\.sh/paused}')"
    paused="${paused:-false}"
    parts+=("${short}(min=${min} max=${max} paused=${paused})")
  done
  printf "%s %s" "${parts[0]}" "${parts[1]}"
}

_nodes_ready_best_effort() {
  # nodes is cluster-scoped and may be RBAC-blocked; best-effort.
  # 1) Count Ready nodes directly
  # 2) If blocked, fallback to kube-system/aws-node DaemonSet numberReady
  local out cnt
  out="$(kubectl get nodes -o jsonpath='{range .items[*]}{range .status.conditions[?(@.type=="Ready")]}{.status}{"\n"}{end}{end}' 2>/dev/null || true)"
  if [[ -n "$out" ]]; then
    # "True" line count = Ready nodes
    cnt="$(printf "%s" "$out" | tr -d '\r' | awk '$1=="True"{c++} END{print c+0}')"
    printf "%s" "${cnt:-0}"
    return 0
  fi

  # fallback: aws-node DaemonSet numberReady (proxy for healthy nodes)
  out="$(kubectl -n kube-system get ds aws-node -o jsonpath='{.status.numberReady}' 2>/dev/null || true)"
  if [[ -n "$out" ]]; then
    printf "%s" "$out"
    return 0
  fi

  printf "N/A"
}

echo "-----------------------------------------------------------"
echo "  eks nodes (ready)   : $(_nodes_ready_best_effort)"
echo "  write pods          : $(_deploy_ready_desired_sum write-api write-api-burst-primary write-api-burst-secondary)"
echo "    - write stable    : $(_deploy_ready_desired write-api)"
echo "    - write burst pri : $(_deploy_ready_desired write-api-burst-primary)"
echo "    - write burst sec : $(_deploy_ready_desired write-api-burst-secondary)"
echo "  read  pods          : $(_deploy_ready_desired_sum read-api read-api-burst)"
echo "    - read stable     : $(_deploy_ready_desired read-api)"
echo "    - read burst      : $(_deploy_ready_desired read-api-burst)"
echo "  work  pods          : $(_deploy_ready_desired_sum worker-svc worker-svc-burst-primary worker-svc-burst-secondary)  $(_scaledobject_keda_summary)"
echo "    - work stable     : $(_deploy_ready_desired worker-svc)"
echo "    - work burst pri  : $(_deploy_ready_desired worker-svc-burst-primary)"
echo "    - work burst sec  : $(_deploy_ready_desired worker-svc-burst-secondary)"
echo "-----------------------------------------------------------"

