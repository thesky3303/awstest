from flask import Flask, jsonify
from flask_cors import CORS
from config import WRITE_API_HOST, WRITE_API_PORT

from user.user_write import user_write_bp
from booking.booking_write import booking_write_bp
from review.review_write import review_write_bp
from inquiry.inquiry_write import inquiry_write_bp
from auth.auth_user_write import auth_user_write_bp
from cache.cache_builder import cache_builder_bp

WRITE_BLUEPRINTS = [
    user_write_bp,
    booking_write_bp,
    review_write_bp,
    inquiry_write_bp,
    auth_user_write_bp,
    cache_builder_bp,
]

app = Flask(__name__)
CORS(app)

for blueprint in WRITE_BLUEPRINTS:
    app.register_blueprint(blueprint)


@app.route("/api/write/health", methods=["GET"])
def health():
    return jsonify({"message": "write api ok"})


if __name__ == "__main__":
    app.run(host=WRITE_API_HOST, port=WRITE_API_PORT, debug=True)