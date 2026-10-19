import datetime as dt
import json
import uuid
from pathlib import Path

from flask import Blueprint, abort, current_app, jsonify, request, send_file
from werkzeug.utils import secure_filename

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
                "approval_status, version, source_opportunity_id, data_source, updated_at, body_json, "
                "(SELECT a.id FROM content_attachments a WHERE a.content_id = c.id AND a.role = 'hero') AS hero_id")
ATTACHMENT_COLUMNS = "id, role, filename, mime_type, size, uploaded_by, uploaded_at"
IMAGE_TYPES = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif"}
# SVG is deliberately not accepted from users (it can carry script); seeded demo media may be SVG.
ALLOWED_UPLOADS = {"hero": IMAGE_TYPES, "image": IMAGE_TYPES, "document": {"pdf": "application/pdf"}}


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
    item["versions"] = rows(db.execute("SELECT version, changed_by, changed_at, summary FROM content_versions WHERE content_id = ? ORDER BY version DESC, id DESC", (content_id,)))
    item["attachments"] = rows(db.execute(f"SELECT {ATTACHMENT_COLUMNS} FROM content_attachments WHERE content_id = ? ORDER BY role, uploaded_at, id", (content_id,)))
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


def _admin_change(db, user, item, updates, summary, action, detail=None):
    """Apply an administrator-only change (visibility, archive, restore): log a version entry without bumping the version."""
    updates = updates | {"updated_at": now_iso()}
    db.execute(f"UPDATE content_items SET {', '.join(f'{k} = ?' for k in updates)} WHERE id = ?", list(updates.values()) + [item["id"]])
    db.execute("INSERT INTO content_versions (content_id, version, changed_by, changed_at, summary) VALUES (?, ?, ?, ?, ?)",
               (item["id"], item["version"], user["name"], now_iso(), summary))
    index_content(db, dict(db.execute("SELECT * FROM content_items WHERE id = ?", (item["id"],)).fetchone()))
    db.commit()
    audit(user, action, "content", item["id"], detail)


@bp.post("/content/<content_id>/visibility")
def change_visibility(content_id):
    db, user = get_db(), current_user()
    item = _get_visible(db, user, content_id)
    if not can_approve(user, item["sector"]):
        abort(403, "Only the sector administrator can change visibility")
    data = request.get_json(silent=True) or {}
    data = {"visibility": data.get("visibility"), "shares": [s for s in data.get("shares") or [] if s != item["sector"]]}
    if not data["visibility"]:
        return jsonify(error="Validation failed", fields={"visibility": "Required"}), 400
    if (err := _validate(data, partial=True)) is not None:
        return err
    _write_links(db, content_id, data)
    label = {"sector_only": "Sector only", "shared": f"Shared with {', '.join(data['shares'])}", "enterprise": "Enterprise"}[data["visibility"]]
    _admin_change(db, user, item, {"visibility": data["visibility"]}, f"Visibility changed to {label}", "visibility",
                  {"from": item["visibility"], "to": data["visibility"], "shares": data["shares"]})
    return jsonify(id=content_id, visibility=data["visibility"], shares=data["shares"] if data["visibility"] == "shared" else [])


@bp.post("/content/<content_id>/archive")
def archive_content(content_id):
    db, user = get_db(), current_user()
    item = _get_visible(db, user, content_id)  # archived items are not visible, so archiving twice is a 404
    if not can_approve(user, item["sector"]):
        abort(403, "Only the sector administrator can archive content")
    _admin_change(db, user, item, {"approval_status": "archived"}, "Archived - hidden from everyone", "archive",
                  {"previous_status": item["approval_status"]})
    return jsonify(id=content_id, approval_status="archived")


@bp.post("/content/<content_id>/restore")
def restore_content(content_id):
    db, user = get_db(), current_user()
    # Archived content is outside content_clause, so look it up directly; only its sector admin may see it here.
    item = db.execute("SELECT * FROM content_items WHERE id = ? AND approval_status = 'archived'", (content_id,)).fetchone()
    if not item or not can_approve(user, item["sector"]):
        abort(404)
    _admin_change(db, user, item, {"approval_status": "approved"}, "Restored from archive", "restore")
    return jsonify(id=content_id, approval_status="approved")


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


def _uploads_dir() -> Path:
    return Path(current_app.config["UPLOADS"])


def _remove_attachment(db, att):
    db.execute("DELETE FROM content_attachments WHERE id = ?", (att["id"],))
    (_uploads_dir() / att["stored_name"]).unlink(missing_ok=True)


@bp.post("/content/<content_id>/attachments")
def upload_attachment(content_id):
    db, user = get_db(), current_user()
    item = _get_visible(db, user, content_id)
    if not can_edit(user, item):
        abort(403, "Only the originating sector can add media to this content")
    role, file = request.form.get("role", "image"), request.files.get("file")
    if role not in ALLOWED_UPLOADS:
        abort(400, "role must be hero, image or document")
    if not file or not file.filename:
        abort(400, "Choose a file to upload")
    filename = secure_filename(file.filename) or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    allowed = ALLOWED_UPLOADS[role]
    if ext not in allowed or file.mimetype != allowed[ext]:
        kinds = "PDF files" if role == "document" else "PNG, JPG, WebP or GIF images"
        abort(400, f"{file.filename}: only {kinds} can be uploaded here")
    if role == "hero":
        for old in db.execute("SELECT * FROM content_attachments WHERE content_id = ? AND role = 'hero'", (content_id,)).fetchall():
            _remove_attachment(db, old)
    att_id = f"at-{uuid.uuid4().hex[:12]}"
    stored = f"{content_id}/{att_id}.{ext}"
    dest = _uploads_dir() / stored
    dest.parent.mkdir(parents=True, exist_ok=True)
    file.save(dest)
    db.execute("INSERT INTO content_attachments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
               (att_id, content_id, role, file.filename, stored, allowed[ext], dest.stat().st_size, user["name"], now_iso()))
    db.commit()
    audit(user, "attach", "content", content_id, {"attachment": att_id, "role": role, "filename": file.filename})
    return jsonify(row_to_dict(db.execute(f"SELECT {ATTACHMENT_COLUMNS} FROM content_attachments WHERE id = ?", (att_id,)).fetchone())), 201


@bp.delete("/content/<content_id>/attachments/<att_id>")
def delete_attachment(content_id, att_id):
    db, user = get_db(), current_user()
    item = _get_visible(db, user, content_id)
    if not can_edit(user, item):
        abort(403, "Only the originating sector can remove media from this content")
    att = db.execute("SELECT * FROM content_attachments WHERE id = ? AND content_id = ?", (att_id, content_id)).fetchone()
    if not att:
        abort(404)
    _remove_attachment(db, att)
    db.commit()
    audit(user, "detach", "content", content_id, {"attachment": att_id, "filename": att["filename"]})
    return jsonify(id=att_id, deleted=True)


@bp.get("/uploads/<att_id>")
def serve_attachment(att_id):
    """The file behind an attachment, under the same visibility rules as its content item.
    <img> tags cannot send X-OWWH-User, so the client passes the persona as ?as=."""
    db, user = get_db(), current_user()
    sql, params = content_clause(user)
    att = db.execute(f"SELECT a.* FROM content_attachments a JOIN content_items c ON c.id = a.content_id WHERE a.id = ? AND {sql}",
                     [att_id] + params).fetchone()
    path = _uploads_dir() / att["stored_name"] if att else None
    if not path or not path.is_file():
        abort(404)
    resp = send_file(path, mimetype=att["mime_type"], download_name=att["filename"],
                     as_attachment=request.args.get("download") == "1", max_age=3600)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp
