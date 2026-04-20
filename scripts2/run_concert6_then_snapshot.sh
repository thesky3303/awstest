#!/usr/bin/env bash
set -eu
set -o pipefail 2>/dev/null || true

# v6 전용 진입점: 구현은 run_concert5_then_snapshot.sh 한 곳에만 둔다.
#
# 사용 예:
#   bash ../scripts/run_concert6_then_snapshot.sh --http-concurrency 2000 --duration-sec 10 --show-id 100 -n 1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
exec bash "$SCRIPT_DIR/run_concert5_then_snapshot.sh" "$@" -v6
