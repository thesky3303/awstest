#!/usr/bin/env bash
set -eu
if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

echo "Installing aws-load-balancer-controller via Helm..."

: "${CLUSTER_NAME:?CLUSTER_NAME is required}"
: "${AWS_REGION:?AWS_REGION is required}"
: "${VPC_ID:?VPC_ID is required}"
: "${ROLE_ARN:?ROLE_ARN is required}"

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI not found. Install AWS CLI v2 and ensure it is on PATH." >&2
  exit 127
fi
if ! command -v helm >/dev/null 2>&1; then
  echo "ERROR: helm not found. Terraform apply runs this script on the machine where you execute terraform;" >&2
  echo "      install Helm 3 (https://helm.sh/docs/intro/install/) and retry." >&2
  exit 127
fi
if ! command -v kubectl >/dev/null 2>&1; then
  echo "ERROR: kubectl not found. Install kubectl and retry." >&2
  exit 127
fi

# Parallel Terraform local-exec provisioners can run update-kubeconfig against the same
# ~/.kube/config and corrupt YAML. Use an isolated file per invocation.
unset KUBECONFIG 2>/dev/null || true
_TMP_KUBECONFIG="$(mktemp)"
export KUBECONFIG="$_TMP_KUBECONFIG"
trap 'rm -f "$_TMP_KUBECONFIG"' EXIT
aws eks update-kubeconfig --name "${CLUSTER_NAME}" --region "${AWS_REGION}" --kubeconfig "$_TMP_KUBECONFIG"

helm repo add eks https://aws.github.io/eks-charts >/dev/null 2>&1 || true
helm repo update >/dev/null

helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set "clusterName=${CLUSTER_NAME}" \
  --set "region=${AWS_REGION}" \
  --set "vpcId=${VPC_ID}" \
  --set replicaCount=1 \
  --set serviceAccount.create=true \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn=${ROLE_ARN}" \
  --wait \
  --timeout 10m \
  --atomic

echo "Waiting for controller rollout..."
kubectl -n kube-system rollout status deploy/aws-load-balancer-controller --timeout=10m

echo "Verifying webhook CA bundle is present..."
_CABUNDLE_LEN="$(kubectl get mutatingwebhookconfiguration aws-load-balancer-webhook -o jsonpath='{.webhooks[0].clientConfig.caBundle}' 2>/dev/null | wc -c | tr -d ' ')"
if [ "${_CABUNDLE_LEN:-0}" -lt 10 ]; then
  echo "ERROR: aws-load-balancer-controller webhook CA bundle is missing/too short." >&2
  echo "This causes failures like: tls: failed to verify certificate (x509 unknown authority)." >&2
  echo "Try reinstalling the controller cleanly (delete webhook configs + tls secret) and re-run apply." >&2
  exit 1
fi

