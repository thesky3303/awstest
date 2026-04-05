from flask import Blueprint, request, jsonify
from db import get_db_connection
from cache.redis_client import redis_client

review_write_bp = Blueprint("review_write", __name__)


@review_write_bp.route("/api/write/review", methods=["POST"])
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