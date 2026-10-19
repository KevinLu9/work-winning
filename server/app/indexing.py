"""Keeps search_docs + the FTS5 search_index in sync with content, opportunities and contacts."""
import json

CONTENT_TEXT_KEYS = (
    "description", "scope", "challenge", "solution", "outcomes", "executive_summary", "methodology",
    "lessons_learned", "story", "highlights", "statement", "capabilities", "caption", "sections",
    "services_delivered", "client_responses", "service_offering",
)


def _flatten(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return " ".join(_flatten(v) for v in value)
    if isinstance(value, dict):
        return " ".join(_flatten(v) for v in value.values())
    return ""


def _upsert(db, doc: dict, title: str, body: str, tags: str) -> None:
    row = db.execute(
        "SELECT rowid FROM search_docs WHERE entity_type = ? AND entity_id = ?",
        (doc["entity_type"], doc["entity_id"]),
    ).fetchone()
    cols = list(doc)
    if row:
        rowid = row[0]
        db.execute(
            f"UPDATE search_docs SET {', '.join(f'{c} = ?' for c in cols)} WHERE rowid = ?",
            [doc[c] for c in cols] + [rowid],
        )
        db.execute("DELETE FROM search_index WHERE rowid = ?", (rowid,))
    else:
        cur = db.execute(
            f"INSERT INTO search_docs ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
            [doc[c] for c in cols],
        )
        rowid = cur.lastrowid
    db.execute("INSERT INTO search_index (rowid, title, body, tags) VALUES (?, ?, ?, ?)", (rowid, title, body, tags))


def index_content(db, item: dict) -> None:
    body = json.loads(item["body_json"]) if isinstance(item.get("body_json"), str) else (item.get("body_json") or {})
    text = " ".join(_flatten(body.get(k)) for k in CONTENT_TEXT_KEYS)
    tags = " ".join(filter(None, [
        item["type"].replace("_", " "), item.get("sector"), item.get("business_unit"), item.get("service_line"),
        item.get("client"), item.get("geography"), " ".join(json.loads(item.get("tags") or "[]")),
    ]))
    _upsert(db, {
        "entity_type": "content",
        "entity_id": item["id"],
        "doc_type": item["type"],
        "title": item["title"],
        "subtitle": item.get("client"),
        "sector": item["sector"],
        "client": item.get("client"),
        "region": item.get("geography"),
        "service_line": item.get("service_line"),
        "value": item.get("contract_value"),
        "status": body.get("outcome_status"),
        "visibility": item["visibility"],
        "is_restricted": item.get("is_restricted", 0),
        "approval_status": item.get("approval_status", "approved"),
        "owner": item.get("owner"),
        "updated_at": item.get("updated_at"),
        "source": item.get("data_source", "synthetic"),
    }, item["title"], f"{item.get('summary') or ''} {text}", tags)


def index_opportunity(db, opp: dict, facets: dict) -> None:
    body = " ".join(filter(None, [
        opp.get("Scope_of_Works__c"), opp.get("Short_Opportunity_Name__c"), opp.get("Win_Strategy__c"),
        opp.get("Competitor_Analysis__c"), opp.get("Reason_Won_Lost__c"),
    ]))
    tags = " ".join(filter(None, [
        "opportunity", opp.get("Division__c"), opp.get("Business_Unit__c"), opp.get("Line_of_Business__c"),
        opp.get("Discipline__c"), opp.get("Opportunity_Parent_Account_Name__c"), opp.get("Project_Location__c"),
        opp.get("StageName"), opp.get("Opportunity_Status__c"), opp.get("New_or_Renewal_Work__c"),
        facets.get("regions", "").replace(",", " "),
    ]))
    _upsert(db, {
        "entity_type": "opportunity",
        "entity_id": opp["ItemInternalId"],
        "doc_type": "opportunity",
        "title": opp.get("Name") or "(unnamed opportunity)",
        "subtitle": opp.get("Opportunity_Parent_Account_Name__c"),
        "sector": facets["sector"],
        "client": facets["client"],
        "region": facets["region"],
        "service_line": facets["service_line"],
        "value": facets["tcv"],
        "status": facets["status"],
        # Salesforce "Restricted" classification behaves like sector-only restricted content.
        "visibility": "sector_only" if facets["is_restricted"] else "enterprise",
        "is_restricted": facets["is_restricted"],
        "approval_status": "approved",
        "owner": opp.get("Proposal_Manager__c"),
        "updated_at": opp.get("LastModifiedDate"),
        "source": facets["source"],
    }, opp.get("Name") or "", body, tags)


def index_contact(db, c: dict) -> None:
    expertise = json.loads(c["expertise"])
    roles = json.loads(c["roles"])
    tags = " ".join(["contact", "expert", "people"] + expertise + roles + json.loads(c["sectors"]))
    body = " ".join(filter(None, [c.get("title"), c.get("bio"), " ".join(json.loads(c["clients"])),
                                   " ".join(json.loads(c["service_lines"]))]))
    _upsert(db, {
        "entity_type": "contact",
        "entity_id": c["id"],
        "doc_type": "contact",
        "title": c["name"],
        "subtitle": c.get("title"),
        "sector": c.get("primary_sector"),
        "client": None,
        "region": c.get("location"),
        "service_line": None,
        "value": None,
        "status": None,
        "visibility": "enterprise",
        "is_restricted": 0,
        "approval_status": "approved",
        "owner": None,
        "updated_at": None,
        "source": c.get("data_source", "synthetic"),
    }, c["name"], body, tags)
