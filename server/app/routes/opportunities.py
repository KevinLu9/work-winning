import json

from flask import Blueprint, abort, jsonify, request

from ...seed import catalog as C
from ...seed.field_meta import GROUPS, PEOPLE_FIELDS
from ..auth import current_user
from ..db import audit, get_db, rows
from ..permissions import content_clause, opportunity_clause

bp = Blueprint("opportunities", __name__)

LIST_SELECT = (
    'o."ItemInternalId" AS id, o."Name" AS name, o."StageName" AS stage, o."Opportunity_Status__c" AS opp_status, '
    'o."Business_Unit__c" AS business_unit, o."Probability" AS probability, o."CloseDate" AS close_date, '
    'o."Proposal_Manager__c" AS proposal_manager, o."New_or_Renewal_Work__c" AS work_type, '
    'o."Visibility_Classification__c" AS classification, o."BRS_Opportunity_Number__c" AS brs_number, '
    'f.sector, f.client, f.region, f.service_line, f.status, f.tcv, f.source'
)
SORTS = {
    "name": 'o."Name"', "client": "f.client", "sector": "f.sector", "stage": 'o."StageName"', "tcv": "f.tcv",
    "probability": 'o."Probability"', "close": 'o."CloseDate"', "manager": 'o."Proposal_Manager__c"',
}
STAGE_ORDER = ["Prospecting", "Qualification", "Proposal/Price Quote", "Negotiation/Review", "Closed Won", "Closed Lost"]


def _where(user):
    sql, params = opportunity_clause(user)
    clauses = [sql]
    args = request.args
    for key, col in (("sector", "f.sector"), ("status", "f.status"), ("region", "f.region"), ("stage", 'o."StageName"'), ("client", "f.client"), ("source", "f.source")):
        vals = args.getlist(key)
        if vals:
            clauses.append(f"{col} IN ({', '.join('?' for _ in vals)})")
            params += vals
    if args.get("q"):
        clauses.append('(o."Name" LIKE ? OR f.client LIKE ? OR o."Scope_of_Works__c" LIKE ? OR o."Proposal_Manager__c" LIKE ?)')
        params += [f"%{args['q']}%"] * 4
    return " AND ".join(clauses), params


FROM = 'FROM opportunities o JOIN opportunity_facets f ON f.opportunity_id = o."ItemInternalId"'


@bp.get("/opportunities")
def list_opportunities():
    db, user = get_db(), current_user()
    where, params = _where(user)
    sort = SORTS.get(request.args.get("sort"), 'o."CloseDate"')
    direction = "ASC" if request.args.get("dir") == "asc" else "DESC"
    page_size = min(int(request.args.get("page_size", 25)), 200)
    page = max(int(request.args.get("page", 1)), 1)
    total = db.execute(f"SELECT COUNT(*) {FROM} WHERE {where}", params).fetchone()[0]
    items = rows(db.execute(f"SELECT {LIST_SELECT} {FROM} WHERE {where} ORDER BY {sort} {direction} NULLS LAST LIMIT ? OFFSET ?",
                            params + [page_size, (page - 1) * page_size]))
    return jsonify(total=total, page=page, page_size=page_size, items=items)


@bp.get("/opportunities/stats")
def opportunity_stats():
    db, user = get_db(), current_user()
    where, params = _where(user)
    by_stage = {r[0]: {"stage": r[0], "count": r[1], "tcv": r[2] or 0}
                for r in db.execute(f'SELECT o."StageName", COUNT(*), SUM(f.tcv) {FROM} WHERE {where} GROUP BY 1', params)}
    by_sector = [dict(r) for r in db.execute(
        f"SELECT f.sector, SUM(CASE WHEN f.status = 'won' THEN f.tcv ELSE 0 END) AS won, "
        f"SUM(CASE WHEN f.status = 'open' THEN f.tcv ELSE 0 END) AS open, SUM(CASE WHEN f.status = 'lost' THEN f.tcv ELSE 0 END) AS lost, "
        f"SUM(f.status = 'won') AS won_count, SUM(f.status = 'lost') AS lost_count, COUNT(*) AS count "
        f"{FROM} WHERE {where} GROUP BY f.sector ORDER BY f.sector", params)]
    reasons = [dict(r) for r in db.execute(
        f"SELECT j.value AS reason, SUM(f.status = 'won') AS won, SUM(f.status = 'lost') AS lost "
        f'{FROM}, json_each(o."Won_Lost_Reason__c") j WHERE {where} AND json_valid(o."Won_Lost_Reason__c") GROUP BY j.value ORDER BY COUNT(*) DESC', params)]
    totals = db.execute(
        f"SELECT COUNT(*), SUM(CASE WHEN f.status = 'open' THEN f.tcv END), SUM(CASE WHEN f.status = 'won' THEN f.tcv END), "
        f"SUM(f.status = 'won'), SUM(f.status = 'lost'), SUM(CASE WHEN f.status = 'open' THEN o.\"Total_Weighted_Contract_Value__c\" END) "
        f"{FROM} WHERE {where}", params).fetchone()
    closed = (totals[3] or 0) + (totals[4] or 0)
    return jsonify(
        by_stage=[by_stage[s] for s in STAGE_ORDER if s in by_stage] + [v for k, v in by_stage.items() if k not in STAGE_ORDER],
        by_sector=by_sector, reasons=reasons,
        totals={"count": totals[0], "pipeline_tcv": totals[1] or 0, "won_tcv": totals[2] or 0, "weighted_pipeline": totals[5] or 0,
                "win_rate": round((totals[3] or 0) / closed * 100, 1) if closed else None},
    )


