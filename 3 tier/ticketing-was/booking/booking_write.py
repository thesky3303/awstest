from flask import Blueprint, request, jsonify
from db import get_db_connection
from cache.redis_client import redis_client

booking_write_bp = Blueprint("booking_write", __name__)


@booking_write_bp.route("/api/write/booking", methods=["POST"])
def booking():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    schedule_id = data.get("schedule_id")
    req_count = data.get("req_count")

    if not user_id or not schedule_id or not req_count:
        return jsonify({"message": "invalid input"}), 400

    try:
        user_id = int(user_id)
        schedule_id = int(schedule_id)
        req_count = int(req_count)
    except (TypeError, ValueError):
        return jsonify({"message": "invalid input"}), 400

    if req_count <= 0:
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
                SELECT schedule_id, movie_id, remain_count, status
                FROM schedules
                WHERE schedule_id = %s
            """, (schedule_id,))
            schedule = cur.fetchone()

            if not schedule:
                return jsonify({"message": "schedule not found"}), 404

            if schedule["status"] != "OPEN":
                return jsonify({"message": "schedule closed"}), 400

            if schedule["remain_count"] < req_count:
                return jsonify({"message": "not enough seats"}), 400

            cur.execute("""
                UPDATE schedules
                SET remain_count = remain_count - %s
                WHERE schedule_id = %s
                  AND remain_count >= %s
            """, (req_count, schedule_id, req_count))

            if cur.rowcount == 0:
                return jsonify({"message": "not enough seats"}), 400

            cur.execute("""
                INSERT INTO booking (user_id, schedule_id, req_count, book_status)
                VALUES (%s, %s, %s, 'SUCCESS')
            """, (user_id, schedule_id, req_count))
            booking_id = cur.lastrowid

            cur.execute("""
                INSERT INTO payment (booking_id, pay_yn, paid_at)
                VALUES (%s, 'Y', NOW())
            """, (booking_id,))

        redis_client.delete("movies:active")
        redis_client.delete(f"movie:detail:{schedule['movie_id']}")

        return jsonify({
            "message": "booking success",
            "booking_id": booking_id
        })
    finally:
        conn.close()