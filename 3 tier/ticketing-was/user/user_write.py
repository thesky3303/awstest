from typing import Any, Dict, Optional

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from db import get_db_connection

router = APIRouter()


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
