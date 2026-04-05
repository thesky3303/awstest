
import json

from flask import Blueprint, jsonify

from cache.redis_client import redis_client
from movie.movie_cache_builder import (
    MOVIES_LIST_CACHE_KEY,
    _fetch_movie_detail_from_db,
    _fetch_movies_from_db,
    _get_movie_detail_cache_key,
    _write_movie_detail_cache,
    _write_movies_cache,
)

movie_read_bp = Blueprint("movie_read", __name__)


@movie_read_bp.route("/api/read/movies", methods=["GET"])
def get_movies():
    cached_data = redis_client.get(MOVIES_LIST_CACHE_KEY)
    if cached_data:
        return jsonify(json.loads(cached_data))

    rows = _fetch_movies_from_db()
    _write_movies_cache(rows)
    return jsonify(rows)


@movie_read_bp.route("/api/read/movie/<int:movie_id>", methods=["GET"])
def get_movie_detail(movie_id):
    cache_key = _get_movie_detail_cache_key(movie_id)

    cached_data = redis_client.get(cache_key)
    if cached_data:
        return jsonify(json.loads(cached_data))

    result = _fetch_movie_detail_from_db(movie_id)
    if result is None:
        return jsonify({"message": "not found"}), 404

    _write_movie_detail_cache(movie_id, result)
    return jsonify(result)
