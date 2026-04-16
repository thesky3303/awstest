#!/usr/bin/env bash
# ON:
# - KEDA ScaledObject(worker-svc-sqs) paused 해제 → worker-svc 오토스케일 (1~maxReplicaCount)
# - worker-svc 기본 1대는 유지 (minReplicaCount=1)
set -euo pipefail

NS="${KUBECTL_NAMESPACE:-ticketing}"
CM="${TICKETING_CONFIGMAP_NAME:-ticketing-config}"

_die() { echo "ERROR: $*" >&2; exit 1; }

_secret_has_key() {
  local key="$1"
  kubectl -n "$NS" get secret ticketing-secrets -o "jsonpath={.data.${key}}" 2>/dev/null | tr -d '\r\n'
}

_diag_keda() {
  echo "=== diag: keda scaledobject ===" >&2
  kubectl -n "$NS" get scaledobject worker-svc-sqs -o wide >&2 || true
  kubectl -n "$NS" describe scaledobject worker-svc-sqs >&2 || true
}

trap '_diag_keda' ERR

kubectl -n "$NS" get cm "$CM" >/dev/null 2>&1 || _die "ConfigMap not found: $NS/$CM"
kubectl -n "$NS" get deploy/worker-svc >/dev/null 2>&1 || _die "Deployment not found: $NS/worker-svc"
kubectl -n "$NS" get scaledobject worker-svc-sqs >/dev/null 2>&1 || _die "ScaledObject not found: $NS/worker-svc-sqs (apply k8s/keda)"
kubectl -n "$NS" get secret ticketing-secrets >/dev/null 2>&1 || _die "Secret not found: $NS/ticketing-secrets (run k8s/scripts/apply-secrets-from-terraform.sh)"

if [[ -z "$(_secret_has_key SQS_QUEUE_NAME)" ]]; then
  _die "Secret missing key: SQS_QUEUE_NAME (in $NS/ticketing-secrets)"
fi

kubectl -n "$NS" scale deploy/worker-svc --replicas=1 2>/dev/null || true

kubectl annotate scaledobject worker-svc-sqs -n "$NS" autoscaling.keda.sh/paused- >/dev/null

kubectl -n "$NS" get deploy worker-svc -o wide
echo "ON OK: worker-svc autoscale=KEDA(unpaused) (min=1..max)"

