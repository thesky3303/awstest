import json
import secrets
import string
import threading
from contextlib import contextmanager

import pymysql
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from cache.redis_client import redis_client
from config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER

router = APIRouter()


class _ScheduleLockPool:
    """Local-only queue skeleton.

    - Groups writes by schedule_id to serialize concurrent commits in-process.
    - In EKS, replace with SQS FIFO MessageGroupId=schedule_id.
    """

    def __init__(self):
        self._global_lock = threading.Lock()
        self._locks = {}

    @contextmanager
    def acquire(self, schedule_id: int):
        with self._global_lock:
            lock = self._locks.get(schedule_id)
            if lock is None:
                lock = threading.Lock()
                self._locks[schedule_id] = lock
        lock.acquire()
        try:
            yield
        finally:
            lock.release()


_schedule_locks = _ScheduleLockPool()


def _to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_seat_key(value: str):
    text = str(value or "").strip()
    parts = text.split("-")
    if len(parts) != 2:
        return None
    row = _to_int(parts[0])
    col = _to_int(parts[1])
    if row <= 0 or col <= 0:
        return None
    return row, col


def _get_tx_connection():
    # db.get_db_connection() is autocommit=True; commit flow needs explicit TX.
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def _is_duplicate_key_error(exc: Exception) -> bool:
    if not isinstance(exc, pymysql.err.IntegrityError):
        return False
    # MySQL duplicate entry
    try:
        return int(exc.args[0]) == 1062
    except Exception:
        return False


def _generate_booking_code() -> str:
    letters = "".join(secrets.choice(string.ascii_uppercase) for _ in range(2))
    digits = "".join(secrets.choice(string.digits) for _ in range(6))
    return f"{letters}{digits}"


