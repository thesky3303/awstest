from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse

from db import get_db_connection

router = APIRouter()


@router.get("/api/read/user/mypage")
def get_mypage(user_id: Optional[str] = Query(default=None)):
    if not user_id:
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
                SELECT
                    user_id,
                    phone,
                    name,
                    created_at
                FROM users
                WHERE user_id = %s
                """,
                (user_id_int,),
            )
            user = cur.fetchone()

        if not user:
            return JSONResponse(status_code=404, content={"message": "user not found"})

        return user
    finally:
        conn.close()


@router.post("/api/read/user/check-phone")
def check_phone_duplicate(payload: Optional[Dict[str, Any]] = Body(default=None)):
    data = payload or {}
    phone = (data.get("phone") or "").strip()

    if not phone:
        return JSONResponse(status_code=400, content={"message": "invalid input"})

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS count
                FROM users
                WHERE phone = %s
                """,
                (phone,),
            )
            row = cur.fetchone()

        count = int(row["count"] or 0)
        return {
            "message": "ok",
            "duplicated": count > 0,
            "count": count,
        }
    finally:
        conn.close()


@router.post("/api/read/user/find-password")
def find_password_user(payload: Optional[Dict[str, Any]] = Body(default=None)):
    data = payload or {}

    phone = (data.get("phone") or "").strip()
    name = (data.get("name") or "").strip()

    if not phone or not name:
        return JSONResponse(status_code=400, content={"message": "invalid input"})

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id, phone, name, created_at
                FROM users
                WHERE phone = %s
                """,
                (phone,),
            )
            user_by_phone = cur.fetchone()

            cur.execute(
                """
                SELECT user_id, phone, name, created_at
                FROM users
                WHERE name = %s
                """,
                (name,),
            )
            user_by_name = cur.fetchone()

            cur.execute(
                """
                SELECT user_id, phone, name, created_at
                FROM users
                WHERE phone = %s AND name = %s
                """,
                (phone, name),
            )
            matched_user = cur.fetchone()

        matched_phone = user_by_phone is not None
        matched_name = user_by_name is not None

        if matched_user:
            return {
                "message": "found",
                "success": True,
                "matched_phone": True,
                "matched_name": True,
                "user": {
                    "user_id": matched_user["user_id"],
                    "phone": matched_user["phone"],
                    "name": matched_user["name"],
                    "created_at": matched_user["created_at"],
                },
            }

        return {
            "message": "not matched",
            "success": False,
            "matched_phone": matched_phone,
            "matched_name": matched_name,
        }
    finally:
        conn.close()
