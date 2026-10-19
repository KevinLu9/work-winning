import datetime as dt
import json
import uuid

from flask import Blueprint, abort, jsonify, request

from ...seed import catalog as C
from ..auth import current_user
from ..db import audit, get_db, now_iso, row_to_dict, rows
from ..indexing import index_content
from ..permissions import can_approve, can_edit, content_clause, is_enterprise_admin, opportunity_clause
from ..search import similar_content
from .meta import CONFIDENTIALITY, CONTENT_TYPES, RESTRICTED_FLAGS

bp = Blueprint("content", __name__)

MANDATORY = ["type", "title", "sector", "business_unit", "service_line", "contract_value_range", "client",
             "geography", "confidentiality", "owner", "review_date"]
EDITABLE = ["title", "summary", "body", "business_unit", "service_line", "contract_value", "contract_value_range", "client",
            "geography", "confidentiality", "visibility", "shares", "restricted_flags", "owner", "review_date", "expiry_date", "tags"]
TYPE_VALUES = {t["value"] for t in CONTENT_TYPES}
FLAG_VALUES = {f["value"] for f in RESTRICTED_FLAGS}
LIST_COLUMNS = ("id, type, title, summary, sector, business_unit, service_line, contract_value, contract_value_range, client, "
                "geography, confidentiality, visibility, restricted_flags, is_restricted, owner, review_date, expiry_date, "
                "approval_status, version, source_opportunity_id, data_source, updated_at, body_json")


def _get_visible(db, user, content_id):
    sql, params = content_clause(user)
    row = db.execute(f"SELECT * FROM content_items c WHERE c.id = ? AND {sql}", [content_id] + params).fetchone()
    if not row:
        abort(404)
    return row


def _validate(data, partial=False):
    errors = {}
    if not partial:
        for f in MANDATORY:
            if not str(data.get(f) or "").strip():
                errors[f] = "Required"
    if data.get("type") and data["type"] not in TYPE_VALUES:
        errors["type"] = "Unknown content type"
    if data.get("confidentiality") and data["confidentiality"] not in CONFIDENTIALITY:
        errors["confidentiality"] = "Unknown confidentiality level"
    if data.get("contract_value_range") and data["contract_value_range"] not in C.CONTRACT_VALUE_OPTIONS:
        errors["contract_value_range"] = "Unknown value range"
    if data.get("visibility") and data["visibility"] not in ("sector_only", "shared", "enterprise"):
        errors["visibility"] = "Unknown visibility"
    if data.get("visibility") == "shared" and not data.get("shares"):
        errors["shares"] = "Select at least one sector to share with"
    bad = set(data.get("restricted_flags") or []) - FLAG_VALUES
    if bad:
        errors["restricted_flags"] = f"Unknown flags: {', '.join(bad)}"
    if data.get("review_date"):
        try:
            dt.date.fromisoformat(data["review_date"])
        except ValueError:
            errors["review_date"] = "Use YYYY-MM-DD"
    if errors:
        return jsonify(error="Validation failed", fields=errors), 400
    return None


def _write_links(db, item_id, data):
    db.execute("DELETE FROM content_shares WHERE content_id = ?", (item_id,))
    if data.get("visibility") == "shared":
        for s in data.get("shares") or []:
            db.execute("INSERT OR IGNORE INTO content_shares VALUES (?, ?)", (item_id, s))


@bp.get("/content")
def list_content():
    db, user = get_db(), current_user()
    sql, params = content_clause(user)
    clauses = [sql]
    for key in ("type", "sector", "geography", "service_line"):
        vals = request.args.getlist(key)
        if vals:
            clauses.append(f"c.{key} IN ({', '.join('?' for _ in vals)})")
            params += vals
    status = request.args.get("approval_status", "approved")
    if status != "all":
        clauses.append("c.approval_status = ?")
        params.append(status)
    if request.args.get("q"):
        clauses.append("(c.title LIKE ? OR c.summary LIKE ? OR c.client LIKE ?)")
        params += [f"%{request.args['q']}%"] * 3
    order = {"recent": "c.updated_at DESC", "value": "c.contract_value DESC", "title": "c.title"}.get(request.args.get("sort"), "c.updated_at DESC")
    where = " AND ".join(clauses)
    total = db.execute(f"SELECT COUNT(*) FROM content_items c WHERE {where}", params).fetchone()[0]
    limit, offset = min(int(request.args.get("limit", 48)), 200), int(request.args.get("offset", 0))
    items = rows(db.execute(f"SELECT {LIST_COLUMNS} FROM content_items c WHERE {where} ORDER BY {order} LIMIT ? OFFSET ?", params + [limit, offset]))
    return jsonify(total=total, items=items)


