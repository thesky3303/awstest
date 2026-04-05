from flask import Blueprint, request, jsonify
from db import get_db_connection

inquiry_write_bp = Blueprint("inquiry_write", __name__)


@inquiry_write_bp.route("/api/write/inquiry", methods=["POST"])
def inquiry():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()

    if not user_id or not title or not content:
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
                INSERT INTO inquiries (user_id, title, content, inquiry_status)
                VALUES (%s, %s, %s, 'OPEN')
            """, (user_id, title, content))

        return jsonify({"message": "inquiry success"})
    finally:
        conn.close()