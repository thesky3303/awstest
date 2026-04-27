#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Installing kube-prometheus-stack ==="

# "멈춤"처럼 보이는 1순위 원인: helm repo update 는 네트워크가 꼬이면 오래 대기할 수 있다.
# helm 3.7+ 는 --timeout 을 지원하므로 여기만 최소로 타임아웃을 건다.
HELM_REPO_TIMEOUT="${HELM_REPO_TIMEOUT:-3m}"

# 나머지 helm upgrade/install 은 --timeout 이 있으므로 무한 멈춤은 없지만,
# 첫 설치는 PVC/리소스/노드 여유에 따라 10m 를 넘기기 쉬워 context deadline exceeded 로 자주 실패한다.
# 기본값만 25m 로 늘리고, 더 필요하면 env 로 오버라이드한다.
KPS_TIMEOUT="${KUBE_PROM_STACK_HELM_TIMEOUT:-25m}"
LOKI_TIMEOUT="${LOKI_HELM_TIMEOUT:-5m}"
PROMTAIL_TIMEOUT="${PROMTAIL_HELM_TIMEOUT:-5m}"

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
helm repo add grafana https://grafana.github.io/helm-charts 2>/dev/null || true
helm repo update --timeout "$HELM_REPO_TIMEOUT"

# namespace 먼저 생성
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# PriorityClass (values에서 사용: ticketing-priority-platform)
kubectl apply -f "$ROOT_DIR/k8s/priorityclass-ticketing.yaml"

# gp3 StorageClass (EBS CSI 드라이버용)
kubectl apply -f "$ROOT_DIR/monitoring/k8s/storageclass-gp3.yaml"

# Grafana dashboard ConfigMap (Helm보다 먼저 — sidecar가 자동 로드)
kubectl apply -f "$ROOT_DIR/monitoring/k8s/grafana-dashboards-configmap.yaml"

# kube-prometheus-stack (CRD 포함 — PrometheusRule 적용 전에 설치해야 함)
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --values "$ROOT_DIR/monitoring/values-kube-prometheus-stack.yaml" \
  --wait --timeout "$KPS_TIMEOUT"

# PrometheusRule (kube-prometheus-stack이 CRD를 설치한 뒤에 적용)
kubectl apply -f "$ROOT_DIR/monitoring/prometheus-rules.yaml"

echo "=== Installing Loki ==="
helm upgrade --install loki grafana/loki \
  --namespace monitoring \
  --values "$ROOT_DIR/monitoring/values-loki.yaml" \
  --wait --timeout "$LOKI_TIMEOUT"

echo "=== Installing Promtail ==="
helm upgrade --install promtail grafana/promtail \
  --namespace monitoring \
  --set "config.clients[0].url=http://loki:3100/loki/api/v1/push" \
  --wait --timeout "$PROMTAIL_TIMEOUT"

# Grafana ALB Ingress
kubectl apply -f "$ROOT_DIR/monitoring/k8s/grafana-ingress.yaml"

echo ""
echo "=== Monitoring stack installed ==="
echo "Grafana : kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80"
echo "          or via ALB at /grafana  (root / soldesk1.)"
echo "Prometheus: kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090"
