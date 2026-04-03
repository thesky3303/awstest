import json
from flask import Flask, jsonify
from flask_cors import CORS
from db import get_db_connection
from redis_client import redis_client
from config import READ_API_HOST, READ_API_PORT

app = Flask(__name__)
CORS(app)


@app.route("/api/read/health", methods=["GET"])
def health():
    return jsonify({"message": "read api ok"})


@app.route("/api/read/movies", methods=["GET"])
def get_movies():
    cache_key = "movies:active"

    cached_data = redis_client.get(cache_key)
    if cached_data:
        return jsonify(json.loads(cached_data))

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    m.movie_id,
                    m.title,
                    m.genre,
                    m.director,
                    m.poster_url,
                    m.main_poster_url,
                    m.release_date,
                    m.synopsis,
                    m.status,
                    m.audience_count,
                    MIN(CASE WHEN s.status = 'OPEN' THEN s.show_date END) AS next_show_date,
                    SUM(CASE WHEN s.status = 'OPEN' THEN s.remain_count ELSE 0 END) AS total_remain_count
                FROM movies m
                LEFT JOIN schedules s
                    ON m.movie_id = s.movie_id
                WHERE m.status = 'ACTIVE'
                GROUP BY
                    m.movie_id,
                    m.title,
                    m.genre,
                    m.director,
                    m.poster_url,
                    m.main_poster_url,
                    m.release_date,
                    m.synopsis,
                    m.status,
                    m.audience_count
                ORDER BY m.movie_id DESC
            """)
            rows = cur.fetchall()

        redis_client.setex(cache_key, 60, json.dumps(rows, default=str))
        return jsonify(rows)
    finally:
        conn.close()


@app.route("/api/read/movie/<int:movie_id>", methods=["GET"])
def get_movie_detail(movie_id):
    cache_key = f"movie:detail:{movie_id}"

    cached_data = redis_client.get(cache_key)
    if cached_data:
        return jsonify(json.loads(cached_data))

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    movie_id,
                    title,
                    genre,
                    director,
                    poster_url,
                    main_poster_url,
                    release_date,
                    synopsis,
                    status,
                    audience_count
                FROM movies
                WHERE movie_id = %s
            """, (movie_id,))
            movie = cur.fetchone()

            if not movie:
                return jsonify({"message": "not found"}), 404

            cur.execute("""
                SELECT
                    schedule_id,
                    show_date,
                    total_count,
                    remain_count,
                    status
                FROM schedules
                WHERE movie_id = %s
                ORDER BY show_date ASC
            """, (movie_id,))
            schedules = cur.fetchall()

            cur.execute("""
                SELECT
                    r.review_id,
                    r.user_id,
                    u.name AS user_name,
                    r.rating,
                    r.content,
                    r.review_status,
                    r.created_at
                FROM reviews r
                INNER JOIN users u
                    ON r.user_id = u.user_id
                WHERE r.movie_id = %s
                  AND r.review_status = 'ACTIVE'
                ORDER BY r.review_id DESC
            """, (movie_id,))
            reviews = cur.fetchall()

        result = {
            "movie": movie,
            "schedules": schedules,
            "reviews": reviews
        }

        redis_client.setex(cache_key, 60, json.dumps(result, default=str))
        return jsonify(result)
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(host=READ_API_HOST, port=READ_API_PORT, debug=True)