@bp.get("/content/similar")
def similar():
    return jsonify(similar_content(get_db(), current_user(), request.args.get("title", "")))


@bp.get("/content/<content_id>")
def get_content(content_id):
    db, user = get_db(), current_user()
    item = row_to_dict(_get_visible(db, user, content_id))
    item["shares"] = [r[0] for r in db.execute("SELECT sector FROM content_shares WHERE content_id = ?", (content_id,))]
    item["contacts"] = rows(db.execute(
        "SELECT ct.id, ct.name, ct.title, ct.primary_sector, ct.expertise, cc.role FROM content_contacts cc "
        "JOIN contacts ct ON ct.id = cc.contact_id WHERE cc.content_id = ? ORDER BY cc.role", (content_id,)))
    item["versions"] = rows(db.execute("SELECT version, changed_by, changed_at, summary FROM content_versions WHERE content_id = ? ORDER BY version DESC", (content_id,)))
    item["opportunity"] = None
    if item["source_opportunity_id"]:
        o_sql, o_params = opportunity_clause(user)
        opp = db.execute(
            f'SELECT o."ItemInternalId" AS id, o."Name" AS name, o."StageName" AS stage, o."Opportunity_Status__c" AS status, '
            f'o."TCV_Converted__c" AS tcv, o."CloseDate" AS close_date, o."Proposal_Teamsite__c" AS teamsite, '
            f'o."BRS_Opportunity_Number__c" AS brs_number, o."Won_Lost_Reason__c" AS reasons, f.client, f.region, f.source '
            f'FROM opportunities o JOIN opportunity_facets f ON f.opportunity_id = o."ItemInternalId" '
            f'WHERE o."ItemInternalId" = ? AND {o_sql}', [item["source_opportunity_id"]] + o_params).fetchone()
        item["opportunity"] = dict(opp) if opp else None
    c_sql, c_params = content_clause(user)
    item["related"] = rows(db.execute(
        f"SELECT id, type, title, sector FROM content_items c WHERE {c_sql} AND c.id != ? AND c.approval_status = 'approved' "
        f"AND (c.source_opportunity_id = ? OR (c.service_line = ? AND c.type = ?)) ORDER BY c.source_opportunity_id = ? DESC LIMIT 5",
        c_params + [content_id, item["source_opportunity_id"], item["service_line"], item["type"], item["source_opportunity_id"]]))
    item["permissions"] = {"can_edit": can_edit(user, item), "can_approve": can_approve(user, item["sector"])}
    audit(user, "view", "content", content_id)
    return jsonify(item)


@bp.post("/content")
def create_content():
    db, user = get_db(), current_user()
    data = request.get_json(force=True) or {}
    data.setdefault("visibility", "sector_only")  # Confidential by default (BRD §7, §13)
    if (err := _validate(data)) is not None:
        return err
    if data["sector"] != user["sector"] and not is_enterprise_admin(user):
        abort(403, "You can only submit content for your own sector")
    flags = sorted(set(data.get("restricted_flags") or []))
    now = now_iso()
    item = {
        "id": f"{data['type'][:2]}-{uuid.uuid4().hex[:8]}",
        "type": data["type"], "title": data["title"].strip(), "summary": data.get("summary"),
        "body_json": json.dumps(data.get("body") or {}), "sector": data["sector"],
        "business_unit": data["business_unit"], "service_line": data["service_line"],
        "contract_value": data.get("contract_value"), "contract_value_range": data["contract_value_range"],
        "client": data["client"], "geography": data["geography"], "confidentiality": data["confidentiality"],
        "visibility": data["visibility"], "restricted_flags": json.dumps(flags), "is_restricted": 1 if flags else 0,
        "owner": data["owner"], "review_date": data["review_date"], "expiry_date": data.get("expiry_date"),
        "approval_status": "pending", "version": 1, "source_opportunity_id": data.get("source_opportunity_id"),
        "tags": json.dumps(data.get("tags") or []), "data_source": "user",
        "created_by": user["id"], "created_at": now, "updated_at": now,
    }
    cols = list(item)
    db.execute(f"INSERT INTO content_items ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})", [item[c] for c in cols])
    _write_links(db, item["id"], data)
    db.execute("INSERT INTO content_versions (content_id, version, changed_by, changed_at, summary) VALUES (?, 1, ?, ?, ?)",
               (item["id"], user["name"], now, "Submitted for approval"))
    if item["source_opportunity_id"]:
        db.execute("INSERT OR IGNORE INTO content_contacts SELECT ?, contact_id, role FROM contact_opportunities WHERE opportunity_id = ?",
                   (item["id"], item["source_opportunity_id"]))
    owner_contact = db.execute("SELECT id FROM contacts WHERE name = ?", (item["owner"],)).fetchone()
    if owner_contact:
        db.execute("INSERT OR IGNORE INTO content_contacts VALUES (?, ?, 'Content Owner')", (item["id"], owner_contact[0]))
    index_content(db, item)
    db.commit()
    audit(user, "create", "content", item["id"], {"title": item["title"], "visibility": item["visibility"]})
    return jsonify(id=item["id"], approval_status="pending"), 201


