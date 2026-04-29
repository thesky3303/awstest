"""
Auth read endpoints (Cognito 전환 후).

- 로그인/비밀번호 검증은 Cognito가 처리하므로 제거.
- /api/read/auth/me: 미들웨어가 부착한 user_id로 프로필 조회.
- /api/read/auth/recover-verify: 비밀번호 찾기 1단계 — DB 에서 이름+이메일 일치(Cognito 가입자) 확인.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Request
from fastapi.responses import JSONResponse

from db import get_db_read_connection

router = APIRouter()

_GENERIC_MISMATCH = "입력하신 정보와 일치하는 계정을 찾을 수 없습니다."


@router.get("/api/read/auth/me")
def auth_me(request: Request):
    """Cognito 인증 후 현재 사용자 정보 조회."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        return JSONResponse(status_code=401, content={"message": "인증이 필요합니다."})
    conn = get_db_read_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id, cognito_sub, email, name, phone FROM users WHERE user_id = %s",
                (int(user_id),),
            )
            user = cur.fetchone()
        if not user:
            return JSONResponse(status_code=404, content={"message": "사용자를 찾을 수 없습니다."})
        return {
            "message": "ok",
            "success": True,
            "user": {
                "user_id": user["user_id"],
                "email": user.get("email", ""),
                "name": user.get("name", ""),
                "phone": user.get("phone") or "",
            },
        }
    finally:
        conn.close()


@router.post("/api/read/auth/recover-verify")
def auth_recover_verify(payload: Optional[Dict[str, Any]] = Body(default=None)):
    """이름·이메일이 DB(Cognito 연동 users)와 일치하는지 확인. 인증 불필요."""
    data = payload or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    if not name or not email:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "이름과 이메일을 입력해 주세요."},
        )

    conn = get_db_read_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id FROM users
                WHERE LOWER(TRIM(COALESCE(email, ''))) = %s
                  AND TRIM(COALESCE(name, '')) = %s
                  AND cognito_sub IS NOT NULL
                  AND TRIM(cognito_sub) != ''
                LIMIT 1
                """,
                (email, name),
            )
            row = cur.fetchone()
        if not row:
            return JSONResponse(
                status_code=404,
                content={"success": False, "message": _GENERIC_MISMATCH},
            )
        return {
            "success": True,
            "skip_email_verification": True,
            "message": "이메일 인증 과정 생략",
        }
    finally:
        conn.close()
