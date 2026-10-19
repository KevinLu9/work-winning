"""Simulated Entra ID: the active persona is passed in the X-OWWH-User header."""
from flask import abort, g, request

from .db import get_db

DEFAULT_USER = "u-transport-bm"


def current_user() -> dict:
    if "user" not in g:
        user_id = request.headers.get("X-OWWH-User") or request.args.get("as") or DEFAULT_USER
        row = get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            abort(403, f"Unknown user {user_id}")
        g.user = dict(row)
    return g.user
