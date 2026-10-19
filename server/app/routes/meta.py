import datetime as dt

from flask import Blueprint, jsonify

from ...seed import catalog as C
from ..auth import current_user
from ..db import get_db, rows
from ..permissions import content_clause, opportunity_clause

bp = Blueprint("meta", __name__)

# Descriptions shown on the Submit page so contributors pick the right type (BRD §6.2, §6.4).
CONTENT_TYPES = [
    {
        "value": "case_study", "label": "Case study",
        "description": "A marketing-ready story of a delivered project, told as challenge, solution and measurable outcomes.",
        "use_when": "A won project has results worth showcasing in future tenders, such as safety records, savings or client feedback.",
        "includes": ["Client challenge and our solution", "Quantified outcomes", "Photos", "Client reference contact"],
    },
    {
        "value": "project_profile", "label": "Project profile",
        "description": "A factual summary of a contract we delivered: what, for whom, how big and how long.",
        "use_when": "You need to record relevant experience to cite in bids. Simpler than a case study, with no outcomes narrative needed.",
        "includes": ["Project description", "Services delivered", "Contract value and duration", "Sector and location"],
    },
    {
        "value": "bid_submission", "label": "Bid submission",
        "description": "A record of a tender response we submitted, won or lost, so its approach and lessons can be reused.",
        "use_when": "A tender has closed and you want to capture the methodology, key client answers and what we learned.",
        "includes": ["Executive summary", "Methodology", "Client question responses", "Outcome and lessons learned"],
    },
    {
        "value": "template", "label": "Template",
        "description": "A reusable starting point for common tender sections or documents.",
        "use_when": "You have a structure or standard response others should start from instead of writing from scratch.",
        "includes": ["Purpose of the template", "Section outline"],
    },
    {
        "value": "good_news_story", "label": "Good-news story",
        "description": "A short, shareable story about a team, client or project milestone.",
        "use_when": "Something worth celebrating happened (an award, milestone or client recognition) that could support future bids.",
        "includes": ["The story", "Highlights"],
    },
    {
        "value": "capability_statement", "label": "Capability statement",
        "description": "An overview of what a sector or business unit can deliver.",
        "use_when": "You need a concise description of our services and strengths for an EOI, a pre-qualification or a client briefing.",
        "includes": ["Statement of capability", "List of capabilities"],
    },
    {
        "value": "image", "label": "Image / graphic",
        "description": "Approved project photography, diagrams or graphics for use in submissions.",
        "use_when": "You have cleared visuals from a project that others can drop into tenders and presentations.",
        "includes": ["Caption", "Photographer or source"],
    },
]
RESTRICTED_FLAGS = [
    {"value": "pricing", "label": "Pricing information"},
    {"value": "current_tender", "label": "Current tender response"},
    {"value": "government", "label": "Government contract"},
    {"value": "nda", "label": "NDA-protected"},
    {"value": "client_sensitive", "label": "Client-sensitive"},
    {"value": "referee", "label": "Referee information"},
    {"value": "cv", "label": "Employee CV"},
]
VISIBILITY = [
    {"value": "sector_only", "label": "Sector only", "description": "Visible only to the originating sector (default)."},
    {"value": "shared", "label": "Shared", "description": "Visible to the originating sector and selected sectors."},
    {"value": "enterprise", "label": "Enterprise", "description": "Visible organisation-wide."},
]
CONFIDENTIALITY = ["Public", "Internal", "Confidential", "Restricted"]
DATA_SOURCES = [
    {"value": "salesforce", "label": "Salesforce export", "description": "A row from salesforce_synthetic_cut.xlsx, or a person named in it."},
    {"value": "synthetic", "label": "Synthetic", "description": "Generated for the demo. Only columns populated in the export are filled."},
    {"value": "user", "label": "User submitted", "description": "Submitted through this app."},
]


@bp.get("/me")
def me():
    return jsonify(current_user())


