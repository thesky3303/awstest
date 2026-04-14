#!/bin/sh

# If this file has CRLF line endings, normalize and re-exec.
# (This repo is commonly shared via HGFS/Windows, which can introduce \r.)
if command -v grep >/dev/null 2>&1; then
  if grep -q "$(printf '\r')" "$0" 2>/dev/null; then
    # Do NOT 'set -e' before this block; CRLF can break 'set' itself.
    if command -v tr >/dev/null 2>&1; then
      tmp="${TMPDIR:-/tmp}/redis-flush-cache.$$"
      (tr -d '\r' <"$0" >"$tmp") 2>/dev/null || {
        echo "ERROR: failed to normalize CRLF (tr) for $0" >&2
        exit 1
      }
      chmod +x "$tmp" 2>/dev/null || true
      exec sh "$tmp" "$@"
    fi
    if command -v sed >/dev/null 2>&1; then
      sed -i 's/\r$//' "$0" 2>/dev/null || true
      exec sh "$0" "$@"
    fi
    echo "ERROR: CRLF detected but neither 'tr' nor 'sed' is available to normalize." >&2
    exit 1
  fi
fi

set -eu

# Flush ONLY the read-cache logical Redis DB (default: 0) used by ticketing-was/read-api.
# Safe by design:
# - Uses ELASTICACHE_LOGICAL_DB_CACHE from ConfigMap (so it won't touch booking DB).
# - Runs redis-cli inside the cluster (no local redis-cli needed).
#
# Usage:
#   sh scripts/redis-flush-cache.sh
#
# Optional envs:
#   TICKETING_K8S_NS   (default: ticketing)
#   SECRET_NAME        (default: ticketing-secrets)
#   CONFIGMAP_NAME     (default: ticketing-config)

NS="${TICKETING_K8S_NS:-ticketing}"
SECRET_NAME="${SECRET_NAME:-ticketing-secrets}"
CONFIGMAP_NAME="${CONFIGMAP_NAME:-ticketing-config}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: missing required command: $1" >&2
    exit 1
  }
}

need kubectl
need base64

b64_decode() {
  # GNU/busybox: base64 -d, macOS: base64 -D
  if base64 --help 2>/dev/null | grep -q -- "-d"; then
    base64 -d
  else
    base64 -D
  fi
}

secret_get_decoded() {
  key="$1"
  b="$(kubectl -n "$NS" get secret "$SECRET_NAME" -o "jsonpath={.data.${key}}" 2>/dev/null || true)"
  if [ -z "${b}" ]; then
    printf '%s' ""
    return 0
  fi
  printf '%s' "$b" | b64_decode
}

cm_get() {
  key="$1"
  kubectl -n "$NS" get configmap "$CONFIGMAP_NAME" -o "jsonpath={.data.${key}}" 2>/dev/null || true
}

REDIS_HOST="$(secret_get_decoded ELASTICACHE_PRIMARY_ENDPOINT)"
if [ -z "${REDIS_HOST}" ]; then
  REDIS_HOST="$(secret_get_decoded REDIS_HOST)"
fi
if [ -z "${REDIS_HOST}" ]; then
  echo "ERROR: neither ELASTICACHE_PRIMARY_ENDPOINT nor REDIS_HOST found in secret ${SECRET_NAME} (ns=${NS})" >&2
  exit 1
fi

REDIS_PORT="$(cm_get REDIS_PORT)"
REDIS_PORT="${REDIS_PORT:-6379}"

CACHE_DB="$(cm_get ELASTICACHE_LOGICAL_DB_CACHE)"
CACHE_DB="${CACHE_DB:-0}"

echo "Flushing Redis cache DB (ns=${NS} host=${REDIS_HOST} port=${REDIS_PORT} db=${CACHE_DB})"

# Run redis-cli inside the cluster, then delete the pod automatically.
kubectl -n "$NS" run redis-cli-flush-cache \
  --rm -i --restart=Never \
  --image=redis:7-alpine \
  --command -- sh -lc \
  "redis-cli -h '${REDIS_HOST}' -p '${REDIS_PORT}' -n '${CACHE_DB}' FLUSHDB"

echo "Done."
