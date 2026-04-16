import logging
import random
import time
from typing import Any, Dict

import pymysql

from cache.redis_client import redis_client
from config import (
    SYNC_DB_WAIT_INITIAL_BACKOFF_MS,
    SYNC_DB_WAIT_MAX_BACKOFF_MS,
    SYNC_DB_WAIT_MAX_SEC,
)
from db import get_db_connection

log = logging.getLogger(__name__)


_SQL_SYNC_SCHEDULES_REMAIN = """
UPDATE schedules s
LEFT JOIN (
  SELECT schedule_id, COUNT(*) AS reserved_cnt
  FROM booking_seats
  WHERE UPPER(COALESCE(status,'')) = 'ACTIVE'
    AND COALESCE(booking_id, 0) > 0
  GROUP BY schedule_id
) b ON b.schedule_id = s.schedule_id
SET
  s.remain_count = GREATEST(0, s.total_count - COALESCE(b.reserved_cnt, 0)),
  s.status = CASE
      WHEN (s.total_count - COALESCE(b.reserved_cnt, 0)) <= 0 THEN 'CLOSED'
      ELSE 'OPEN'
  END
WHERE
  COALESCE(b.reserved_cnt, 0) <> 0
  OR s.remain_count <> GREATEST(0, s.total_count - COALESCE(b.reserved_cnt, 0))
  OR COALESCE(s.status, '') <> CASE
      WHEN (s.total_count - COALESCE(b.reserved_cnt, 0)) <= 0 THEN 'CLOSED'
      ELSE 'OPEN'
  END
"""

_SQL_SYNC_CONCERT_SHOWS_REMAIN = """
UPDATE concert_shows cs
LEFT JOIN (
  SELECT show_id, COUNT(*) AS reserved_cnt
  FROM concert_booking_seats
  WHERE UPPER(COALESCE(status,'')) = 'ACTIVE'
    AND COALESCE(booking_id, 0) > 0
  GROUP BY show_id
) b ON b.show_id = cs.show_id
SET
  cs.remain_count = GREATEST(0, cs.total_count - COALESCE(b.reserved_cnt, 0)),
  cs.status = CASE
      WHEN (cs.total_count - COALESCE(b.reserved_cnt, 0)) <= 0 THEN 'CLOSED'
      ELSE 'OPEN'
  END
WHERE
  COALESCE(b.reserved_cnt, 0) <> 0
  OR cs.remain_count <> GREATEST(0, cs.total_count - COALESCE(b.reserved_cnt, 0))
  OR COALESCE(cs.status, '') <> CASE
      WHEN (cs.total_count - COALESCE(b.reserved_cnt, 0)) <= 0 THEN 'CLOSED'
      ELSE 'OPEN'
  END
"""


_SQL_SELECT_CONCERT_SHOWS_REMAIN_DRIFT = """
SELECT
  cs.show_id AS show_id,
  GREATEST(0, cs.total_count - COALESCE(b.reserved_cnt, 0)) AS new_remain_count
FROM concert_shows cs
LEFT JOIN (
  SELECT show_id, COUNT(*) AS reserved_cnt
  FROM concert_booking_seats
  WHERE UPPER(COALESCE(status,'')) = 'ACTIVE'
    AND COALESCE(booking_id, 0) > 0
  GROUP BY show_id
) b ON b.show_id = cs.show_id
WHERE
  COALESCE(b.reserved_cnt, 0) <> 0
  OR cs.remain_count <> GREATEST(0, cs.total_count - COALESCE(b.reserved_cnt, 0))
  OR COALESCE(cs.status, '') <> CASE
      WHEN (cs.total_count - COALESCE(b.reserved_cnt, 0)) <= 0 THEN 'CLOSED'
      ELSE 'OPEN'
  END
"""


