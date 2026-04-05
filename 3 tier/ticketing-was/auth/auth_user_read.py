from flask import Blueprint, request, jsonify
from db import get_db_connection
import hashlib

auth_user_read_bp = Blueprint("auth_user_read", __name__)


def make_password_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


@auth_user_read_bp.route("/api/read/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}

    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not phone or not password:
        return jsonify({"message": "invalid input"}), 400

    request_password_hash = make_password_hash(password)

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT user_id, phone, name, password_hash
                FROM users
                WHERE phone = %s
            """, (phone,))
            user = cur.fetchone()

        if not user:
            return jsonify({"message": "전화번호가 틀립니다."}), 401

        if (user.get("password_hash") or "") != request_password_hash:
            return jsonify({"message": "비밀번호가 틀립니다."}), 401

        return jsonify({
            "message": "login success",
            "success": True,
            "user": {
                "user_id": user["user_id"],
                "phone": user["phone"],
                "name": user["name"]
            }
        })
    finally:
        conn.close()


@auth_user_read_bp.route("/api/read/auth/check-phone", methods=["POST"])
def auth_check_phone_duplicate():
    data = request.get_json() or {}
    phone = (data.get("phone") or "").strip()

    if not phone:
        return jsonify({"message": "invalid input"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) AS count
                FROM users
                WHERE phone = %s
            """, (phone,))
            row = cur.fetchone()

        count = int((row or {}).get("count") or 0)

        return jsonify({
            "message": "ok",
            "duplicated": count > 0,
            "count": count
        })
    finally:
        conn.close()


@auth_user_read_bp.route("/api/read/auth/find-password", methods=["POST"])
def auth_find_password_user():
    data = request.get_json() or {}

    phone = (data.get("phone") or "").strip()
    name = (data.get("name") or "").strip()

    if not phone or not name:
        return jsonify({"message": "invalid input"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT user_id, phone, name, created_at
                FROM users
                WHERE phone = %s
            """, (phone,))
            user_by_phone = cur.fetchone()

            cur.execute("""
                SELECT user_id, phone, name, created_at
                FROM users
                WHERE name = %s
            """, (name,))
            user_by_name = cur.fetchone()

            cur.execute("""
                SELECT user_id, phone, name, created_at
                FROM users
                WHERE phone = %s AND name = %s
            """, (phone, name))
            matched_user = cur.fetchone()

        matched_phone = user_by_phone is not None
        matched_name = user_by_name is not None

        if matched_user:
            return jsonify({
                "message": "found",
                "success": True,
                "matched_phone": True,
                "matched_name": True,
                "user": {
                    "user_id": matched_user["user_id"],
                    "phone": matched_user["phone"],
                    "name": matched_user["name"],
                    "created_at": matched_user["created_at"]
                }
            })

        return jsonify({
            "message": "not matched",
            "success": False,
            "matched_phone": matched_phone,
            "matched_name": matched_name
        })
    finally:
        conn.close()