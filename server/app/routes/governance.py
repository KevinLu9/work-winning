import datetime as dt

from flask import Blueprint, abort, jsonify, request

from ..auth import current_user
from ..db import get_db, rows
from ..permissions import can_approve, is_enterprise_admin

bp = Blueprint("governance", __name__)

MANDATORY_SQL = " AND ".join(f"COALESCE({c}, '') != ''" for c in [
    "sector", "business_unit", "service_line", "contract_value_range", "client", "geography", "confidentiality", "owner", "review_date"])
QUEUE_COLS = "id, type, title, sector, owner, review_date, expiry_date, approval_status, visibility, updated_at, created_by"


@bp.get("/governance")
def governance():
    db, user = get_db(), current_user()
    today = dt.date.today().isoformat()
    # Governance queues are scoped to the viewer's sector; Enterprise Admins see every sector.
    scope = request.args.get("sector") if is_enterprise_admin(user) else user["sector"]
    where, params = ("sector = ?", [scope]) if scope else ("1 = 1", [])

    def q(extra, extra_params=(), order="review_date"):
        return rows(db.execute(f"SELECT {QUEUE_COLS} FROM content_items WHERE {where} AND {extra} ORDER BY {order} LIMIT 100",
                               params + list(extra_params)))

    roster = []
    for s in rows(db.execute("SELECT * FROM sectors ORDER BY name")):
        stats = db.execute(
            f"SELECT COUNT(*), SUM({MANDATORY_SQL}), SUM(review_date < ?), SUM(approval_status = 'pending'), "
            f"SUM(visibility = 'sector_only'), SUM(visibility = 'shared'), SUM(visibility = 'enterprise'), SUM(is_restricted), "
            f"SUM(COALESCE(owner, '') = '') FROM content_items WHERE sector = ?", (today, s["name"])).fetchone()
        roster.append(s | {
            "content_count": stats[0], "completeness": round((stats[1] or 0) / stats[0] * 100, 1) if stats[0] else 100,
            "overdue": stats[2] or 0, "pending": stats[3] or 0,
            "visibility": {"sector_only": stats[4] or 0, "shared": stats[5] or 0, "enterprise": stats[6] or 0},
            "restricted": stats[7] or 0, "no_owner": stats[8] or 0,
        })
    incomplete = rows(db.execute(f"SELECT {QUEUE_COLS}, business_unit, geography, service_line, client FROM content_items "
                                 f"WHERE {where} AND NOT ({MANDATORY_SQL}) LIMIT 50", params))
    return jsonify(
        scope=scope or "All sectors", can_approve=can_approve(user, scope) if scope else is_enterprise_admin(user),
        overdue=q("review_date < ?", [today]),
        due_soon=q("review_date >= ? AND review_date <= date(?, '+30 days')", [today, today]),
        expired=q("expiry_date < ?", [today], "expiry_date"),
        pending=q("approval_status = 'pending'", order="updated_at DESC"),
        rejected=q("approval_status = 'rejected'", order="updated_at DESC"),
        incomplete=incomplete, roster=roster,
    )


@bp.get("/audit")
def audit_log():
    db, user = get_db(), current_user()
    if user["role"] not in ("enterprise_admin", "sector_admin"):
        abort(403, "Audit log is available to administrators")
    clauses, params = ["1 = 1"], []
    if user["role"] == "sector_admin":
        clauses.append("u.sector = ?")
        params.append(user["sector"])
    if request.args.get("action"):
        clauses.append("a.action = ?")
        params.append(request.args["action"])
    return jsonify(rows(db.execute(
        f"SELECT a.*, u.name AS user_name, u.sector AS user_sector FROM audit_log a LEFT JOIN users u ON u.id = a.user_id "
        f"WHERE {' AND '.join(clauses)} ORDER BY a.id DESC LIMIT 200", params)))
