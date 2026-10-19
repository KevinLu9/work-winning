"""Replay server/tests/parity_cases.json against the Flask API and write the responses as JSON.

Used by `npm run test:parity`, which compares them with the in-browser API (client/scripts/parity.ts).
Run: .venv/bin/python -m server.tests.parity_dump <database> <output.json>
"""
import json
import os
import re
import sqlite3
import sys
from pathlib import Path

CASES = Path(__file__).with_name("parity_cases.json")


def resolve(value, db_path, new_id):
    if isinstance(value, dict):
        return {k: resolve(v, db_path, new_id) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve(v, db_path, new_id) for v in value]
    if not isinstance(value, str):
        return value
    con = sqlite3.connect(db_path)
    value = re.sub(r"\{sql:(.*?)\}", lambda m: str(con.execute(m[1]).fetchone()[0]), value)
    con.close()
    return value.replace("{new}", new_id or "")


def main(db_path, out_path):
    os.environ["OWWH_DB"] = db_path
    from server.app import create_app
    client = create_app().test_client()
    new_id, results = None, []
    for user, method, path, *rest in json.loads(CASES.read_text())["cases"]:
        path = resolve(path, db_path, new_id)
        body = resolve(rest[0], db_path, new_id) if rest else None
        r = client.open(f"/api{path}", method=method, json=body, headers={"X-OWWH-User": user})
        data = r.get_json()
        if method == "POST" and path == "/content" and r.status_code == 201:
            new_id = data["id"]
        results.append({"case": [user, method, path], "status": r.status_code, "body": data})
    Path(out_path).write_text(json.dumps({"new_id": new_id, "results": results}))


if __name__ == "__main__":
    main(*sys.argv[1:3])
