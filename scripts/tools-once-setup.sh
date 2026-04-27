#!/usr/bin/env bash
# tools-once Pod 하나만 사용: Running 이면 스크립트만 rsync 성격으로 갱신, 아니면 같은 이름으로 재기동 후 동기화.
#
# 스케줄링/보호:
# - ticketing-priority-devtools-protected 는 value 가 높고 preemptionPolicy: Never (k8s/priorityclass-ticketing.yaml).
#   다른 워크로드를 선점해 쫓아내지는 않되(스케줄러 preemption 금지),
#   노드 압박/축출 상황에서 tools-once 가 먼저 밀리지 않도록 우선순위를 높인다.
# - PDB(minAvailable: 1) + autoscaler/karpenter "evict 금지" 애노테이션을 같이 적용해
#   드레인/스케일다운 등 자발적(eviction) 중단에 최대한 흔들리지 않게 한다.
set -eu

NS="${KUBECTL_NAMESPACE:-ticketing}"
POD="${TOOLS_ONCE_POD:-tools-once}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

_sync_scripts() {
  # Windows/HGFS/IDE 환경에서 CRLF가 섞이면 Pod에서 shebang 실행이 깨질 수 있어,
  # 복사 전에 로컬 레포의 줄바꿈을 멱등하게 정규화한다.
  bash "$REPO_ROOT/scripts/normalize-line-endings.sh" >/dev/null || true
  kubectl -n "$NS" exec "$POD" -- mkdir -p /work/ticketing-db/scripts /work/ticketing-db/terraform
  kubectl cp "$REPO_ROOT/scripts/." "$NS/$POD:/work/ticketing-db/scripts/"
  echo "Synced $REPO_ROOT/scripts/. -> $NS/$POD:/work/ticketing-db/scripts/"
}

_ensure_python_deps() {
  # Running 중인 기존 tools-once Pod를 재사용하는 경우에도,
  # python 패키지 설치가 누락될 수 있어 매번(멱등) 보장한다.
  # 컨테이너가 root로 돌아가므로 pip의 root 경고를 끈다(의도된 일회성 ops Pod).
  # NOTE: Pod에서 외부 DNS/egress가 막혀있으면 pip도 항상 실패한다.
  # 스크립트 전체를 실패시키지 않고, 설치 실패 시 경고만 출력하고 계속 진행한다.
  _pip_install_best_effort() {
    local args=("$@")
    if kubectl -n "$NS" exec "$POD" -- python -m pip install -q --root-user-action=ignore "${args[@]}"; then
      return 0
    fi
    echo "[warn] pip install failed (likely DNS/egress blocked). Skipping: ${args[*]}" >&2
    return 0
  }

  _pip_install_best_effort --upgrade "pip>=26,<27"
  _pip_install_best_effort boto3 pymysql redis
  _pip_install_best_effort aiohttp
  _pip_install_best_effort "locust==2.34.0"
}

_ensure_os_deps() {
  # tools-once 이미지(python:3.12-slim)는 Debian 계열.
  # RDS 터널링용 socat + 리슨 포트 확인용(ss) 설치를 멱등 보장한다.
  kubectl -n "$NS" exec "$POD" -- sh -lc '
    # NOTE: 일부 환경은 Pod에서 외부 DNS/egress가 막혀 apt가 항상 실패할 수 있다.
    # 로드테스트/운영 스크립트 실행 자체를 막지 않기 위해 "있으면 쓰고, 없으면 경고"로 둔다.
    set -e
    export DEBIAN_FRONTEND=noninteractive

    have_socat=0
    have_ss=0
    command -v socat >/dev/null 2>&1 && have_socat=1 || true
    command -v ss >/dev/null 2>&1 && have_ss=1 || true
    if [ "$have_socat" = "1" ] && [ "$have_ss" = "1" ]; then
      exit 0
    fi

    # DNS/네트워크가 일시적으로 흔들리면 apt가 바로 실패할 수 있어 재시도한다.
    i=0
    while [ "$i" -lt 5 ]; do
      if apt-get update -y -o Acquire::Retries=3 >/dev/null; then
        break
      fi
      i=$((i + 1))
      sleep 2
    done
    if [ "$i" -ge 5 ]; then
      echo "[warn] apt-get update failed (likely DNS/egress blocked). Skipping socat/iproute2 install." >&2
      echo "--- /etc/resolv.conf ---" >&2
      cat /etc/resolv.conf >&2 || true
      echo "--- /etc/hosts ---" >&2
      cat /etc/hosts >&2 || true
      exit 0
    fi
    # install 실패도 치명적이지 않게 처리 (이미지/미러/권한 이슈 등)
    apt-get install -y socat iproute2 >/dev/null || {
      echo "[warn] apt-get install socat/iproute2 failed; continuing anyway." >&2
      exit 0
    }
  '
}

