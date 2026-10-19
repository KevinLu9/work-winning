from flask import Blueprint, abort, jsonify, request

from ..auth import current_user
from ..db import audit, get_db, row_to_dict, rows
from ..permissions import content_clause, opportunity_clause

bp = Blueprint("contacts", __name__)


@bp.get("/contacts")
def list_contacts():
    db = get_db()
    clauses, params = ["1 = 1"], []
    if request.args.get("q"):
        q = f"%{request.args['q']}%"
        clauses.append("(name LIKE ? OR title LIKE ? OR clients LIKE ? OR service_lines LIKE ? OR expertise LIKE ?)")
        params += [q] * 5
    if request.args.get("sector"):
        clauses.append("(primary_sector = ? OR sectors LIKE ?)")
        params += [request.args["sector"], f'%"{request.args["sector"]}"%']
    if request.args.get("source"):
        clauses.append("data_source = ?")
        params.append(request.args["source"])
    for e in request.args.getlist("expertise"):
        clauses.append("expertise LIKE ?")
        params.append(f'%"{e}"%')
    sort = {"name": "name", "wins": "win_count DESC", "tcv": "total_tcv DESC"}.get(request.args.get("sort"), "opp_count DESC")
    return jsonify(rows(db.execute(f"SELECT * FROM contacts WHERE {' AND '.join(clauses)} ORDER BY is_team, {sort}", params)))


@bp.get("/contacts/<contact_id>")
def get_contact(contact_id):
    db, user = get_db(), current_user()
    row = db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,)).fetchone()
    if not row:
        abort(404)
    contact = row_to_dict(row)
    o_sql, o_params = opportunity_clause(user)
    contact["opportunities"] = rows(db.execute(
        f'SELECT o."ItemInternalId" AS id, o."Name" AS name, o."StageName" AS stage, o."CloseDate" AS close_date, '
        f"group_concat(co.role, ', ') AS roles, f.client, f.sector, f.status, f.tcv, f.source "
        f'FROM contact_opportunities co JOIN opportunities o ON o."ItemInternalId" = co.opportunity_id '
        f'JOIN opportunity_facets f ON f.opportunity_id = o."ItemInternalId" '
        f'WHERE co.contact_id = ? AND {o_sql} GROUP BY o."ItemInternalId" ORDER BY o."CloseDate" DESC', [contact_id] + o_params))
    c_sql, c_params = content_clause(user)
    contact["content"] = rows(db.execute(
        f"SELECT DISTINCT c.id, c.type, c.title, c.sector, c.updated_at, CASE WHEN c.owner = ? THEN 1 ELSE 0 END AS is_owner "
        f"FROM content_items c LEFT JOIN content_contacts cc ON cc.content_id = c.id "
        f"WHERE (cc.contact_id = ? OR c.owner = ?) AND c.approval_status = 'approved' AND {c_sql} "
        f"ORDER BY is_owner DESC, c.updated_at DESC LIMIT 30", [contact["name"], contact_id, contact["name"]] + c_params))
    contact["hidden_opportunities"] = contact["opp_count"] - len(contact["opportunities"])
    audit(user, "view", "contact", contact_id)
    return jsonify(contact)
