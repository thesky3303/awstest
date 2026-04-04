from flask import Flask, request, jsonify
from flask_cors import CORS
from db import get_db_connection
from redis_client import redis_client
from config import WRITE_API_HOST, WRITE_API_PORT

app = Flask(__name__)
CORS(app)


@app.route("/api/write/health", methods=["GET"])
def health():
    return jsonify({"message": "write api ok"})


@app.route("/api/write/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    password = (data.get("password") or "").strip()

    if not name or not phone or not password:
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
                INSERT INTO users (phone, password_hash, name)
                VALUES (%s, %s, %s)
            """, (phone, password, name))

        return jsonify({"message": "signup success"})
    finally:
        conn.close()


@app.route("/api/write/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    phone = (data.get("phone") or "").strip()
    password = (data.get("password") or "").strip()

    if not phone or not password:
        return jsonify({"message": "invalid input"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT user_id, phone, name
                FROM users
                WHERE phone = %s AND password_hash = %s
            """, (phone, password))
            user = cur.fetchone()

        if not user:
            return jsonify({"message": "login fail"}), 401

        return jsonify({"message": "login success", "user": user})
    finally:
        conn.close()


@app.route("/api/write/booking", methods=["POST"])
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


@app.route("/api/write/inquiry", methods=["POST"])
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


@app.route("/api/write/review", methods=["POST"])
def review():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    movie_id = data.get("movie_id")
    rating = data.get("rating")
    content = (data.get("content") or "").strip()

    if not user_id or not movie_id or not rating or not content:
        return jsonify({"message": "invalid input"}), 400

    try:
        user_id = int(user_id)
        movie_id = int(movie_id)
        rating = int(rating)
    except (TypeError, ValueError):
        return jsonify({"message": "invalid input"}), 400

    if rating < 1 or rating > 5:
        return jsonify({"message": "rating must be 1~5"}), 400

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
                SELECT movie_id
                FROM movies
                WHERE movie_id = %s
            """, (movie_id,))
            movie = cur.fetchone()

            if not movie:
                return jsonify({"message": "movie not found"}), 404

            cur.execute("""
                INSERT INTO reviews (user_id, movie_id, rating, content, review_status)
                VALUES (%s, %s, %s, %s, 'ACTIVE')
            """, (user_id, movie_id, rating, content))

        redis_client.delete(f"movie:detail:{movie_id}")
        return jsonify({"message": "review success"})
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(host=WRITE_API_HOST, port=WRITE_API_PORT, debug=True)