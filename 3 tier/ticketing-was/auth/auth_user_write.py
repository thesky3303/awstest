from flask import Blueprint, request, jsonify
from db import get_db_connection
import hashlib

auth_user_write_bp = Blueprint("auth_user_write", __name__)


def make_password_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


@auth_user_write_bp.route("/api/write/auth/signup", methods=["POST"])
def auth_signup():
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not name or not phone or not password:
        return jsonify({"message": "입력값이 올바르지 않습니다."}), 400

    password_hash = make_password_hash(password)

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT user_id
                FROM users
                WHERE phone = %s
            """, (phone,))
            exists = cur.fetchone()

            if exists:
                return jsonify({"message": "이미 사용 중인 핸드폰번호입니다."}), 409

            cur.execute("""
                INSERT INTO users (phone, password_hash, name, created_at)
                VALUES (%s, %s, %s, NOW())
            """, (phone, password_hash, name))

        conn.commit()

        return jsonify({
            "message": "signup success",
            "success": True
        })
    finally:
        conn.close()


@auth_user_write_bp.route("/api/write/auth/reset-password", methods=["POST"])
def auth_reset_password():
    data = request.get_json() or {}

    phone = (data.get("phone") or "").strip()
    name = (data.get("name") or "").strip()
    password = data.get("password") or ""

    if not phone or not name or not password:
        return jsonify({"message": "입력값이 올바르지 않습니다."}), 400

    password_hash = make_password_hash(password)

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT user_id
                FROM users
                WHERE phone = %s AND name = %s
            """, (phone, name))
            user = cur.fetchone()

            if not user:
                return jsonify({"message": "사용자를 찾을 수 없습니다."}), 404

            cur.execute("""
                UPDATE users
                SET password_hash = %s
                WHERE phone = %s AND name = %s
            """, (password_hash, phone, name))

        conn.commit()

        return jsonify({
            "message": "password reset success",
            "success": True
        })
    finally:
        conn.close()


@auth_user_write_bp.route("/api/write/auth/change-password", methods=["POST"])
def auth_change_password():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not user_id or not current_password or not new_password:
        return jsonify({"message": "입력값이 올바르지 않습니다."}), 400

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"message": "입력값이 올바르지 않습니다."}), 400

    if current_password == new_password:
        return jsonify({"message": "현재 비밀번호와 다른 비밀번호를 입력해 주세요."}), 400

    current_password_hash = make_password_hash(current_password)
    new_password_hash = make_password_hash(new_password)

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT user_id, password_hash
                FROM users
                WHERE user_id = %s
            """, (user_id,))
            user = cur.fetchone()

            if not user:
                return jsonify({"message": "사용자를 찾을 수 없습니다."}), 404

            if (user.get("password_hash") or "") != current_password_hash:
                return jsonify({"message": "현재 비밀번호가 틀립니다."}), 401

            cur.execute("""
                UPDATE users
                SET password_hash = %s
                WHERE user_id = %s
            """, (new_password_hash, user_id))

        conn.commit()

        return jsonify({
            "message": "password change success",
            "success": True
        })
    finally:
        conn.close()


@auth_user_write_bp.route("/api/write/auth/edit", methods=["POST"])
def auth_edit_user():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()

    if not user_id or not name or not phone:
        return jsonify({"message": "입력값이 올바르지 않습니다."}), 400

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"message": "입력값이 올바르지 않습니다."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT user_id
                FROM users
                WHERE user_id = %s
            """, (user_id,))
            user = cur.fetchone()

            if not user:
                return jsonify({"message": "사용자를 찾을 수 없습니다."}), 404

            cur.execute("""
                SELECT user_id
                FROM users
                WHERE phone = %s
                  AND user_id <> %s
            """, (phone, user_id))
            duplicated_user = cur.fetchone()

            if duplicated_user:
                return jsonify({"message": "이미 사용 중인 핸드폰번호입니다."}), 409

            cur.execute("""
                UPDATE users
                SET name = %s,
                    phone = %s
                WHERE user_id = %s
            """, (name, phone, user_id))

        conn.commit()

        return jsonify({
            "message": "edit success",
            "success": True
        })
    finally:
        conn.close()