@router.post("/api/write/theaters/booking/commit")
def commit_booking(payload: dict):
    """
    Commit seat selection as a booking.

    Returns:
      - OK
      - DUPLICATE_SEAT (unique constraint on booking_seats)
      - SOLD_OUT (remain_count insufficient)
      - ERROR
    """

    data = payload if isinstance(payload, dict) else {}
    user_id = _to_int(data.get("user_id"))
    schedule_id = _to_int(data.get("schedule_id"))
    seats = data.get("seats") or []

    if user_id <= 0 or schedule_id <= 0:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "code": "BAD_REQUEST", "message": "요청값이 올바르지 않습니다."},
        )

    if not isinstance(seats, list) or not seats:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "code": "NO_SEATS", "message": "좌석을 선택해주세요."},
        )

    parsed_seats = []
    seat_set = set()
    for item in seats:
        parsed = _parse_seat_key(item)
        if not parsed:
            return JSONResponse(
                status_code=400,
                content={"ok": False, "code": "BAD_SEAT_KEY", "message": "좌석 형식이 올바르지 않습니다."},
            )
        if parsed in seat_set:
            continue
        seat_set.add(parsed)
        parsed_seats.append(parsed)

    req_count = len(parsed_seats)
    if req_count <= 0:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "code": "NO_SEATS", "message": "좌석을 선택해주세요."},
        )

    from theater.theaters_read import THEATERS_BOOTSTRAP_CACHE_KEY, refresh_theaters_bootstrap_cache

    booking_id = 0
    payment_id = 0
    booking_code = ""
    remain_count_after = 0

    with _schedule_locks.acquire(schedule_id):
        conn = _get_tx_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        s.schedule_id,
                        s.hall_id,
                        s.total_count,
                        s.remain_count
                    FROM schedules s
                    WHERE s.schedule_id = %s
                    FOR UPDATE
                    """,
                    (schedule_id,),
                )
                schedule = cur.fetchone()
                if not schedule:
                    conn.rollback()
                    return JSONResponse(
                        status_code=404, content={"ok": False, "code": "NOT_FOUND", "message": "회차를 찾을 수 없습니다."}
                    )

                hall_id = _to_int(schedule.get("hall_id"))
                if hall_id <= 0:
                    conn.rollback()
                    return JSONResponse(status_code=500, content={"ok": False, "code": "ERROR"})

                # Map seat keys -> seat_id (ensure seats belong to this hall)
                seat_ids = []
                for row_no, col_no in parsed_seats:
                    cur.execute(
                        """
                        SELECT seat_id
                        FROM hall_seats
                        WHERE hall_id = %s
                          AND seat_row_no = %s
                          AND seat_col_no = %s
                        """,
                        (hall_id, row_no, col_no),
                    )
                    seat_row = cur.fetchone()
                    if not seat_row:
                        conn.rollback()
                        return JSONResponse(
                            status_code=400,
                            content={"ok": False, "code": "INVALID_SEAT", "message": "유효하지 않은 좌석입니다."},
                        )
                    seat_ids.append(_to_int(seat_row.get("seat_id")))

                # Decrease remain_count atomically
                cur.execute(
                    """
                    UPDATE schedules
                    SET remain_count = remain_count - %s
                    WHERE schedule_id = %s
                      AND remain_count >= %s
                    """,
                    (req_count, schedule_id, req_count),
                )
                if cur.rowcount != 1:
                    conn.rollback()
                    # cache refresh helps clients fetch latest remain_count
                    try:
                        redis_client.delete(THEATERS_BOOTSTRAP_CACHE_KEY)
                        refresh_theaters_bootstrap_cache()
                    except Exception:
                        pass
                    return {"ok": False, "code": "SOLD_OUT"}

                # Create booking
                cur.execute(
                    """
                    INSERT INTO booking (user_id, schedule_id, reg_count, book_status, created_at)
                    VALUES (%s, %s, %s, 'PAID', NOW())
                    """,
                    (user_id, schedule_id, req_count),
                )
                booking_id = cur.lastrowid

                # booking_code: 2 letters + 6 digits, unique
                for _ in range(12):
                    code = _generate_booking_code()
                    try:
                        cur.execute(
                            "UPDATE booking SET booking_code = %s WHERE booking_id = %s",
                            (code, booking_id),
                        )
                        booking_code = code
                        break
                    except Exception as exc:
                        if _is_duplicate_key_error(exc):
                            continue
                        raise
                if not booking_code:
                    raise RuntimeError("booking_code generation failed")

                # Insert booking_seats (unique constraint prevents duplicates)
                for seat_id in seat_ids:
                    cur.execute(
                        """
                        INSERT INTO booking_seats (booking_id, schedule_id, seat_id, created_at)
                        VALUES (%s, %s, %s, NOW())
                        """,
                        (booking_id, schedule_id, seat_id),
                    )

                # Payment (display-only)
                cur.execute(
                    """
                    INSERT INTO payment (booking_id, pay_yn, paid_at, created_at)
                    VALUES (%s, 'Y', NOW(), NOW())
                    """,
                    (booking_id,),
                )
                payment_id = cur.lastrowid

                # Read remain_count after update
                cur.execute(
                    "SELECT remain_count FROM schedules WHERE schedule_id = %s",
                    (schedule_id,),
                )
                remain_after = cur.fetchone()
                remain_count_after = _to_int(remain_after.get("remain_count") if remain_after else 0)

                # Mark closed when sold out (still return via Read API as CLOSED for UI disabling)
                if remain_count_after <= 0:
                    cur.execute(
                        """
                        UPDATE schedules
                        SET status = 'CLOSED'
                        WHERE schedule_id = %s
                        """,
                        (schedule_id,),
                    )

            conn.commit()

        except Exception as exc:
            conn.rollback()
            if _is_duplicate_key_error(exc):
                # Seat already booked by someone else
                try:
                    redis_client.delete(THEATERS_BOOTSTRAP_CACHE_KEY)
                    refresh_theaters_bootstrap_cache()
                except Exception:
                    pass
                return {"ok": False, "code": "DUPLICATE_SEAT"}

            return JSONResponse(
                status_code=500,
                content={"ok": False, "code": "ERROR", "message": str(exc)},
            )
        finally:
            conn.close()

    # Invalidate/refresh read cache so other clients see latest remain/reserved
    try:
        redis_client.delete(THEATERS_BOOTSTRAP_CACHE_KEY)
        refresh_theaters_bootstrap_cache()
    except Exception:
        pass

    return {
        "ok": True,
        "code": "OK",
        "booking_id": booking_id,
        "booking_code": booking_code,
        "payment_id": payment_id,
        "remain_count_after": remain_count_after,
    }

