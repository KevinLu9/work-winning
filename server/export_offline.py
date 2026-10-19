"""Export the data bundle for the single-file shareable build (npm run build:share).

Writes to client/offline-data/:
  owwh.db.gz      the database (gzip), loaded in the browser by SQLite WASM. Real export only by
                  default; with --synthetic it also contains the generated demo data
  bootstrap.json  the /api/meta response plus backend constants the in-browser API needs,
                  so they are defined once in Python and not duplicated in TypeScript
  media.json      every content attachment (hero banners, gallery images, PDFs) as base64, keyed
                  by attachment id, so the page can show them without a server

Run: .venv/bin/python -m server.export_offline [--synthetic]
"""
import argparse
import base64
import gzip
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "client" / "offline-data"


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--synthetic", action="store_true", help="also bundle the generated demo data")
    args = parser.parse_args()
    # Same convention as the seed: `npm run build:share --synthetic` arrives as npm_config_synthetic=true.
    synthetic = args.synthetic or os.environ.get("npm_config_synthetic", "").lower() in ("true", "1")

    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "owwh.db"
        env = {k: v for k, v in os.environ.items() if k != "npm_config_synthetic"} | {"OWWH_DB": str(db_path)}
        seed_args = ["--synthetic"] if synthetic else []
        subprocess.run([sys.executable, "-m", "server.seed.seed", *seed_args], cwd=ROOT, env=env, check=True)

        # Start the bundled database with a clean audit trail, then compact it.
        con = sqlite3.connect(db_path)
        con.execute("DELETE FROM audit_log")
        con.commit()
        # The seed writes media next to the database (see UPLOADS in server/seed/seed.py).
        media = {att_id: {"mime": mime, "b64": base64.b64encode((Path(tmp) / "uploads" / stored).read_bytes()).decode()}
                 for att_id, stored, mime in con.execute("SELECT id, stored_name, mime_type FROM content_attachments")}
        con.execute("VACUUM")
        con.close()

        os.environ["OWWH_DB"] = str(db_path)
        from server.app import create_app
        from server.app.routes.opportunities import STAGE_ORDER
        from server.seed import catalog as C
        from server.seed.field_meta import GROUPS, PEOPLE_FIELDS

        meta = create_app().test_client().get("/api/meta").get_json()
        bootstrap = {
            "mode": "synthetic" if synthetic else "real",
            "meta": meta,
            "constants": {
                "groups": GROUPS,
                "people_fields": PEOPLE_FIELDS,
                "region_prefix": C.REGION_PREFIX,
                "review_months": C.CONTENT_REVIEW_MONTHS,
                "value_options": C.CONTRACT_VALUE_OPTIONS,
                "stage_order": STAGE_ORDER,
            },
        }

        OUT.mkdir(parents=True, exist_ok=True)
        raw = db_path.read_bytes()
        (OUT / "owwh.db.gz").write_bytes(gzip.compress(raw, compresslevel=9))
        (OUT / "bootstrap.json").write_text(json.dumps(bootstrap, indent=1))
        (OUT / "media.json").write_text(json.dumps(media))
        print(f"Exported {OUT.relative_to(ROOT)}: database {len(raw) // 1024} KB "
              f"→ {(OUT / 'owwh.db.gz').stat().st_size // 1024} KB gzipped, media {len(media)} files "
              f"{(OUT / 'media.json').stat().st_size // 1024} KB, mode={bootstrap['mode']}")


if __name__ == "__main__":
    main()
