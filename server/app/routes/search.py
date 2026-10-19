from flask import Blueprint, jsonify, request

from ..auth import current_user
from ..db import audit, get_db
from ..search import FACETS, parse_query, run_search

bp = Blueprint("search", __name__)


@bp.get("/search")
def search():
    db, user = get_db(), current_user()
    q = request.args.get("q", "").strip()
    filters = {k: request.args.getlist(k) for k in FACETS + ["value_range"] if request.args.getlist(k)}
    for k in ("value_min", "value_max"):
        if request.args.get(k):
            filters[k] = float(request.args[k])

    parsed = {"keywords": q, "filters": {}, "chips": []}
    if q and request.args.get("parse", "1") != "0":
        clients = [r[0] for r in db.execute("SELECT DISTINCT client FROM search_docs WHERE client IS NOT NULL")]
        parsed = parse_query(q, clients)
        for k, v in parsed["filters"].items():
            if isinstance(v, list):
                filters[k] = list(dict.fromkeys(filters.get(k, []) + v))
            else:
                filters.setdefault(k, v)

    limit = min(int(request.args.get("limit", 60)), 200)
    result = run_search(db, user, parsed["keywords"], filters, limit=limit, offset=int(request.args.get("offset", 0)))
    audit(user, "search", "search", None, {"q": q, "filters": filters, "total": result["total"]})
    return jsonify(result | {"query": q, "keywords": parsed["keywords"], "chips": parsed["chips"], "filters": filters})
