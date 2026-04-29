"""
Cognito + API Gateway 인증 미들웨어.

인증 흐름:
  프론트엔드 → Cognito 직접 인증 → JWT 발급
  → API Gateway가 JWT 검증 후 헤더 주입 (x-cognito-sub, x-cognito-email, x-cognito-name)
  → 이 미들웨어가 헤더를 읽고 DB에서 user_id를 조회/생성
  → request.state.user_id에 부착

주의: Cognito Access Token에는 email/name 클레임이 없어 Gateway가 주입한 x-cognito-email/name 이
비는 경우가 많다. 클라이언트는 API 호출 시 Bearer 로 IdToken 을 보내면 Gateway 가 검증한
claims 에서 email/name 이 채워진다. 헤더가 비었을 때는 Authorization Bearer JWT 페이로드에서
보강한다(ALB 직접 호출·구버전 호환).
"""
import base64
import json
import logging
from typing import Optional, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from db import get_db_connection

log = logging.getLogger("cognito_middleware")

# 인증 없이 접근 가능한 경로 접두사
PUBLIC_PATH_PREFIXES = (
    "/",
    "/health",
    "/docs",
    "/openapi.json",
    "/api/read/health",
    "/api/write/health",
    "/metrics",
    # 공개 조회 API (영화/극장/콘서트 목록 + 상세)
    # 목록(복수)과 상세(단수) 둘 다 비로그인 조회 허용 — 로그인 강제는
    # 예매 시점(write-api)에서만 발생.
    "/api/read/movies",
    "/api/read/movie/",
    "/api/read/theaters",
    "/api/read/theater/",
    "/api/read/concerts",
    "/api/read/concert/",
    # 캐시 리빌드 (admin)
    "/api/write/admin/",
    "/api/read/movies/cache/",
    # Waiting Room 상태 조회 (인증 전 대기열 진입 허용)
    "/api/read/waiting-room/",
    "/api/write/waiting-room/",
    # 예매 상태 폴링 (booking_ref 기반, 인증은 예매 시점에 이미 완료)
    "/api/read/booking/",
    "/api/write/booking/",
)

# 정확히 일치해야 하는 공개 경로
PUBLIC_EXACT_PATHS = {
    "/",
    "/health",
    "/api/read/health",
    "/api/write/health",
    "/docs",
    "/openapi.json",
}


def _is_public_path(path: str) -> bool:
    """인증이 필요 없는 공개 경로인지 판단."""
    if path in PUBLIC_EXACT_PATHS:
        return True
    # 대기열(Waiting Room) 경로는 어디에 박혀 있든 공개.
    # /api/write/concerts/waiting-room/status/{ref}, /api/write/concerts/{show_id}/waiting-room/enter
    # 등 show_id 가 path param 으로 중간에 끼는 케이스가 있어서 단순 prefix 매칭으로는 커버 불가.
    # 설계 의도: 로그인 전 대기표 발급·순번 조회 허용, 입장 허가된 후 예매 엔드포인트에서 로그인 강제.
    if "/waiting-room/" in path:
        return True
    for prefix in PUBLIC_PATH_PREFIXES:
        if prefix != "/" and path.startswith(prefix):
            return True
    return False


def _decode_jwt_payload(token: str) -> dict:
    """검증 없이 JWT 두 번째 세그먼트만 디코드(API Gateway·ALB 앞단에서 이미 검증된 경우)."""
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return {}
        payload_b64 = parts[1]
        pad = "=" * (-len(payload_b64) % 4)
        raw = base64.urlsafe_b64decode(payload_b64 + pad)
        data = json.loads(raw.decode("utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _identity_from_request(request: Request) -> Tuple[str, str, str]:
    """
    x-cognito-* 헤더와 Authorization Bearer JWT 를 합쳐 sub, email, name 을 만든다.
    헤더가 우선이며, 비어 있으면 Bearer IdToken 페이로드에서 채운다.
    """
    h_sub = (request.headers.get("x-cognito-sub") or "").strip()
    h_email = (request.headers.get("x-cognito-email") or "").strip()
    h_name = (request.headers.get("x-cognito-name") or "").strip()

    claims: dict = {}
    auth = request.headers.get("Authorization") or request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        tok = auth[7:].strip()
        if tok:
            claims = _decode_jwt_payload(tok)

    c_sub = str(claims.get("sub") or "").strip()
    c_email = str(claims.get("email") or "").strip()
    c_name = str(claims.get("name") or "").strip()

    sub = h_sub or c_sub
    email = h_email or c_email
    name = h_name or c_name
    return sub, email, name


def _resolve_user_id(cognito_sub: str, email: str, name: str) -> Optional[int]:
    """
    cognito_sub로 users 테이블에서 user_id 조회.
    없으면 INSERT 후 다시 SELECT.
    기존 행에서 email/name 이 비어 있으면 Cognito claim 으로 1회만 채움(사용자가 수정한 값은 덮어쓰지 않음).
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id, email, name FROM users WHERE cognito_sub = %s",
                (cognito_sub,),
            )
            row = cur.fetchone()
            if row:
                uid = int(row["user_id"])
                updated = False
                if email and not (row.get("email") or "").strip():
                    cur.execute(
                        "UPDATE users SET email = %s WHERE user_id = %s AND (email IS NULL OR email = '')",
                        (email, uid),
                    )
                    updated = True
                if name and not (row.get("name") or "").strip():
                    cur.execute(
                        "UPDATE users SET name = %s WHERE user_id = %s AND (name IS NULL OR name = '')",
                        (name, uid),
                    )
                    updated = True
                if updated:
                    conn.commit()
                return uid

            # 신규 사용자: INSERT IGNORE (race condition 대비)
            cur.execute(
                "INSERT IGNORE INTO users (cognito_sub, email, name) VALUES (%s, %s, %s)",
                (cognito_sub, email or "", name or ""),
            )
            conn.commit()

            # INSERT 후 다시 조회
            cur.execute(
                "SELECT user_id FROM users WHERE cognito_sub = %s",
                (cognito_sub,),
            )
            row = cur.fetchone()
            if row:
                return int(row["user_id"])

        return None
    except Exception:
        log.exception("cognito user resolve failed: sub=%s", cognito_sub)
        return None
    finally:
        conn.close()


class CognitoAuthMiddleware(BaseHTTPMiddleware):
    """
    API Gateway가 주입한 x-cognito-* 헤더를 읽어 user_id를 request.state에 부착.
    공개 경로는 스킵. 비공개 경로에서 헤더가 없으면 401.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # OPTIONS (CORS preflight)는 항상 통과
        if request.method == "OPTIONS":
            return await call_next(request)

        # 공개 경로는 인증 스킵
        if _is_public_path(path):
            return await call_next(request)

        cognito_sub, email, name = _identity_from_request(request)
        if not cognito_sub:
            return JSONResponse(
                status_code=401,
                content={"message": "인증이 필요합니다. (사용자 식별 정보 없음)"},
            )

        user_id = _resolve_user_id(cognito_sub, email, name)
        if user_id is None:
            return JSONResponse(
                status_code=500,
                content={"message": "사용자 정보를 처리할 수 없습니다."},
            )

        request.state.user_id = user_id
        request.state.cognito_sub = cognito_sub
        request.state.cognito_email = email
        request.state.cognito_name = name

        return await call_next(request)