_need_fresh_pod() {
  if ! kubectl -n "$NS" get pod "$POD" &>/dev/null; then
    return 0
  fi
  local phase
  phase=$(kubectl -n "$NS" get pod "$POD" -o jsonpath='{.status.phase}')
  [ "$phase" = "Running" ] && return 1
  return 0
}

if ! _need_fresh_pod; then
  _sync_scripts
  _ensure_os_deps
  _ensure_python_deps
  exit 0
fi

kubectl -n "$NS" delete pod "$POD" --ignore-not-found --wait=true

kubectl apply -f - <<EOF
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ${POD}-pdb
  namespace: ${NS}
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: ${POD}
---
apiVersion: v1
kind: Pod
metadata:
  name: ${POD}
  namespace: ${NS}
  labels:
    app: ${POD}
    component: devtools
    managed-by: tools-once-setup
  annotations:
    # Cluster Autoscaler가 노드 축소 시 이 Pod를 evict 대상으로 삼지 않게(가능하면) 보호
    cluster-autoscaler.kubernetes.io/safe-to-evict: "false"
    # Karpenter 환경이면 "축출/중단 금지" 힌트로 동작(클러스터에 따라 무시될 수 있음)
    karpenter.sh/do-not-disrupt: "true"
spec:
  priorityClassName: ticketing-priority-devtools-protected
  serviceAccountName: sqs-access-sa
  restartPolicy: Never
  # 기본은 ClusterFirst(클러스터 DNS)로 두어 svc.cluster.local 해석이 항상 되게 한다.
  # 외부 DNS가 깨진 환경에서만(apt 등) 임시 우회가 필요하면 아래 환경변수로 켠다:
  #   TOOLS_ONCE_PUBLIC_DNS=1
  #
  # 주의: public DNS만 쓰면 쿠버네티스 서비스 도메인 해석이 깨질 수 있다.
  # 그래서 기본 OFF, 필요 시에만 opt-in.
  $(if [ "${TOOLS_ONCE_PUBLIC_DNS:-0}" = "1" ]; then cat <<'YAML'
  dnsPolicy: None
  dnsConfig:
    nameservers:
      - 1.1.1.1
      - 8.8.8.8
    options:
      - name: ndots
        value: "1"
      - name: timeout
        value: "2"
      - name: attempts
        value: "2"
YAML
  fi)
  containers:
    - name: tools
      image: python:3.12-slim
      command: ["/bin/sh", "-c", "tail -f /dev/null"]
      resources:
        requests:
          cpu: "25m"
          memory: "64Mi"
        limits:
          cpu: "1"
          memory: "1Gi"
      envFrom:
        - configMapRef:
            name: ticketing-config
        - secretRef:
            name: ticketing-secrets
EOF

i=0
max=200
while [ "$i" -lt "$max" ]; do
  reason=$(kubectl -n "$NS" get pod "$POD" -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}' 2>/dev/null || true)
  case "$reason" in
    ImagePullBackOff|ErrImagePull|CrashLoopBackOff|CreateContainerConfigError|InvalidImageName)
      exit 1
      ;;
  esac
  ready=$(kubectl -n "$NS" get pod "$POD" -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null || true)
  if [ "$ready" = "true" ]; then
    break
  fi
  sleep 3
  i=$((i + 1))
done
if [ "$i" -ge "$max" ]; then
  exit 1
fi

_sync_scripts
_ensure_os_deps
_ensure_python_deps
