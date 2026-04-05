from flask import Blueprint, request, jsonify
from db import get_db_connection

user_read_bp = Blueprint("user_read", __name__)


@user_read_bp.route("/api/read/user/mypage", methods=["GET"])
def get_mypage():
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"message": "invalid input"}), 400

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"message": "invalid input"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    user_id,
                    phone,
                    name,
                    created_at
                FROM users
                WHERE user_id = %s
            """, (user_id,))
            user = cur.fetchone()

        if not user:
            return jsonify({"message": "user not found"}), 404

        return jsonify(user)
    finally:
        conn.close()


@user_read_bp.route("/api/read/user/check-phone", methods=["POST"])
def check_phone_duplicate():
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

        count = int(row["count"] or 0)
        return jsonify({
            "message": "ok",
            "duplicated": count > 0,
            "count": count
        })
    finally:
        conn.close()


@user_read_bp.route("/api/read/user/find-password", methods=["POST"])
def find_password_user():
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