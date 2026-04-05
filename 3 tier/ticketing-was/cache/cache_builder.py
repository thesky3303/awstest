from threading import Lock

from flask import Blueprint, jsonify

from cache.redis_client import redis_client
from read_app import READ_CACHE_TARGETS

cache_builder_bp = Blueprint("cache_builder", __name__)

_cache_rebuild_lock = Lock()


@cache_builder_bp.route("/api/write/admin/cache/rebuild-all", methods=["POST"])
def rebuild_all_cache():
    if not _cache_rebuild_lock.acquire(blocking=False):
        return jsonify({
            "message": "cache rebuild already running",
            "success": False
        }), 409

    try:
        redis_client.flushdb()

        results = []

        for target in READ_CACHE_TARGETS:
            refresher = target.get("refresher")
            if not callable(refresher):
                continue

            result = refresher()

            results.append({
                "name": target.get("name"),
                "blueprint": getattr(target.get("blueprint"), "name", None),
                "result": result
            })

        return jsonify({
            "message": "cache rebuild success",
            "success": True,
            "results": results
        })
    except Exception as e:
        return jsonify({
            "message": f"cache rebuild failed: {str(e)}",
            "success": False
        }), 500
    finally:
        _cache_rebuild_lock.release()