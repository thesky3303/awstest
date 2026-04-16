#!/usr/bin/env bash
# OFF:
# - KEDA ScaledObject(worker-svc-sqs) paused(오토스케일 OFF)
# - worker-svc 는 1대로 고정
set -euo pipefail

NS="${KUBECTL_NAMESPACE:-ticketing}"
CM="${TICKETING_CONFIGMAP_NAME:-ticketing-config}"

kubectl annotate scaledobject worker-svc-sqs -n "$NS" autoscaling.keda.sh/paused=true --overwrite >/dev/null 2>&1 || true
kubectl -n "$NS" scale deploy/worker-svc --replicas=1 2>/dev/null || true

kubectl -n "$NS" get deploy worker-svc -o wide 2>/dev/null || true
echo "OFF OK: worker-svc=1 (pinned), worker autoscale=KEDA(paused)"