def wait_for_db_ready() -> Dict[str, Any]:
    """
    DB가 기동/재기동 중일 수 있으므로, 일정 시간 동안 연결 재시도한다.
    성공 시: {"ok": True, "attempts": n, "waited_ms": ...}
    실패 시: pymysql 에러를 그대로 raise
    """
    deadline = time.monotonic() + max(0, int(SYNC_DB_WAIT_MAX_SEC))
    backoff_ms = max(0, int(SYNC_DB_WAIT_INITIAL_BACKOFF_MS))
    max_backoff_ms = max(0, int(SYNC_DB_WAIT_MAX_BACKOFF_MS))

    attempts = 0
    start = time.monotonic()
    last_exc: Exception | None = None

    while True:
        attempts += 1
        try:
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            finally:
                try:
                    conn.close()
                except Exception:
                    pass
            waited_ms = int((time.monotonic() - start) * 1000)
            return {"ok": True, "attempts": attempts, "waited_ms": waited_ms}
        except (pymysql.err.OperationalError, pymysql.err.InterfaceError, OSError) as exc:
            last_exc = exc
            if time.monotonic() >= deadline:
                break
            if backoff_ms <= 0:
                time.sleep(0.2)
            else:
                # jitter to avoid thundering herd if multiple pods restart together
                sleep_ms = int(backoff_ms * (0.8 + 0.4 * random.random()))
                time.sleep(max(0.0, float(sleep_ms) / 1000.0))
                backoff_ms = min(max_backoff_ms, max(backoff_ms, 1) * 2)

    assert last_exc is not None
    raise last_exc


def sync_remain_counts() -> Dict[str, Any]:
    """
    remain_count 동기화:
    - schedules(remain_count/status)
    - concert_shows(remain_count/status)
    """
    db_wait = wait_for_db_ready()
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(_SQL_SYNC_SCHEDULES_REMAIN)
            schedules_updated = int(cur.rowcount or 0)
            cur.execute(_SQL_SYNC_CONCERT_SHOWS_REMAIN)
            concert_shows_updated = int(cur.rowcount or 0)
        return {
            "ok": True,
            "db_wait": db_wait,
            "schedules_updated": schedules_updated,
            "concert_shows_updated": concert_shows_updated,
        }
    finally:
        try:
            conn.close()
        except Exception:
            pass


def sync_remain_counts_and_refresh_redis() -> Dict[str, Any]:
    """
    write-api 기동 시 remain_count 싱크 후,
    Redis remain 카운터(concert:show:{id}:remain:v1)가 남아있는 재기동 상황에서
    과거 값이 화면에 남지 않도록 "이번 싱크로 값이 바뀐 show"만 Redis를 DB 값으로 덮어쓴다.

    - 대상: concert_shows remain/status drift
    - 처리: DB UPDATE 후 Redis remain set + show snapshot 캐시 삭제(best-effort)
    """
    db_wait = wait_for_db_ready()

    # 1) 어떤 show가 바뀔지 먼저 계산(UPDATE 결과 rowcount만으로는 id를 알 수 없음)
    drift_rows: list[dict] = []
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(_SQL_SELECT_CONCERT_SHOWS_REMAIN_DRIFT)
            drift_rows = list(cur.fetchall() or [])
    finally:
        try:
            conn.close()
        except Exception:
            pass

    # 2) DB 싱크(기존 로직 그대로)
    sync_result = sync_remain_counts()

    # 3) Redis refresh (best-effort)
    refreshed = 0
    deleted_snapshots = 0
    errors = 0
    for r in drift_rows:
        try:
            show_id = int(r.get("show_id") or 0)
            new_remain = int(r.get("new_remain_count") or 0)
        except Exception:
            continue
        if show_id <= 0:
            continue
        try:
            redis_client.set(f"concert:show:{show_id}:remain:v1", max(0, new_remain))
            refreshed += 1
        except Exception:
            errors += 1
        try:
            # remain이 바뀌었으면 snapshot remain도 stale일 수 있으니 삭제해 다음 read에서 재생성되게 한다.
            redis_client.delete(f"concert:show:{show_id}:read:v2")
            deleted_snapshots += 1
        except Exception:
            errors += 1

    return {
        "ok": True,
        "db_wait": db_wait,
        "sync": sync_result,
        "redis_refresh": {
            "target_shows": len(drift_rows),
            "remain_keys_set": refreshed,
            "show_snapshots_deleted": deleted_snapshots,
            "errors": errors,
        },
    }

