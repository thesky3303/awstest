from typing import Any, Dict, Optional

import pymysql
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from cache.redis_client import redis_client
from config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER
from db import get_db_connection
from theater.theaters_read import (
    THEATERS_BOOTSTRAP_CACHE_KEY,
    THEATER_DETAIL_CACHE_KEY_FORMAT,
    refresh_theaters_bootstrap_cache,
)

router = APIRouter()


def _get_tx_connection():
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


@router.post("/api/write/signup")
def signup(payload: Optional[Dict[str, Any]] = Body(default=None)):
    data = payload or {}

    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    password_hash = (data.get("password_hash") or "").strip()

    if not name or not phone or not password_hash:
        return JSONResponse(status_code=400, content={"message": "invalid input"})

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id
                FROM users
                WHERE phone = %s
                """,
                (phone,),
            )
            exists = cur.fetchone()

            if exists:
                return JSONResponse(status_code=409, content={"message": "phone already exists"})

            cur.execute(
                """
                INSERT INTO users (phone, password_hash, name, created_at)
                VALUES (%s, %s, %s, NOW())
                """,
                (phone, password_hash, name),
            )

        conn.commit()

        return {
            "message": "signup success",
            "success": True,
        }
    finally:
        conn.close()


@router.post("/api/write/login")
def login(payload: Optional[Dict[str, Any]] = Body(default=None)):
    data = payload or {}

    phone = (data.get("phone") or "").strip()
    password_hash = (data.get("password_hash") or "").strip()

    if not phone or not password_hash:
        return JSONResponse(status_code=400, content={"message": "invalid input"})

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id, phone, name, password_hash
                FROM users
                WHERE phone = %s
                """,
                (phone,),
            )
            user = cur.fetchone()

        if not user:
            return JSONResponse(status_code=401, content={"message": "전화번호가 틀립니다."})

        if user["password_hash"] != password_hash:
            return JSONResponse(status_code=401, content={"message": "비밀번호가 틀립니다."})

        return {
            "message": "login success",
            "user": {
                "user_id": user["user_id"],
                "phone": user["phone"],
                "name": user["name"],
            },
        }
    finally:
        conn.close()


@router.post("/api/write/reset-password")
def reset_password(payload: Optional[Dict[str, Any]] = Body(default=None)):
    data = payload or {}

    phone = (data.get("phone") or "").strip()
    name = (data.get("name") or "").strip()
    password_hash = (data.get("password_hash") or "").strip()

    if not phone or not name or not password_hash:
        return JSONResponse(status_code=400, content={"message": "invalid input"})

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id
                FROM users
                WHERE phone = %s AND name = %s
                """,
                (phone, name),
            )
            user = cur.fetchone()

            if not user:
                return JSONResponse(status_code=404, content={"message": "user not found"})

            cur.execute(
                """
                UPDATE users
                SET password_hash = %s
                WHERE phone = %s AND name = %s
                """,
                (password_hash, phone, name),
            )

        conn.commit()

        return {
            "message": "password reset success",
            "success": True,
        }
    finally:
        conn.close()


@router.post("/api/write/user/edit")
def edit_user(payload: Optional[Dict[str, Any]] = Body(default=None)):
    data = payload or {}

    user_id = data.get("user_id")
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()

    if not user_id or not name or not phone:
        return JSONResponse(status_code=400, content={"message": "invalid input"})

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        return JSONResponse(status_code=400, content={"message": "invalid input"})

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id
                FROM users
                WHERE user_id = %s
                """,
                (user_id_int,),
            )
            user = cur.fetchone()

            if not user:
                return JSONResponse(status_code=404, content={"message": "user not found"})

            cur.execute(
                """
                SELECT user_id
                FROM users
                WHERE phone = %s
                  AND user_id <> %s
                """,
                (phone, user_id_int),
            )
            phone_owner = cur.fetchone()

            if phone_owner:
                return JSONResponse(status_code=409, content={"message": "phone already exists"})

            cur.execute(
                """
                UPDATE users
                SET name = %s,
                    phone = %s
                WHERE user_id = %s
                """,
                (name, phone, user_id_int),
            )

        conn.commit()

        return {
            "message": "edit success",
            "success": True,
        }
    finally:
        conn.close()


