import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory

ROOT = Path(__file__).resolve().parents[2]


def create_app():
    app = Flask(__name__, static_folder=None)
    app.config["DATABASE"] = os.environ.get("OWWH_DB", str(ROOT / "data" / "owwh.db"))
    app.config["UPLOADS"] = os.environ.get("OWWH_UPLOADS", str(Path(app.config["DATABASE"]).parent / "uploads"))
    app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024
    app.json.sort_keys = False

    from . import db
    from .routes import contacts, content, governance, meta, opportunities, search

    db.init_app(app)
    for module in (meta, search, content, opportunities, contacts, governance):
        app.register_blueprint(module.bp, url_prefix="/api")

    @app.errorhandler(404)
    def not_found(e):
        return jsonify(error="Not found or you do not have access"), 404

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify(error=getattr(e, "description", "Forbidden")), 403

    @app.errorhandler(413)
    def too_large(e):
        return jsonify(error="File is larger than 25 MB"), 413

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify(error=getattr(e, "description", "Bad request")), 400

    # Production: serve the built React app (npm run build → client/dist).
    dist = ROOT / "client" / "dist"
    if dist.exists():
        @app.get("/", defaults={"path": ""})
        @app.get("/<path:path>")
        def spa(path):
            if path and (dist / path).is_file():
                return send_from_directory(dist, path)
            return send_from_directory(dist, "index.html")

    return app
