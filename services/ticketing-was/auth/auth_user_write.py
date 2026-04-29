"""
Auth write endpoints (Cognito 전환 후).

- 회원가입/비밀번호 관리는 Cognito가 처리하므로 제거.
- 프로필 수정은 미들웨어의 request.state.user_id 기반으로 동작.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Request
from fastapi.responses import JSONResponse

from db import get_db_connection

router = APIRouter()

_GENERIC_MISMATCH = "입력하신 정보와 일치하는 계정을 찾을 수 없습니다."


@router.post("/api/write/auth/edit")
def auth_edit_user(request: Request, payload: Optional[Dict[str, Any]] = Body(default=None)):
    """사용자 프로필 수정 (이름만). Cognito 미들웨어가 부착한 user_id 사용.
    email 은 Cognito 가 소유하므로 이 엔드포인트로 변경 불가.
    phone 컬럼은 legacy 로 유지되지만 이 엔드포인트에서 더 이상 건드리지 않음."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        return JSONResponse(status_code=401, content={"message": "인증이 필요합니다."})

    data = payload or {}
    name = (data.get("name") or "").strip()
    if not name:
        return JSONResponse(status_code=400, content={"message": "이름을 입력해 주세요."})

    user_id_int = int(user_id)
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM users WHERE user_id = %s", (user_id_int,))
            if not cur.fetchone():
                return JSONResponse(status_code=404, content={"message": "사용자를 찾을 수 없습니다."})
            cur.execute(
                "UPDATE users SET name = %s WHERE user_id = %s",
                (name, user_id_int),
            )
        conn.commit()
        return {"message": "edit success", "success": True}
    finally:
        conn.close()


@router.post("/api/write/auth/recover-reset")
def auth_recover_reset(payload: Optional[Dict[str, Any]] = Body(default=None)):
    """이름·이메일이 DB 와 일치하면 Cognito 비밀번호를 직접 설정(이메일 인증 생략). 인증 불필요.

    참고: 프론트 Cognito `ChangePassword` 는 **기존 비밀번호 + AccessToken** 이 필수라
    '비밀번호 찾기' 플로우에는 쓸 수 없음. 세션 토큰만으로는 새 비번 설정 불가.
    서버 IAM(`cognito-idp:AdminSetUserPassword`) + User Pool ID 가 필요함.
    """
    from config import AWS_REGION, COGNITO_USER_POOL_ID

    if not COGNITO_USER_POOL_ID:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "message": "비밀번호 복구 서비스를 사용할 수 없습니다. 관리자에게 문의하세요.",
            },
        )

    data = payload or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    new_password = data.get("new_password") or data.get("newPassword") or ""
    if isinstance(new_password, str):
        new_password = new_password.strip()
    else:
        new_password = ""

    if not name or not email or not new_password:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "이름, 이메일, 새 비밀번호를 모두 입력해 주세요."},
        )
    if len(new_password) < 8:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "비밀번호는 8자 이상이어야 합니다."},
        )

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id, cognito_sub FROM users
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
            # username_attributes=email 풀이면 Username 은 보통 이메일. 불일치 시 sub 시도.
            sub = (row.get("cognito_sub") or "").strip()
    finally:
        conn.close()

    import boto3
    from botocore.exceptions import ClientError

    client = boto3.client("cognito-idp", region_name=AWS_REGION or "ap-northeast-2")

    def _admin_set(username: str) -> None:
        client.admin_set_user_password(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=username,
            Password=new_password,
            Permanent=True,
        )

    try:
        _admin_set(email)
    except ClientError as e:
        code = (e.response or {}).get("Error", {}).get("Code", "")
        if code == "UserNotFoundException" and sub and email != sub:
            try:
                _admin_set(sub)
            except ClientError as e2:
                code2 = (e2.response or {}).get("Error", {}).get("Code", "")
                return _recover_reset_client_error_response(code2, e2)
        else:
            return _recover_reset_client_error_response(code, e)

    return {"success": True, "message": "비밀번호가 변경되었습니다."}


def _recover_reset_client_error_response(code: str, exc: Exception) -> JSONResponse:
    """Cognito AdminSetUserPassword 오류 → HTTP 응답 (원인 숨기지 않되 과도한 내부 정보는 제외)."""
    if code == "UserNotFoundException":
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": _GENERIC_MISMATCH},
        )
    if code == "InvalidPasswordException":
        rsp = getattr(exc, "response", None) or {}
        msg = (rsp.get("Error") or {}).get("Message", "")
        hint = (
            "비밀번호 정책: 8자 이상, 영문 대·소문자, 숫자 포함."
            if not msg
            else msg
        )
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": hint},
        )
    if code in ("AccessDeniedException", "UnauthorizedOperation"):
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "message": "비밀번호 변경 권한이 없습니다. 관리자에게 문의하세요. (IAM: cognito-idp:AdminSetUserPassword)",
            },
        )
    if code == "ResourceNotFoundException":
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "message": "Cognito User Pool 설정(COGNITO_USER_POOL_ID)을 확인해 주세요.",
            },
        )
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        },
    )
