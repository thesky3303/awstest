#!/usr/bin/env bash
# OFF:
# - KEDA paused, worker-svc-burst-primary/secondary 0, stable worker-svc 1
set -euo pipefail

NS="${KUBECTL_NAMESPACE:-ticketing}"
CM="${TICKETING_CONFIGMAP_NAME:-ticketing-config}"

kubectl annotate scaledobject/worker-svc-sqs-primary -n "$NS" autoscaling.keda.sh/paused=true --overwrite >/dev/null 2>&1 || true
kubectl annotate scaledobject/worker-svc-sqs-secondary -n "$NS" autoscaling.keda.sh/paused=true --overwrite >/dev/null 2>&1 || true
kubectl -n "$NS" scale deploy/worker-svc --replicas=1 2>/dev/null || true
kubectl -n "$NS" scale deploy/worker-svc-burst-primary --replicas=0 2>/dev/null || true
kubectl -n "$NS" scale deploy/worker-svc-burst-secondary --replicas=0 2>/dev/null || true

kubectl -n "$NS" get deploy worker-svc worker-svc-burst-primary worker-svc-burst-secondary -o wide 2>/dev/null || true
echo "OFF OK: worker-svc=1, worker-svc-burst-{primary,secondary}=0, KEDA paused"

