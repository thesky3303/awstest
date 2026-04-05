from flask import Blueprint, request, jsonify
from db import get_db_connection

user_write_bp = Blueprint("user_write", __name__)


@user_write_bp.route("/api/write/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    password_hash = (data.get("password_hash") or "").strip()

    if not name or not phone or not password_hash:
        return jsonify({"message": "invalid input"}), 400

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
                return jsonify({"message": "phone already exists"}), 409

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


@user_write_bp.route("/api/write/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    phone = (data.get("phone") or "").strip()
    password_hash = (data.get("password_hash") or "").strip()

    if not phone or not password_hash:
        return jsonify({"message": "invalid input"}), 400

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

        if user["password_hash"] != password_hash:
            return jsonify({"message": "비밀번호가 틀립니다."}), 401

        return jsonify({
            "message": "login success",
            "user": {
                "user_id": user["user_id"],
                "phone": user["phone"],
                "name": user["name"]
            }
        })
    finally:
        conn.close()


@user_write_bp.route("/api/write/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json() or {}

    phone = (data.get("phone") or "").strip()
    name = (data.get("name") or "").strip()
    password_hash = (data.get("password_hash") or "").strip()

    if not phone or not name or not password_hash:
        return jsonify({"message": "invalid input"}), 400

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
                return jsonify({"message": "user not found"}), 404

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


@user_write_bp.route("/api/write/user/edit", methods=["POST"])
def edit_user():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()

    if not user_id or not name or not phone:
        return jsonify({"message": "invalid input"}), 400

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"message": "invalid input"}), 400

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
                return jsonify({"message": "user not found"}), 404

            cur.execute("""
                SELECT user_id
                FROM users
                WHERE phone = %s
                  AND user_id <> %s
            """, (phone, user_id))
            phone_owner = cur.fetchone()

            if phone_owner:
                return jsonify({"message": "phone already exists"}), 409

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


@user_write_bp.route("/api/write/user/change-password", methods=["POST"])
def change_password():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    current_password_hash = (data.get("current_password_hash") or "").strip()
    new_password_hash = (data.get("new_password_hash") or "").strip()

    if not user_id or not current_password_hash or not new_password_hash:
        return jsonify({"message": "invalid input"}), 400

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"message": "invalid input"}), 400

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
                return jsonify({"message": "user not found"}), 404

            if user["password_hash"] != current_password_hash:
                return jsonify({"message": "현재 비밀번호가 틀립니다."}), 401

            if current_password_hash == new_password_hash:
                return jsonify({"message": "현재 비밀번호와 다른 비밀번호를 입력해 주세요."}), 400

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