def _populated(value, ftype):
    if value is None or value == "" or value in ("[]", "#Collection(String)"):
        return False
    if value == 0 and ftype != "boolean":
        return False
    return True


@bp.get("/opportunities/<opp_id>")
def get_opportunity(opp_id):
    db, user = get_db(), current_user()
    o_sql, o_params = opportunity_clause(user)
    row = db.execute(f"SELECT o.*, f.sector AS _sector, f.client AS _client, f.region AS _region, f.regions AS _regions, "
                     f"f.service_line AS _service_line, f.status AS _status, f.tcv AS _tcv, f.is_restricted AS _restricted, f.source AS _source "
                     f'{FROM} WHERE o."ItemInternalId" = ? AND {o_sql}', [opp_id] + o_params).fetchone()
    if not row:
        abort(404)
    opp = dict(row)
    facets = {k[1:]: opp.pop(k) for k in list(opp) if k.startswith("_")}
    meta = rows(db.execute("SELECT * FROM sf_field_meta ORDER BY sort_order"))
    groups = {g: [] for g in GROUPS}
    for m in meta:
        value = opp.get(m["column_name"])
        if m["field_type"] == "multiselect" and isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError:
                pass
        groups[m["field_group"]].append({
            "column": m["column_name"], "label": m["label"], "type": m["field_type"], "value": value,
            "populated": _populated(opp.get(m["column_name"]), m["field_type"]) and bool(m["display"]),
            "is_key": bool(m["is_key"]),
        })

    split = []
    for region, prefix in C.REGION_PREFIX.items():
        pct = opp.get(f"{prefix}__c") or 0
        rev = opp.get(f"{prefix}_Revenue__c") or 0
        if pct or rev:
            split.append({"region": region, "percent": pct, "revenue": rev, "weighted": opp.get(f"{prefix}_Weighted_Revenue__c") or 0})

    timeline = []
    for col, label in [("CreatedDate", "Opportunity created"), ("Proposal_Start_Date__c", "Proposal start"),
                       ("Tender_Start_Date__c", "Tender start"), ("Initial_Tender_Close_Date__c", "Initial tender close"),
                       ("Submitted_to_Sector_Date__c", "Submitted to sector"), ("Proposal_Closing_Date__c", "Proposal closing"),
                       ("Tender_Closing_Date__c", "Tender closing"), ("CloseDate", "Close / award date"),
                       ("Contract_Start_Date__c", "Contract start"), ("Contract_End_Date_formula__c", "Contract end")]:
        if opp.get(col):
            timeline.append({"column": col, "label": label, "date": str(opp[col])[:10]})
    timeline.sort(key=lambda t: t["date"])

    contact_ids = {}
    for source_name, name, cid in db.execute("SELECT source_name, name, id FROM contacts"):
        contact_ids[source_name] = contact_ids[name] = cid
    people = [{"column": col, "role": role, "name": opp[col], "contact_id": contact_ids.get(opp[col])}
              for col, role in PEOPLE_FIELDS.items() if opp.get(col)]
    people += rows(db.execute(
        "SELECT ct.name, ct.id AS contact_id, co.role, NULL AS \"column\" FROM contact_opportunities co JOIN contacts ct ON ct.id = co.contact_id "
        "WHERE co.opportunity_id = ? AND co.role IN ('Delivery Lead', 'Technical Lead')", (opp_id,)))

    fy = []
    for n in range(25, 32):
        rev = opp.get(f"Estimated_FY{n}_Revenue__c") or 0
        if rev:
            fy.append({"fy": f"FY{n}", "revenue": rev, "margin": opp.get(f"Estimated_FY{n}_Margin__c") or 0,
                       "weighted_revenue": opp.get(f"Estimated_FY{n}_Weighted_Revenue__c") or 0})

    c_sql, c_params = content_clause(user)
    content = rows(db.execute(f"SELECT id, type, title, visibility, approval_status FROM content_items c WHERE {c_sql} AND c.source_opportunity_id = ?",
                              c_params + [opp_id]))
    audit(user, "view", "opportunity", opp_id)
    return jsonify(
        id=opp_id, name=opp.get("Name"), facets=facets,
        groups=[{"name": g, "fields": f} for g, f in groups.items()],
        populated_count=sum(f["populated"] for fs in groups.values() for f in fs), total_fields=len(meta),
        revenue_split=split, timeline=timeline, people=people, fy_forecast=fy, content=content,
    )
