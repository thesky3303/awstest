#!/usr/bin/env python3
"""
콘서트 "입장 대기열(Waiting Room)" 시연용 부하 생성기 v3.

의도:
- 100만 접속(대기열 진입) / 3만 예매 시도(permit 받은 뒤 커밋) 같은 "연출"을 재현한다.
- DB 처리(SQS/worker) 대기열과 분리된 "입장권(permit)" 대기열을 보여준다.
- permit 없이 커밋하면 429로 막히는 것을 통해 '새치기 불가'를 시연한다.

예:
  WRITE_API_BASE_URL="http://write-api.ticketing.svc.cluster.local:5001" \
  python3 ../scripts/sqs_load_real_concert3.py --show-id 8 -E 100 -T 3

여기서 E/T는 기본 단위가 100명:
-E 10  = 1000명이 대기열 진입
-T 3   = 300명이 예매(커밋) 시도
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from pathlib import Path
from typing import Optional, Set, Tuple

import http_booking_client as http_w

DEFAULT_CONCERT_TITLE = "2026 봄 페스티벌 LIVE - 5만석"


def _terraform_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "terraform"


def _terraform_output_raw(name: str) -> str:
    tf_dir = _terraform_dir()
    if not tf_dir.is_dir():
        return ""
    try:
        proc = subprocess.run(
            ["terraform", "output", "-raw", name],
            cwd=str(tf_dir),
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return ""
    if proc.returncode != 0:
        return ""
    return proc.stdout.strip()


def _resolve_redis_host() -> str:
    h = (os.getenv("ELASTICACHE_PRIMARY_ENDPOINT") or "").strip()
    if h:
        return h
    h = (os.getenv("REDIS_HOST") or "").strip()
    if h:
        return h
    ep = _terraform_output_raw("elasticache_primary_endpoint") or _terraform_output_raw("redis_endpoint")
    if ep:
        return ep
    raise SystemExit("REDIS_HOST/ELASTICACHE_PRIMARY_ENDPOINT 미설정이며 terraform output도 실패했습니다.")


def _resolve_redis_port() -> int:
    raw = (os.getenv("REDIS_PORT") or os.getenv("ELASTICACHE_PORT") or "").strip()
    if raw:
        try:
            return int(raw, 10)
        except Exception:
            pass
    return 6379


def _resolve_redis_db_booking(cli_db: Optional[int]) -> int:
    if cli_db is not None:
        try:
            return max(0, min(15, int(cli_db)))
        except Exception:
            return 1
    raw = (os.getenv("ELASTICACHE_LOGICAL_DB_BOOKING") or "").strip()
    if raw:
        try:
            return max(0, min(15, int(raw, 10)))
        except Exception:
            return 1
    return 1


def _resolve_redis_db_cache(cli_db: Optional[int]) -> int:
    if cli_db is not None:
        try:
            return max(0, min(15, int(cli_db)))
        except Exception:
            return 0
    raw = (os.getenv("ELASTICACHE_LOGICAL_DB_CACHE") or "").strip()
    if raw:
        try:
            return max(0, min(15, int(raw, 10)))
        except Exception:
            return 0
    return 0


def _redis_connect(redis_db: int):
    try:
        import redis  # type: ignore
    except ImportError:
        print("필요: pip install redis", file=sys.stderr)
        raise
    host = _resolve_redis_host()
    port = _resolve_redis_port()
    return redis.Redis(host=host, port=port, db=int(redis_db), decode_responses=True)


def _wr_keys(kind: str, entity_id: int) -> dict:
    k = str(kind).strip().lower()
    eid = int(entity_id)
    return {
        "enq": f"wr:{k}:{eid}:enq",
        "done": f"wr:{k}:{eid}:done",
        "clock": f"wr:{k}:{eid}:clock",
        "control": f"wr:{k}:{eid}:control",
        "observe": f"wr:{k}:{eid}:observe",
        "rps_glob": f"wr:{k}:{eid}:rps:*",
    }


def _reset_waiting_room(*, r, kind: str, entity_id: int) -> dict:
    """
    Waiting Room 순번/게이트 카운터는 TTL이 없어 테스트 누적 시 seq가 2만/3만으로 튈 수 있다.
    데모 스크립트 실행 전 해당 entity(show_id)의 카운터를 리셋해 "이번 런의 대기열"만 보이게 한다.
    """
    keys = _wr_keys(kind, entity_id)
    deleted = 0
    try:
        deleted += int(r.delete(keys["enq"], keys["done"], keys["clock"], keys["control"], keys["observe"]) or 0)
    except Exception:
        pass

    # rps 버킷 키 정리 (scan_iter는 단일 노드 Redis에서 충분히 안전하게 동작)
    rps_deleted = 0
    try:
        batch = []
        for k in r.scan_iter(match=keys["rps_glob"], count=500):
            batch.append(k)
            if len(batch) >= 500:
                rps_deleted += int(r.delete(*batch) or 0)
                batch = []
        if batch:
            rps_deleted += int(r.delete(*batch) or 0)
    except Exception:
        rps_deleted = 0

    return {"wr_deleted_fixed": deleted, "wr_deleted_rps": rps_deleted}


def _reset_concert_seat_state(*, r, show_id: int) -> dict:
    """
    콘서트 좌석/잔여 연출용 Redis 키 리셋.
    - confirmed set(회색 가드) / hold set(주황) / pending 카운터 / show snapshot 등을 지워
      시연을 매번 "깨끗한 상태"에서 시작하게 한다.
    주의: 운영 환경에서 무작정 호출하면 확정 좌석 가드가 풀릴 수 있으니 데모 전용.
    """
    sid = int(show_id)
    keys_fixed = [
        f"concert:confirmed:{sid}:v1",
        f"concert:hold:{sid}:v1",
        f"concert:show:{sid}:hold_rev:v1",
        f"concert:show:{sid}:pending:v1",
        f"concert:show:{sid}:read:v2",
    ]
    deleted_fixed = 0
    try:
        deleted_fixed = int(r.delete(*keys_fixed) or 0)
    except Exception:
        deleted_fixed = 0

    # seat hold 키는 개수가 많을 수 있어 scan_iter로 정리
    deleted_seat_keys = 0
    try:
        batch = []
        pat = f"concert:seat:{sid}:*:hold:v1"
        for k in r.scan_iter(match=pat, count=1000):
            batch.append(k)
            if len(batch) >= 1000:
                deleted_seat_keys += int(r.delete(*batch) or 0)
                batch = []
        if batch:
            deleted_seat_keys += int(r.delete(*batch) or 0)
    except Exception:
        deleted_seat_keys = 0

    # holdmeta는 booking_ref 기준이라 전체 패턴으로 정리(필요 시)
    deleted_meta = 0
    try:
        batch = []
        pat = "concert:holdmeta:*:v1"
        for k in r.scan_iter(match=pat, count=1000):
            batch.append(k)
            if len(batch) >= 1000:
                deleted_meta += int(r.delete(*batch) or 0)
                batch = []
        if batch:
            deleted_meta += int(r.delete(*batch) or 0)
    except Exception:
        deleted_meta = 0

    return {
        "concert_deleted_fixed": deleted_fixed,
        "concert_deleted_seat_keys": deleted_seat_keys,
        "concert_deleted_holdmeta": deleted_meta,
        "redis_db": int(getattr(r, "connection_pool", None).connection_kwargs.get("db", -1)) if hasattr(r, "connection_pool") else None,
    }

def _resolve_db_writer_host() -> str:
    h = (os.getenv("DB_WRITER_HOST") or "").strip()
    if h:
        return h
    ep = _terraform_output_raw("rds_writer_endpoint")
    if ep:
        return ep
    raise SystemExit("DB_WRITER_HOST 미설정이며 terraform output도 실패했습니다.")


def _resolve_db_name(cli_db: Optional[str]) -> str:
    if cli_db is not None and str(cli_db).strip():
        return str(cli_db).strip()
    env = (os.getenv("DB_NAME") or "").strip()
    if env:
        return env
    return "ticketing"


def _db_connect(db_name: str):
    try:
        import pymysql
        from pymysql.cursors import DictCursor
    except ImportError:
        print("필요: pip install pymysql", file=sys.stderr)
        raise

    host = _resolve_db_writer_host()
    port = int(os.getenv("DB_PORT", "3306"))
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "")
    return pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=db_name,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=True,
    )


def _booked_seat_pairs(cur, show_id: int) -> Set[Tuple[int, int]]:
    cur.execute(
        """
        SELECT seat_row_no, seat_col_no
        FROM concert_booking_seats
        WHERE show_id = %s AND status = 'ACTIVE'
        """,
        (show_id,),
    )
    return {(int(r["seat_row_no"]), int(r["seat_col_no"])) for r in cur.fetchall()}


def _collect_free_seat_keys(
    seat_rows: int,
    seat_cols: int,
    booked: Set[Tuple[int, int]],
    limit: int,
) -> list[str]:
    out: list[str] = []
    for r in range(1, seat_rows + 1):
        for c in range(1, seat_cols + 1):
            if (r, c) in booked:
                continue
            out.append(f"{r}-{c}")
            if len(out) >= limit:
                return out
    return out


def _pick_show(cur, show_id: Optional[int], concert_title: str):
    if show_id is not None:
        cur.execute(
            """
            SELECT cs.show_id, cs.concert_id, cs.show_date, cs.seat_rows, cs.seat_cols,
                   cs.total_count, cs.remain_count, cs.status, c.title AS concert_title
            FROM concert_shows cs
            INNER JOIN concerts c ON c.concert_id = cs.concert_id
            WHERE cs.show_id = %s
              AND cs.show_date >= NOW()
            """,
            (show_id,),
        )
        row = cur.fetchone()
        if not row:
            raise SystemExit(f"show_id={show_id} 없음 또는 show_date가 지났습니다.")
        return row
    cur.execute(
        """
        SELECT cs.show_id, cs.concert_id, cs.show_date, cs.seat_rows, cs.seat_cols,
               cs.total_count, cs.remain_count, cs.status, c.title AS concert_title
        FROM concert_shows cs
        INNER JOIN concerts c ON c.concert_id = cs.concert_id
        WHERE c.title = %s
          AND UPPER(COALESCE(cs.status, '')) = 'OPEN'
          AND cs.show_date >= NOW()
        ORDER BY cs.show_date ASC
        LIMIT 1
        """,
        (concert_title,),
    )
    row = cur.fetchone()
    if not row:
        raise SystemExit("조건에 맞는 회차가 없습니다. --show-id로 지정하세요.")
    return row


def parse_args():
    p = argparse.ArgumentParser(description="콘서트 Waiting Room 시연용 v3")
    p.add_argument("--show-id", type=int, default=None)
    p.add_argument("--concert-title", default=DEFAULT_CONCERT_TITLE)
    p.add_argument("--write-api-base", default=None, metavar="URL")
    p.add_argument("--db-name", default=None, metavar="NAME")
    p.add_argument("--redis-db-booking", type=int, default=None, metavar="N", help="(레거시) local redis 접속 시 booking 논리 DB index(기본 env/1)")
    p.add_argument("--redis-db-cache", type=int, default=None, metavar="N", help="(레거시) local redis 접속 시 cache 논리 DB index(기본 env/0)")
    p.add_argument(
        "--reset-wr",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="시작 시 해당 show_id Waiting Room 카운터(wr:concert:{id}:*)를 리셋(기본 true)",
    )
    p.add_argument(
        "--reset-concert-redis",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="시작 시 해당 show_id 콘서트 좌석/잔여 Redis 키를 **write-api 기준**으로 리셋(confirmed/hold/pending/snapshot/seat keys) (기본 true)",
    )
    p.add_argument(
        "-E",
        "--entrants",
        type=int,
        required=True,
        help="대기열 진입 인원(단위=--unit). 예: -E 1000 => 100만",
    )
    p.add_argument(
        "-T",
        "--tickets",
        type=int,
        required=True,
        help="예매 시도 인원(단위=--unit). 예: -T 30 => 3만",
    )
    p.add_argument("--unit", type=int, default=100, help="인원 단위(기본 100=100명)")
    p.add_argument("--user-base", type=int, default=1, help="가상 유저 id 시작값")
    p.add_argument("--enter-workers", type=int, default=200, help="대기열 진입 병렬 워커(기본 200)")
    p.add_argument("--ticket-workers", type=int, default=100, help="예매 시도 병렬 워커(기본 100)")
    p.add_argument("--timeout", type=float, default=20.0, help="HTTP 타임아웃(초)")
    p.add_argument("--admit-timeout", type=float, default=600.0, help="입장 허가(permit) 대기 타임아웃(초)")
    p.add_argument("--progress-every", type=int, default=5000)
    p.add_argument(
        "--read-api-base",
        default=os.getenv("READ_API_BASE_URL", "").strip() or "http://read-api.ticketing.svc.cluster.local:5000",
        metavar="URL",
        help="read-api 베이스 URL(주황 hold 좌석 관측용). 기본: env READ_API_BASE_URL 또는 클러스터 서비스 5000",
    )
    p.add_argument(
        "--observe-holds-sec",
        type=float,
        default=0.0,
        help="0보다 크면 실행 중/직후 read-api booking-holds를 폴링해 hold_count/샘플 좌석을 출력(주황 표시 확인용)",
    )
    p.add_argument(
        "--observe-interval-sec",
        type=float,
        default=0.5,
        help="--observe-holds-sec 사용 시 폴링 간격(초, 기본 0.5)",
    )
    p.add_argument(
        "--wait",
        dest="wait",
        action="store_true",
        help="commit이 QUEUED된 booking_ref를 OK/FAIL까지 폴링해 백그라운드 처리(좌석 확정)를 눈으로 확인",
    )
    p.add_argument(
        "--no-wait",
        dest="wait",
        action="store_false",
        help="commit 접수(QUEUED)까지만 수행(기존 동작)",
    )
    p.set_defaults(wait=True)
    p.add_argument(
        "--poll-timeout",
        type=float,
        default=float(os.getenv("BURST_POLL_TIMEOUT", "600") or 600),
        help="--wait 사용 시 booking status 폴링 타임아웃(초, 기본 600)",
    )
    p.add_argument(
        "--poll-workers",
        type=int,
        default=int(os.getenv("BURST_POLL_WORKERS", "50") or 50),
        help="--wait 사용 시 폴링 병렬 워커 수(기본 50)",
    )
    p.add_argument(
        "--wr-drain-after",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="스크립트 종료 시 waiting-room backlog를 0으로 드레인해 다음 진입에 대기열이 남지 않게 함(기본 true)",
    )
    p.add_argument(
        "--wr-drain-rate",
        type=int,
        default=5000,
        help="드레인 시 MANUAL admit_rate_per_sec 값(기본 5000). backlog가 커도 빠르게 0으로 만들기 위함",
    )
    p.add_argument(
        "--wr-drain-timeout",
        type=float,
        default=60.0,
        help="드레인 최대 대기(초). 초과 시 AUTO 복원만 수행하고 종료(기본 60초)",
    )
    p.add_argument(
        "--wr-drain-restore-auto",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="드레인 후 waiting-room control을 AUTO로 복원(기본 true)",
    )
    return p.parse_args()


def main():
    args = parse_args()
    unit = max(1, int(args.unit))
    entrants = max(0, int(args.entrants)) * unit
    tickets = max(0, int(args.tickets)) * unit
    # tickets가 entrants보다 클 수 있다.
    # 예: -E 1(=1000) -T 3(=3000) 처럼 "대기열 진입은 1000명" + "예매 시도는 3000명" 연출을 위해,
    # ticket phase에서 queue_ref를 순환 사용한다.

    write_base = http_w.resolve_write_api_base(args.write_api_base)
    read_base = str(args.read_api_base or "").strip().rstrip("/")

    # show 선택(DB에서)
    dbn = _resolve_db_name(args.db_name)
    conn = _db_connect(dbn)
    try:
        with conn.cursor() as cur:
            show = _pick_show(cur, args.show_id, args.concert_title)
            show_id = int(show["show_id"])
            seat_rows = int(show.get("seat_rows") or 0) or 1
            seat_cols = int(show.get("seat_cols") or 0) or 1
            seat_rows = max(1, seat_rows)
            seat_cols = max(1, seat_cols)
            remain = int(show.get("remain_count") or 0)

            # 실제 "확 줄어드는" 효과를 보려면 성공률이 높아야 하므로,
            # DB에서 빈 좌석을 tickets만큼(또는 remain만큼) 확보한다.
            cap = min(max(0, tickets), max(0, remain))
            booked = _booked_seat_pairs(cur, show_id)
            free_seats = _collect_free_seat_keys(seat_rows, seat_cols, booked, cap)
    finally:
        conn.close()

    # tickets가 remain/빈좌석보다 크면, 실제 커밋 시도는 확보된 좌석 수로 제한한다.
    tickets_effective = min(tickets, len(free_seats))

    t0 = time.monotonic()

    # 0) WR 카운터 리셋(이전 테스트 누적 seq로 대기열이 2만/3만으로 튀는 문제 방지)
    if bool(args.reset_wr):
        # 서버가 실제로 쓰는 Redis(Secret)를 확실히 리셋하기 위해 write-api reset 엔드포인트를 우선 사용
        stat = None
        try:
            code, j = http_w.concert_waiting_room_reset(write_base, show_id, timeout=min(10.0, float(args.timeout)))
            if int(code or 0) == 200 and isinstance(j, dict) and j.get("ok"):
                stat = {"via": "write_api", **j}
        except Exception:
            stat = None
        if stat is None:
            # 폴백: tools-once에서 직접 Redis 접속(환경/terraform output 불일치 시 효과 없을 수 있음)
            rdb = _resolve_redis_db_booking(args.redis_db_booking)
            rr = _redis_connect(rdb)
            local_stat = _reset_waiting_room(r=rr, kind="concert", entity_id=show_id)
            stat = {"via": "local_redis", "redis_db": rdb, **local_stat}
        print(f"wr_reset show_id={show_id} {stat}", file=sys.stderr)

    # 0.5) 콘서트 좌석 상태 Redis 리셋(confirmed/hold/pending/snapshot) — 데모에서 remain 0/중복좌석을 방지
    if bool(args.reset_concert_redis):
        try:
            code2, j2 = http_w.concert_redis_reset(write_base, show_id, timeout=min(10.0, float(args.timeout)))
            if int(code2 or 0) == 200 and isinstance(j2, dict) and j2.get("ok"):
                stat2 = {"via": "write_api", **j2}
            else:
                stat2 = {"via": "write_api", "ok": False, "http": int(code2 or 0), "body": j2}
        except Exception:
            # 서버 기준: write-api가 실패하면 로컬에서 Redis를 직접 지우지 않는다(환경 불일치로 더 큰 혼란 가능).
            stat2 = {"via": "write_api", "ok": False, "error": "request_failed"}
        print(f"concert_redis_reset show_id={show_id} {stat2}", file=sys.stderr)

    # (옵션) 주황(hold) 좌석 관측: read-api booking-holds 폴링
    observe_sec = max(0.0, float(args.observe_holds_sec or 0.0))
    observe_iv = max(0.1, float(args.observe_interval_sec or 0.5))
    cid_for_read = 0
    try:
        cid_for_read = int(show.get("concert_id") or 0)
    except Exception:
        cid_for_read = 0

    def _observe_holds_loop(label: str):
        if observe_sec <= 0 or cid_for_read <= 0 or show_id <= 0 or not read_base:
            return
        deadline = time.monotonic() + observe_sec
        last_rev = None
        max_hc = 0
        max_sample: list[str] = []
        url = f"{read_base}/api/read/concert/{cid_for_read}/booking-holds?show_id={show_id}"
        url = urllib.parse.quote(url, safe=":/?&=%")
        print(f"[observe] {label} url={url}", file=sys.stderr)
        while time.monotonic() < deadline:
            try:
                code, j = http_w.request_json(url, "GET", None, timeout=min(5.0, timeout))
            except Exception:
                time.sleep(observe_iv)
                continue
            if int(code or 0) != 200 or not isinstance(j, dict) or not j.get("ok"):
                time.sleep(observe_iv)
                continue
            rev = j.get("hold_rev")
            hc = j.get("hold_count")
            hs = j.get("hold_seats") if isinstance(j.get("hold_seats"), list) else []
            try:
                hc_i = int(hc or 0)
            except Exception:
                hc_i = 0
            if hc_i > max_hc:
                max_hc = hc_i
                max_sample = [str(x) for x in hs[:10]]
            # rev가 변했거나, hold가 1개라도 보이면 무조건 출력(순간 홀드 관측 목적)
            if (rev != last_rev) or (hc_i > 0):
                last_rev = rev
                sample = [str(x) for x in hs[:10]]
                print(f"[observe] hold_rev={rev} hold_count={hc_i} sample={sample}", file=sys.stderr)
            time.sleep(observe_iv)
        print(f"[observe] {label} done max_hold_count={max_hc} max_sample={max_sample}", file=sys.stderr)

    # 1) entrants 만큼 waiting-room enter (queue_ref만 확보; 폴링은 티켓 시도자만 한다)
    # NOTE: 실제 트래픽처럼 보이게 enter와 ticket을 동시에 진행한다.
    enter_workers = max(1, int(args.enter_workers))
    timeout = max(1.0, float(args.timeout))
    progress_every = max(1, int(args.progress_every))

    queue_refs: list[str] = [""] * entrants  # enter 결과를 idx 위치에 채움(원본 유지)
    # ticket 단계에서 실제로 채워진 queue_ref만 안전하게 고르기 위한 리스트
    # IMPORTANT: permit_token은 (show_id, user_id)에 바인딩되므로 queue_ref를 만든 user_id로만 commit해야 한다.
    queue_refs_ready: list[tuple[int, str]] = []
    refs_lock = Lock()

    def _enter_one(i: int):
        uid = int(args.user_base) + i
        # 네트워크/Pod 흔들림(refused 등)이 있어도 전체 테스트가 죽지 않게 재시도
        deadline = time.monotonic() + 15.0
        last_code = 0
        last_ref = ""
        while time.monotonic() < deadline:
            try:
                code, j = http_w.concert_waiting_room_enter(
                    write_base, uid, show_id, timeout=min(10.0, timeout)
                )
                last_code = int(code or 0)
                last_ref = str((j or {}).get("queue_ref") or "")
                ok = (last_code == 200 and (j or {}).get("ok") and bool(last_ref))
                if ok:
                    return i, True, last_code, last_ref
            except Exception:
                pass
            time.sleep(0.5)
        return i, False, last_code or 0, last_ref

    ok_enter = 0
    fail_enter = 0
    t_enter0 = time.monotonic()

    # 2) tickets 만큼: ADMITTED까지 폴링 → permit으로 commit 시도
    # 좌석은 DB에서 확보한 free_seats를 사용해 커밋 성공률을 높인다(=remain_count가 한 번에 확 줄어드는 연출).
    ticket_workers = max(1, int(args.ticket_workers))
    admit_timeout = max(1.0, float(args.admit_timeout))

    t_ticket0 = time.monotonic()
    ok_commit = 0
    fail_commit = 0
    ok_admit = 0
    fail_admit = 0
    accepted_refs: list[str] = []
    refs_out_lock = Lock()

    def _ticket_one(i: int):
        if entrants <= 0:
            return False, "NO_ENTRANTS", ""
        if i >= tickets_effective:
            return False, "SKIP_NO_FREE_SEAT", ""
        # enter가 동시에 진행되므로, ref가 최소 1개는 준비될 때까지 잠깐 대기
        deadline_ref = time.monotonic() + 30.0
        qref = ""
        uid_for_ref = 0
        while time.monotonic() < deadline_ref:
            with refs_lock:
                ready = len(queue_refs_ready)
                if ready > 0:
                    uid_for_ref, qref = queue_refs_ready[i % ready]
            if qref:
                break
            time.sleep(0.05)
        if not qref:
            return False, "NO_QREF_READY", ""
        if uid_for_ref <= 0:
            return False, "NO_UID_FOR_QREF", ""
        deadline = time.monotonic() + admit_timeout
        permit = ""
        last_pos = 0
        while time.monotonic() < deadline:
            try:
                _, st = http_w.concert_waiting_room_status(
                    write_base, qref, timeout=min(10.0, timeout)
                )
            except Exception:
                # write-api 순간 refused/네트워크 흔들림: 폴링 재시도
                time.sleep(0.6)
                continue
            if isinstance(st, dict) and st.get("status") == "ADMITTED" and st.get("permit_token"):
                permit = str(st.get("permit_token"))
                break
            try:
                q = (st or {}).get("queue") if isinstance(st, dict) else None
                last_pos = int((q or {}).get("position") or 0)
            except Exception:
                last_pos = 0
            time.sleep(0.4)
        if not permit:
            return False, f"ADMIT_TIMEOUT(pos={last_pos})", ""

        seat_key = free_seats[i]
        # 커밋도 순간 refused를 견디도록 짧게 재시도
        commit_deadline = time.monotonic() + 15.0
        last_code = 0
        last_err = ""
        while time.monotonic() < commit_deadline:
            try:
                code, j = http_w.request_json(
                    f"{write_base}/api/write/concerts/booking/commit",
                    "POST",
                    {"user_id": uid_for_ref, "show_id": show_id, "seats": [seat_key], "permit_token": permit},
                    timeout=timeout,
                )
                last_code = int(code or 0)
                if last_code == 200 and (j or {}).get("ok") and str((j or {}).get("code") or "") == "QUEUED":
                    ref = str((j or {}).get("booking_ref") or "")
                    return True, "QUEUED", ref
                # 논리 실패(중복좌석 등)는 재시도해도 의미 없으므로 바로 반환
                return False, str((j or {}).get("code") or f"HTTP_{last_code}"), ""
            except Exception as e:
                last_err = repr(e)
                time.sleep(0.6)
        return False, f"COMMIT_NET_FAIL(http={last_code} err={last_err[:120]})", ""

    # enter + ticket 동시 실행
    with ThreadPoolExecutor(max_workers=(enter_workers + ticket_workers)) as pool:
        fut_observe = None
        if observe_sec > 0 and cid_for_read > 0:
            fut_observe = pool.submit(_observe_holds_loop, "during")
        futs_enter = [pool.submit(_enter_one, i) for i in range(entrants)]
        futs_ticket = [pool.submit(_ticket_one, i) for i in range(tickets_effective)]

        done_enter = 0
        done_ticket = 0

        for fut in as_completed([*futs_enter, *futs_ticket]):
            res = fut.result()
            # enter 결과는 4-tuple, ticket 결과는 2-tuple
            if isinstance(res, tuple) and len(res) == 4:
                idx, ok, code, ref = res
                done_enter += 1
                if ok:
                    ok_enter += 1
                    queue_refs[idx] = ref
                    with refs_lock:
                        queue_refs_ready.append((int(args.user_base) + int(idx), ref))
                else:
                    fail_enter += 1
                    if fail_enter <= 5:
                        print(f"ENTER_FAIL http={code} i={idx}", file=sys.stderr)
                if done_enter % progress_every == 0 or done_enter == entrants:
                    elapsed = max(0.001, time.monotonic() - t_enter0)
                    print(
                        f"enter: {done_enter}/{entrants} ok={ok_enter} fail={fail_enter} qps={done_enter/elapsed:.1f}",
                        file=sys.stderr,
                    )
            else:
                ok, code, bref = res
                done_ticket += 1
                if ok:
                    ok_commit += 1
                    ok_admit += 1
                    if bref:
                        with refs_out_lock:
                            accepted_refs.append(bref)
                else:
                    if str(code).startswith("ADMIT_") or str(code).startswith("ADMIT_TIMEOUT"):
                        fail_admit += 1
                    else:
                        fail_commit += 1
                if done_ticket % max(1, (progress_every // 5)) == 0 or done_ticket == tickets:
                    elapsed2 = max(0.001, time.monotonic() - t_ticket0)
                    print(
                        f"tickets: {done_ticket}/{tickets_effective} admitted_ok={ok_admit} admit_fail={fail_admit} commit_ok={ok_commit} commit_fail={fail_commit} qps={done_ticket/elapsed2:.1f}",
                        file=sys.stderr,
                    )

    enter_sec = time.monotonic() - t_enter0
    ticket_sec = time.monotonic() - t_ticket0

    # 관측을 "종료 직후"에도 조금 더(옵션)
    if observe_sec > 0 and cid_for_read > 0:
        _observe_holds_loop("after")

    # 2.5) (옵션) QUEUED -> OK까지 폴링: worker 백그라운드 처리가 '진짜로' 적용되는지 확인
    polled_ok = 0
    polled_fail = 0
    poll_sec = 0.0
    if bool(args.wait) and accepted_refs:
        poll_workers = max(1, int(args.poll_workers))
        poll_timeout = max(1.0, float(args.poll_timeout))
        t_poll0 = time.monotonic()

        def _poll_one(ref: str):
            result = http_w.poll_booking_status(
                write_base,
                ref,
                kind="concert",
                timeout_sec=poll_timeout,
                interval_sec=0.4,
            )
            ok2 = bool(isinstance(result, dict) and result.get("ok") is True and str(result.get("code") or "") == "OK")
            return ok2, result

        inflight = len(accepted_refs)
        print(f"queued: {inflight}개 — worker 백그라운드 처리 완료(OK) 대기/진행 중...", file=sys.stderr)
        with ThreadPoolExecutor(max_workers=poll_workers) as pool2:
            futs2 = [pool2.submit(_poll_one, r) for r in accepted_refs]
            done2 = 0
            for fut in as_completed(futs2):
                ok2, result = fut.result()
                done2 += 1
                if ok2:
                    polled_ok += 1
                else:
                    polled_fail += 1
                    if polled_fail <= 5:
                        code = (result or {}).get("code") if isinstance(result, dict) else None
                        status = (result or {}).get("status") if isinstance(result, dict) else None
                        print(f"POLL_FAIL code={code} status={status}", file=sys.stderr)
                if done2 % max(1, (progress_every // 5)) == 0 or done2 == inflight:
                    elapsed2 = max(0.001, time.monotonic() - t_poll0)
                    print(
                        f"poll: {done2}/{inflight} ok={polled_ok} fail={polled_fail} qps={done2/elapsed2:.1f}",
                        file=sys.stderr,
                    )
        poll_sec = time.monotonic() - t_poll0

    # 3) (옵션) WR backlog 드레인: 다음 진입에서 대기열이 남지 않게 한다.
    drained = False
    drain_stat = {}
    if bool(args.wr_drain_after) and show_id > 0:
        drain_rate = max(1, int(args.wr_drain_rate))
        drain_timeout = max(1.0, float(args.wr_drain_timeout))
        try:
            http_w.concert_waiting_room_control(
                write_base,
                show_id,
                mode="MANUAL",
                enabled=True,
                admit_rate_per_sec=drain_rate,
                message="",
                timeout=min(10.0, timeout),
            )
        except Exception:
            pass
        deadline_drain = time.monotonic() + drain_timeout
        last = None
        while time.monotonic() < deadline_drain:
            try:
                _, m = http_w.concert_waiting_room_metrics(write_base, show_id, timeout=min(10.0, timeout))
                last = m if isinstance(m, dict) else None
                if isinstance(last, dict) and last.get("ok") and int(last.get("backlog") or 0) <= 0:
                    drained = True
                    drain_stat = last
                    break
            except Exception:
                pass
            time.sleep(0.8)
        if drained and isinstance(last, dict):
            drain_stat = last
        if bool(args.wr_drain_restore_auto):
            try:
                http_w.concert_waiting_room_control(
                    write_base,
                    show_id,
                    mode="AUTO",
                    enabled=True,
                    admit_rate_per_sec=None,
                    message="",
                    timeout=min(10.0, timeout),
                )
            except Exception:
                pass

    summary = {
        "show_id": show_id,
        "concert_id": int(show.get("concert_id") or 0),
        "concert_title": show.get("concert_title"),
        "entrants": entrants,
        "tickets_attempted": tickets,
        "tickets_effective": tickets_effective,
        "remain_at_start": int(show.get("remain_count") or 0),
        "waiting_room_enter_ok": ok_enter,
        "waiting_room_enter_fail": fail_enter,
        "waiting_room_enter_sec": round(enter_sec, 3),
        "permit_admitted_ok_est": ok_admit,
        "permit_admitted_fail_est": fail_admit,
        "commit_queued_ok": ok_commit,
        "commit_fail": fail_commit,
        "ticket_phase_sec": round(ticket_sec, 3),
        "wait": bool(args.wait),
        "polled_ok": int(polled_ok),
        "polled_fail": int(polled_fail),
        "poll_sec": round(poll_sec, 3),
        "total_sec": round(time.monotonic() - t0, 3),
        "wr_drain_after": bool(args.wr_drain_after),
        "wr_drained": bool(drained),
        "wr_drain_stat": drain_stat or None,
        "note": "commit_queued_ok는 '점유/접수(QUEUED)'이며 최종 확정(OK/FAIL)은 worker 처리 후 status에서 결정됨",
    }
    # 사용자가 바로 확인할 수 있게 read-api 조회 경로를 함께 제공(베이스는 클러스터/환경별로 다름).
    try:
        cid = int(show.get("concert_id") or 0)
    except Exception:
        cid = 0
    if cid > 0 and show_id > 0:
        summary["read_api_paths"] = {
            "booking_holds": f"/api/read/concert/{cid}/booking-holds?show_id={show_id}",
            "booking_bootstrap_one": f"/api/read/concert/{cid}/booking-bootstrap?show_id={show_id}",
        }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

