import datetime as dt
import json
import sqlite3

from flask import current_app, g

JSON_FIELDS = {"body_json", "restricted_flags", "tags", "sectors", "expertise", "roles", "clients", "service_lines", "detail"}


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_app(app):
    app.teardown_appcontext(close_db)


def row_to_dict(row) -> dict:
    d = dict(row)
    for k in JSON_FIELDS & d.keys():
        if isinstance(d[k], str):
            try:
                d[k] = json.loads(d[k])
            except ValueError:
                pass
    if "body_json" in d:
        d["body"] = d.pop("body_json")
    return d


def rows(cursor) -> list[dict]:
    return [row_to_dict(r) for r in cursor.fetchall()]


def now_iso() -> str:
    return dt.datetime.now().replace(microsecond=0).isoformat()


def audit(user, action, entity_type=None, entity_id=None, detail=None):
    get_db().execute(
        "INSERT INTO audit_log (ts, user_id, action, entity_type, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)",
        (now_iso(), user["id"] if user else None, action, entity_type, entity_id, json.dumps(detail) if detail else None),
    )
    get_db().commit()
