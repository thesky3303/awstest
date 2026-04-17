#!/usr/bin/env bash
set -eu
set -o pipefail 2>/dev/null || true

# ??踰덉쓽 紐낅졊?쇰줈:
# 1) tools-once Pod ?덉뿉??sqs_load_real_concert5.py ?ㅽ뻾
# 2) 醫낅즺 ???몄뒪??濡쒖뺄)?먯꽌 k8s ?ㅻ깄??異쒕젰
#
# ?ъ슜 ??
#   bash ../scripts/run_concert5_then_snapshot.sh --http-concurrency 2000 --duration-sec 10 --show-id 100 -n 1
#
# NOTE:
# - ?ㅻ깄?룹? "?몄뒪??kubectl 沅뚰븳"?쇰줈 李띿뼱???댁꽌, kubectl exec ?곗샂??諛뽰뿉???ㅽ뻾?쒕떎.

NS="${TICKETING_NAMESPACE:-ticketing}"
POD="${TOOLS_ONCE_POD:-tools-once}"
WRITE_API_BASE_URL="${WRITE_API_BASE_URL:-http://write-api.${NS}.svc.cluster.local:5001}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
SNAPSHOT_SH="${SNAPSHOT_SH:-$SCRIPT_DIR/k8s-snapshot-host.sh}"

kubectl -n "$NS" exec -it "$POD" -- sh -lc \
  "cd /work/ticketing-db/terraform && WRITE_API_BASE_URL='${WRITE_API_BASE_URL}' python3 ../scripts/sqs_load_real_concert5.py $*"

# py媛 ?ㅽ뙣?대룄(鍮꾩젙??醫낅즺/timeout) ?ㅻ깄?룹? 李띻퀬 ?띠쑝硫??꾨옒瑜?'|| true'濡?諛붽퓭????
bash "$SNAPSHOT_SH"