@bp.patch("/content/<content_id>")
def update_content(content_id):
    db, user = get_db(), current_user()
    current = row_to_dict(_get_visible(db, user, content_id))
    if not can_edit(user, current):
        abort(403, "Only the originating sector can edit this content")
    data = {k: v for k, v in (request.get_json(force=True) or {}).items() if k in EDITABLE}
    if (err := _validate(data, partial=True)) is not None:
        return err
    updates = {}
    for k, v in data.items():
        if k == "body":
            updates["body_json"] = json.dumps(v)
        elif k in ("restricted_flags", "tags"):
            updates[k] = json.dumps(sorted(set(v or [])))
            if k == "restricted_flags":
                updates["is_restricted"] = 1 if v else 0
        elif k != "shares":
            updates[k] = v
    version = current["version"] + 1
    updates |= {"version": version, "updated_at": now_iso()}
    if not can_approve(user, current["sector"]):
        updates["approval_status"] = "pending"  # edits by contributors go back through approval
    db.execute(f"UPDATE content_items SET {', '.join(f'{k} = ?' for k in updates)} WHERE id = ?", list(updates.values()) + [content_id])
    if "visibility" in data or "shares" in data:
        _write_links(db, content_id, {"visibility": data.get("visibility", current["visibility"]), "shares": data.get("shares", [])})
    db.execute("INSERT INTO content_versions (content_id, version, changed_by, changed_at, summary, snapshot_json) VALUES (?, ?, ?, ?, ?, ?)",
               (content_id, version, user["name"], now_iso(), request.args.get("summary") or f"Updated {', '.join(sorted(data))}",
                json.dumps(current, default=str)))
    index_content(db, dict(db.execute("SELECT * FROM content_items WHERE id = ?", (content_id,)).fetchone()))
    db.commit()
    audit(user, "update", "content", content_id, {"fields": sorted(data)})
    return jsonify(id=content_id, version=version)


@bp.post("/content/<content_id>/approve")
def approve_content(content_id):
    db, user = get_db(), current_user()
    item = _get_visible(db, user, content_id)
    if not can_approve(user, item["sector"]):
        abort(403, "Only the sector administrator can approve content")
    data = request.get_json(silent=True) or {}
    decision = data.get("decision", "approve")
    status = {"approve": "approved", "reject": "rejected"}.get(decision)
    if not status:
        abort(400, "decision must be approve or reject")
    db.execute("UPDATE content_items SET approval_status = ?, updated_at = ? WHERE id = ?", (status, now_iso(), content_id))
    index_content(db, dict(db.execute("SELECT * FROM content_items WHERE id = ?", (content_id,)).fetchone()))
    db.commit()
    audit(user, decision, "content", content_id, {"note": data.get("note")})
    return jsonify(id=content_id, approval_status=status,
                   notification=f"Teams notification sent to {item['owner']} (simulated)")


@bp.post("/content/<content_id>/review")
def mark_reviewed(content_id):
    db, user = get_db(), current_user()
    item = _get_visible(db, user, content_id)
    if not can_approve(user, item["sector"]) and item["owner"] != user["name"]:
        abort(403, "Only the content owner or sector administrator can complete a review")
    months = C.CONTENT_REVIEW_MONTHS.get(item["type"], 12)
    today = dt.date.today()
    y, m = divmod(today.month - 1 + months, 12)
    next_review = dt.date(today.year + y, m + 1, min(today.day, 28)).isoformat()
    db.execute("UPDATE content_items SET review_date = ?, updated_at = ? WHERE id = ?", (next_review, now_iso(), content_id))
    db.execute("INSERT INTO content_versions (content_id, version, changed_by, changed_at, summary) VALUES (?, ?, ?, ?, ?)",
               (content_id, item["version"], user["name"], now_iso(), f"Reviewed - next review {next_review}"))
    db.commit()
    audit(user, "review", "content", content_id, {"next_review": next_review})
    return jsonify(id=content_id, review_date=next_review)
