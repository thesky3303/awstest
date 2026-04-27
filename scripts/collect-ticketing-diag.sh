#!/usr/bin/env bash
set -eu
set -o pipefail 2>/dev/null || true

# 목적: ticketing 성능/실패(HTTP 0, timeout, 5xx) 원인 분리를 위한 진단 로그를
# teamproject/diag/ 아래에 파일로 수집한다.
#
# 실행 위치:
# - 어느 디렉토리에서 실행해도 됨 (repo root 자동 탐색)
#
# 사용 예:
#   bash scripts/collect-ticketing-diag.sh
#   TICKETING_NS=ticketing bash scripts/collect-ticketing-diag.sh

NS="${TICKETING_NS:-ticketing}"
TOOLS_POD="${TOOLS_ONCE_POD:-tools-once}"

_repo_root() {
  # 현재 위치에서 위로 올라가며 teamproject 루트를 찾는다(마커: terraform/ + scripts/ + k8s/).
  local d
  d="$(pwd)"
  while true; do
    if [[ -d "$d/terraform" && -d "$d/scripts" && -d "$d/k8s" ]]; then
      echo "$d"
      return 0
    fi
    [[ "$d" = "/" ]] && break
    d="$(cd "$d/.." && pwd)"
  done
  # fallback: 이 스크립트 기준(…/scripts/collect-ticketing-diag.sh)
  d="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
  echo "$d"
}

ROOT="$(_repo_root)"

# HGFS/Windows 환경에서 CRLF가 섞이면 bash 실행이 깨질 수 있어 멱등 정규화
bash "$ROOT/scripts/normalize-line-endings.sh" >/dev/null 2>&1 || true

OUT_DIR="${DIAG_DIR:-$ROOT/diag}"
mkdir -p "$OUT_DIR"

OUT="$OUT_DIR/ticketing_diag_$(date +%Y%m%d_%H%M%S).txt"

{
  echo "== ts =="; date -Is
  echo "cwd=$(pwd)"
  echo "repo_root=$ROOT"
  echo "namespace=$NS"
  echo "tools_pod=$TOOLS_POD"
  echo

  echo "== tools-once ==";
  kubectl -n "$NS" get pod "$TOOLS_POD" -o wide || true
  echo
  kubectl -n "$NS" describe pod "$TOOLS_POD" || true
  echo
  kubectl -n "$NS" top pod "$TOOLS_POD" || true
  echo

  echo "== tools-once DNS/resolve write-api ==";
  kubectl -n "$NS" exec "$TOOLS_POD" -- sh -lc \
    "getent hosts write-api.${NS}.svc.cluster.local || nslookup write-api.${NS}.svc.cluster.local || true" || true
  kubectl -n "$NS" exec "$TOOLS_POD" -- sh -lc "python - <<\"PY\"
import socket,time,os
ns=os.getenv(\"TICKETING_NS\",\"ticketing\")
host=f\"write-api.{ns}.svc.cluster.local\"
port=5001
t=time.time()
try:
  r=socket.getaddrinfo(host, port)
  print(\"resolve ok\", r[:2], \"sec=\", round(time.time()-t,3))
except Exception as e:
  print(\"resolve ERR\", repr(e))
PY" || true
  echo

  echo "== write-api pods ==";
  kubectl -n "$NS" get pod -l app=write-api -o wide || true
  kubectl -n "$NS" get pod -l app=write-api,pool=burst -o wide || true
  echo

  echo "== write-api svc/endpoints ==";
  kubectl -n "$NS" get svc write-api -o wide || true
  kubectl -n "$NS" get endpoints write-api -o wide || true
  kubectl -n "$NS" get endpointslice -l kubernetes.io/service-name=write-api -o wide || true
  echo

  echo "== write-api logs (10m) ==";
  kubectl -n "$NS" logs -l app=write-api --since=10m --tail=200 || true
  kubectl -n "$NS" logs -l app=write-api,pool=burst --since=10m --tail=200 || true
  echo

  echo "== events (tail) ==";
  kubectl -n "$NS" get events --sort-by=.lastTimestamp | tail -n 160 || true
  echo

  echo "== HPA ==";
  kubectl -n "$NS" get hpa || true
  kubectl -n "$NS" describe hpa write-api-burst-primary-hpa 2>/dev/null || true
  kubectl -n "$NS" describe hpa write-api-burst-secondary-hpa 2>/dev/null || true
  echo

  echo "== KEDA ==";
  kubectl -n "$NS" get scaledobject 2>/dev/null || true
  kubectl -n "$NS" describe scaledobject worker-svc-sqs-primary 2>/dev/null || true
  kubectl -n "$NS" describe scaledobject worker-svc-sqs-secondary 2>/dev/null || true
  echo

  echo "== CoreDNS ==";
  kubectl -n kube-system get pod -l k8s-app=kube-dns -o wide 2>/dev/null || true
  kubectl -n kube-system logs -l k8s-app=kube-dns --since=15m --tail=250 2>/dev/null || true
} >"$OUT" 2>&1

echo "Wrote $OUT"
echo "Preview: sed -n \"1,220p\" \"$OUT\""

