from flask import Flask, jsonify
from flask_cors import CORS
from config import READ_API_HOST, READ_API_PORT

from user.user_read import user_read_bp
from movie.movie_read import movie_read_bp
from movie.movie_cache_builder import rebuild_movie_cache
from auth.auth_user_read import auth_user_read_bp

READ_BLUEPRINTS = [
    user_read_bp,
    movie_read_bp,
    auth_user_read_bp,
]

READ_CACHE_TARGETS = [
    {
        "name": "movie_read",
        "blueprint": movie_read_bp,
        "refresher": rebuild_movie_cache,
    },
]

app = Flask(__name__)
CORS(app)

for blueprint in READ_BLUEPRINTS:
    app.register_blueprint(blueprint)


@app.route("/api/read/health", methods=["GET"])
def health():
    return jsonify({"message": "read api ok"})


if __name__ == "__main__":
    app.run(host=READ_API_HOST, port=READ_API_PORT, debug=True)