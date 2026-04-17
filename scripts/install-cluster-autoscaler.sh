#!/usr/bin/env bash
# EKS에 Cluster Autoscaler 설치 (Helm).
# 사전: helm, kubectl, aws eks update-kubeconfig, terraform apply (IRSA 역할 생성됨)
#
# ASG 자동발견(autoDiscovery)은 노드 그룹에 붙은 태그가 필요함 — terraform/modules/eks 의
# aws_eks_node_group.tags 에 k8s.io/cluster-autoscaler/* 가 있어야 scale-up 이 동작함.
#
# Windows 공유 폴더(hgfs/vm-share)에서 CRLF가 섞이면 "set: pipefail: invalid option" 이 난다.
# 아래 블록이 한 번 파일을 LF로 고친 뒤 같은 스크립트를 다시 실행한다.

_script="${BASH_SOURCE[0]}"
if command -v grep >/dev/null 2>&1 && grep -q $'\r' "$_script" 2>/dev/null; then
  if sed --version >/dev/null 2>&1; then
    sed -i 's/\r$//' "$_script"
  else
    sed -i '' 's/\r$//' "$_script"
  fi
  exec bash "$_script" "$@"
fi

set -eu
set -o pipefail 2>/dev/null || true

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/terraform"
cd "$TF_DIR"

CLUSTER_NAME="$(terraform output -raw eks_cluster_name)"
ROLE_ARN="$(terraform output -raw cluster_autoscaler_role_arn)"
REGION="$(terraform output -raw aws_region)"

echo "cluster=$CLUSTER_NAME region=$REGION"

if ! command -v helm >/dev/null 2>&1; then
  echo "helm 이 필요합니다. 예: curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
  exit 1
fi

helm repo add autoscaler https://kubernetes.github.io/autoscaler 2>/dev/null || true
helm repo update

VALUES="$(mktemp)"
trap 'rm -f "$VALUES"' EXIT
cat >"$VALUES" <<EOF
fullnameOverride: cluster-autoscaler
nameOverride: cluster-autoscaler
priorityClassName: system-cluster-critical
image:
  repository: registry.k8s.io/autoscaling/cluster-autoscaler
  # EKS 1.30.x 에 맞춰 pin (신버전은 ResourceClaim/DeviceClass 등으로 로그가 오염되고 동작이 불안정할 수 있음)
  tag: v1.30.7
autoDiscovery:
  clusterName: ${CLUSTER_NAME}
awsRegion: ${REGION}
rbac:
  serviceAccount:
    create: true
    name: cluster-autoscaler
    annotations:
      eks.amazonaws.com/role-arn: ${ROLE_ARN}
extraArgs:
  v: 4
  balance-similar-node-groups: true
  skip-nodes-with-local-storage: false
  expander: least-waste
  # Pending(Unschedulable) 감지 주기. 더 빨리 감지해 scale-up 시작을 당김.
  scan-interval: 5s
  # 새 파드가 생성된 직후 scale-up 판단을 미루지 않음(기본보다 공격적으로).
  new-pod-scale-up-delay: 0s
  scale-down-delay-after-add: 7m
  scale-down-unneeded-time: 10m
  # 노드 준비 지연(특히 신규 ASG 인스턴스) 시 scale-up 타임아웃 완화
  max-node-provision-time: 15m
EOF

if helm list -n kube-system | grep -q cluster-autoscaler; then
  echo "이미 설치됨 → upgrade"
  helm upgrade cluster-autoscaler autoscaler/cluster-autoscaler \
    -n kube-system -f "$VALUES" --wait
else
  helm install cluster-autoscaler autoscaler/cluster-autoscaler \
    -n kube-system -f "$VALUES" --wait
fi

echo "완료: kubectl get deployment -n kube-system cluster-autoscaler"
echo "logs: kubectl -n kube-system logs deploy/cluster-autoscaler --tail=200"
