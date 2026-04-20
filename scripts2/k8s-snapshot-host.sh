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
echo "  write burst pods    : $(_deploy_ready_desired write-api-burst)"
echo "  read burst pods     : $(_deploy_ready_desired read-api-burst)"
echo "  work burst pods     : $(_deploy_ready_desired worker-svc-burst)"
echo "-----------------------------------------------------------"