@router.post("/api/write/user/change-password")
def change_password(payload: Optional[Dict[str, Any]] = Body(default=None)):
    data = payload or {}

    user_id = data.get("user_id")
    current_password_hash = (data.get("current_password_hash") or "").strip()
    new_password_hash = (data.get("new_password_hash") or "").strip()

    if not user_id or not current_password_hash or not new_password_hash:
        return JSONResponse(status_code=400, content={"message": "invalid input"})

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        return JSONResponse(status_code=400, content={"message": "invalid input"})

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id, password_hash
                FROM users
                WHERE user_id = %s
                """,
                (user_id_int,),
            )
            user = cur.fetchone()

            if not user:
                return JSONResponse(status_code=404, content={"message": "user not found"})

            if user["password_hash"] != current_password_hash:
                return JSONResponse(status_code=401, content={"message": "현재 비밀번호가 틀립니다."})

            if current_password_hash == new_password_hash:
                return JSONResponse(
                    status_code=400,
                    content={"message": "현재 비밀번호와 다른 비밀번호를 입력해 주세요."},
                )

            cur.execute(
                """
                UPDATE users
                SET password_hash = %s
                WHERE user_id = %s
                """,
                (new_password_hash, user_id_int),
            )

        conn.commit()

        return {
            "message": "password change success",
            "success": True,
        }
    finally:
        conn.close()


def _refund_concert_booking(user_id_int: int, booking_id_int: int):
    conn = _get_tx_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    cb.booking_id,
                    cb.show_id,
                    cb.reg_count,
                    cb.book_status
                FROM concert_booking cb
                WHERE cb.booking_id = %s
                  AND cb.user_id = %s
                FOR UPDATE
                """,
                (booking_id_int, user_id_int),
            )
            booking = cur.fetchone()

            if not booking:
                conn.rollback()
                return JSONResponse(
                    status_code=404,
                    content={"message": "예매 내역을 찾을 수 없습니다."},
                )

            current_status = str(booking.get("book_status") or "").upper()
            if current_status in ("CANCEL", "CANCELED", "CANCELLED"):
                conn.rollback()
                return JSONResponse(
                    status_code=400,
                    content={"message": "이미 환불된 예매입니다."},
                )

            show_id = int(booking["show_id"])
            reg_count = int(booking["reg_count"])

            cur.execute(
                """
                UPDATE concert_booking
                SET book_status = 'CANCEL'
                WHERE booking_id = %s
                """,
                (booking_id_int,),
            )

            cur.execute(
                """
                UPDATE concert_payment
                SET pay_yn = 'N'
                WHERE booking_id = %s
                """,
                (booking_id_int,),
            )

            cur.execute(
                """
                UPDATE concert_booking_seats
                SET status = 'CANCEL'
                WHERE booking_id = %s
                """,
                (booking_id_int,),
            )

            cur.execute(
                """
                SELECT show_id, remain_count, total_count, status
                FROM concert_shows
                WHERE show_id = %s
                FOR UPDATE
                """,
                (show_id,),
            )
            show_row = cur.fetchone()

            if show_row:
                new_remain = int(show_row["remain_count"]) + reg_count
                total = int(show_row["total_count"])
                if new_remain > total:
                    new_remain = total

                cur.execute(
                    """
                    UPDATE concert_shows
                    SET remain_count = %s
                    WHERE show_id = %s
                    """,
                    (new_remain, show_id),
                )

                if str(show_row["status"]).upper() == "CLOSED" and new_remain > 0:
                    cur.execute(
                        """
                        UPDATE concert_shows
                        SET status = 'OPEN'
                        WHERE show_id = %s
                        """,
                        (show_id,),
                    )

        conn.commit()

    except Exception as exc:
        conn.rollback()
        return JSONResponse(
            status_code=500,
            content={"message": f"환불 처리 중 오류가 발생했습니다: {str(exc)}"},
        )
    finally:
        conn.close()

    return {
        "message": "refund success",
        "success": True,
        "booking_id": booking_id_int,
        "booking_kind": "concert",
    }