@bp.get("/meta")
def meta():
    db = get_db()
    sectors = rows(db.execute("SELECT * FROM sectors ORDER BY name"))
    offerings = {s["name"]: s["offerings"] for s in C.SECTORS}
    for s in sectors:
        bus = {o["bu"] for o in offerings[s["name"]]}
        lobs = {o["lob"] for o in offerings[s["name"]]}
        for r in db.execute('SELECT DISTINCT "Business_Unit__c", "Line_of_Business__c", "Discipline__c" FROM opportunities WHERE "Division__c" = ?', (s["name"],)):
            if r[0]:
                bus.add(r[0])
            if r[1]:
                lobs.add(r[1])
        s["business_units"] = sorted(bus)
        s["service_lines"] = sorted(lobs)
    clients = [r[0] for r in db.execute('SELECT DISTINCT "Opportunity_Parent_Account_Name__c" FROM opportunities WHERE "Opportunity_Parent_Account_Name__c" IS NOT NULL ORDER BY 1')]
    return jsonify({
        "sectors": sectors,
        "users": rows(db.execute("SELECT * FROM users ORDER BY sector, role")),
        "regions": [{"value": r, "label": C.REGION_NAMES[r]} for r in C.REGIONS + ["National"]],
        "content_types": [t | {"review_months": C.CONTENT_REVIEW_MONTHS[t["value"]]} for t in CONTENT_TYPES],
        "value_ranges": C.CONTRACT_VALUE_OPTIONS,
        "confidentiality": CONFIDENTIALITY,
        "restricted_flags": RESTRICTED_FLAGS,
        "visibility": VISIBILITY,
        "clients": clients,
        "stages": [r[0] for r in db.execute('SELECT DISTINCT "StageName" FROM opportunities ORDER BY 1')],
        # Only expertise that actually occurs (estimator/commercial/legal columns are empty in the export).
        "expertise": [r[0] for r in db.execute("SELECT DISTINCT j.value FROM contacts, json_each(contacts.expertise) j ORDER BY 1")],
        "data_sources": DATA_SOURCES,
    })


@bp.get("/stats")
def stats():
    db, user = get_db(), current_user()
    c_sql, c_params = content_clause(user)
    o_sql, o_params = opportunity_clause(user)
    today = dt.date.today().isoformat()
    by_type = dict(db.execute(f"SELECT type, COUNT(*) FROM content_items c WHERE {c_sql} AND c.approval_status = 'approved' GROUP BY type", c_params).fetchall())
    opp = db.execute(
        f"SELECT SUM(CASE WHEN status = 'won' THEN tcv END), SUM(CASE WHEN status = 'open' THEN tcv END), "
        f"SUM(status = 'won'), SUM(status = 'lost'), SUM(status = 'open') FROM opportunity_facets f WHERE {o_sql}", o_params).fetchone()
    due = db.execute("SELECT COUNT(*) FROM content_items WHERE sector = ? AND review_date <= date(?, '+30 days')", (user["sector"], today)).fetchone()[0]
    recent = rows(db.execute(
        f"SELECT id, type, title, summary, sector, client, geography, contract_value, visibility, owner, updated_at "
        f"FROM content_items c WHERE {c_sql} AND c.approval_status = 'approved' AND c.type IN ('case_study', 'project_profile', 'good_news_story', 'bid_submission') "
        f"ORDER BY updated_at DESC LIMIT 6", c_params))
    sectors = []
    for s in db.execute("SELECT name, short_name, description FROM sectors ORDER BY name"):
        n = db.execute(f"SELECT COUNT(*) FROM content_items c WHERE {c_sql} AND c.sector = ?", c_params + [s[0]]).fetchone()[0]
        w = db.execute(f"SELECT COUNT(*), SUM(tcv) FROM opportunity_facets f WHERE {o_sql} AND f.sector = ? AND f.status = 'won'", o_params + [s[0]]).fetchone()
        sectors.append({"name": s[0], "short_name": s[1], "description": s[2], "content_count": n, "won_count": w[0], "won_tcv": w[1] or 0})
    return jsonify({
        "content_by_type": by_type, "content_total": sum(by_type.values()),
        "won_tcv": opp[0] or 0, "pipeline_tcv": opp[1] or 0, "won": opp[2] or 0, "lost": opp[3] or 0, "open": opp[4] or 0,
        "contacts": db.execute("SELECT COUNT(*) FROM contacts").fetchone()[0],
        "due_for_review": due, "recent": recent, "sectors": sectors,
    })