@router.post("/api/write/user/bookings/refund")
def refund_booking(payload: Optional[Dict[str, Any]] = Body(default=None)):
    data = payload or {}
    user_id = data.get("user_id")
    booking_id = data.get("booking_id")
    booking_kind = str(data.get("booking_kind") or "movie").strip().lower()

    if not user_id or not booking_id:
        return JSONResponse(
            status_code=400, content={"message": "invalid input"}
        )

    try:
        user_id_int = int(user_id)
        booking_id_int = int(booking_id)
    except (TypeError, ValueError):
        return JSONResponse(
            status_code=400, content={"message": "invalid input"}
        )

    if booking_kind == "concert":
        return _refund_concert_booking(user_id_int, booking_id_int)

    conn = _get_tx_connection()
    theater_id_for_cache: Optional[int] = None
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    b.booking_id,
                    b.schedule_id,
                    b.reg_count,
                    b.book_status
                FROM booking b
                WHERE b.booking_id = %s
                  AND b.user_id = %s
                FOR UPDATE
                """,
                (booking_id_int, user_id_int),
            )
            booking = cur.fetchone()

            if not booking:
                conn.rollback()
                return JSONResponse(
                    status_code=404,
                    content={"message": "예매 내역을 찾을 수 없습니다."},
                )

            current_status = str(booking.get("book_status") or "").upper()
            if current_status in ("CANCEL", "CANCELED", "CANCELLED"):
                conn.rollback()
                return JSONResponse(
                    status_code=400,
                    content={"message": "이미 환불된 예매입니다."},
                )

            schedule_id = int(booking["schedule_id"])
            reg_count = int(booking["reg_count"])

            cur.execute(
                """
                SELECT t.theater_id
                FROM schedules s
                JOIN halls h
                    ON h.hall_id = s.hall_id
                JOIN theaters t
                    ON t.theater_id = h.theater_id
                WHERE s.schedule_id = %s
                """,
                (schedule_id,),
            )
            theater_row = cur.fetchone()
            if theater_row and theater_row.get("theater_id") is not None:
                try:
                    theater_id_for_cache = int(theater_row["theater_id"])
                except (TypeError, ValueError):
                    theater_id_for_cache = None

            cur.execute(
                """
                UPDATE booking
                SET book_status = 'CANCEL'
                WHERE booking_id = %s
                """,
                (booking_id_int,),
            )

            cur.execute(
                """
                UPDATE payment
                SET pay_yn = 'N'
                WHERE booking_id = %s
                """,
                (booking_id_int,),
            )

            cur.execute(
                """
                UPDATE booking_seats
                SET status = 'CANCEL'
                WHERE booking_id = %s
                """,
                (booking_id_int,),
            )

            cur.execute(
                """
                SELECT schedule_id, remain_count, total_count, status
                FROM schedules
                WHERE schedule_id = %s
                FOR UPDATE
                """,
                (schedule_id,),
            )
            schedule = cur.fetchone()

            if schedule:
                new_remain = int(schedule["remain_count"]) + reg_count
                total = int(schedule["total_count"])
                if new_remain > total:
                    new_remain = total

                cur.execute(
                    """
                    UPDATE schedules
                    SET remain_count = %s
                    WHERE schedule_id = %s
                    """,
                    (new_remain, schedule_id),
                )

                if str(schedule["status"]).upper() == "CLOSED" and new_remain > 0:
                    cur.execute(
                        """
                        UPDATE schedules
                        SET status = 'OPEN'
                        WHERE schedule_id = %s
                        """,
                        (schedule_id,),
                    )

        conn.commit()

    except Exception as exc:
        conn.rollback()
        return JSONResponse(
            status_code=500,
            content={"message": f"환불 처리 중 오류가 발생했습니다: {str(exc)}"},
        )
    finally:
        conn.close()

    try:
        redis_client.delete(THEATERS_BOOTSTRAP_CACHE_KEY)
        if theater_id_for_cache:
            redis_client.delete(
                THEATER_DETAIL_CACHE_KEY_FORMAT.format(theater_id=theater_id_for_cache)
            )
        refresh_theaters_bootstrap_cache()
    except Exception:
        pass

    return {
        "message": "refund success",
        "success": True,
        "booking_id": booking_id_int,
        "booking_kind": "movie",
    }
