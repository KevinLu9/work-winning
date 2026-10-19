"""Enterprise search (BRD §6.1): FTS5 keyword search + rule-based natural-language parsing + facets.

The parser turns phrases like "water treatment projects in VIC over $5m" into structured
filters (region=VIC, value_min=5,000,000) and leaves the remaining words as keywords. This is
deliberately deterministic: AI search is a deferred capability (BRD §10/§12).
"""
import re

from .permissions import content_clause

REGION_WORDS = [
    (r"new south wales", ["NSW"]), (r"western australia", ["WA"]), (r"south australia", ["SA"]),
    (r"northern territory", ["NT"]), (r"australian capital territory", ["ACT"]), (r"new zealand", ["NZ North", "NZ South"]),
    (r"north island", ["NZ North"]), (r"south island", ["NZ South"]),
    (r"queensland", ["QLD"]), (r"victoria", ["VIC"]), (r"tasmania", ["TAS"]),
    (r"nation(?:al|wide)", ["National"]),
]
REGION_CODES = {"QLD": ["QLD"], "NSW": ["NSW"], "VIC": ["VIC"], "WA": ["WA"], "SA": ["SA"], "TAS": ["TAS"],
                "NT": ["NT"], "ACT": ["ACT"], "NZ": ["NZ North", "NZ South"]}

SECTOR_WORDS = [
    (r"defence (?:&|and) social infrastructure|d&si|dsi|social infrastructure|defence sector", "Defence & Social Infrastructure"),
    (r"telecommunications|telco|telecoms?", "Telecommunications"),
    (r"infrastructure services", "Infrastructure Services"),
    (r"corporate services", "Corporate Services"),
    (r"transport(?! for)", "Transport"),
]

TYPE_WORDS = [
    (r"case stud(?:y|ies)", "case_study"),
    (r"project profiles?", "project_profile"),
    (r"bid submissions?|tender responses?|submissions?|bids?", "bid_submission"),
    (r"templates?", "template"),
    (r"good[- ]news(?: stor(?:y|ies))?", "good_news_story"),
    (r"capability statements?", "capability_statement"),
    (r"photos?|images?|pictures?|graphics?", "image"),
    (r"contacts?|experts?|people|specialists?|who (?:knows|has worked|can help)", "contact"),
    (r"opportunit(?:y|ies)", "opportunity"),
]

STATUS_WORDS = [
    (r"completed|won|delivered|successful|winning", "won"),
    (r"lost|unsuccessful", "lost"),
    (r"open|active|current|live|in progress|pipeline", "open"),
]

CLIENT_ALIASES = {
    "nbn": "nbn co", "optus": "optus", "telstra": "telstra", "tpg": "tpg", "chorus": "chorus", "spark": "spark nz",
    "rio tinto": "rio tinto", "bhp": "bhp", "fortescue": "fortescue", "south32": "south32",
    "seq water": "seq water", "sydney water": "sydney water", "melbourne water": "melbourne water",
    "yarra valley water": "yarra valley water", "watercare": "watercare", "tmr": "transport and main roads",
    "main roads": "transport and main roads", "tfnsw": "transport for nsw", "transport for nsw": "transport for nsw",
    "waka kotahi": "waka kotahi", "nzta": "waka kotahi", "kiwirail": "kiwirail", "transurban": "transurban",
    "sydney trains": "sydney trains", "queensland rail": "queensland rail", "metro trains": "metro trains",
    "department of defence": "department of defence", "queensland health": "queensland health",
    "te whatu ora": "te whatu ora", "service nsw": "service nsw",
}

SYNONYMS = {"local government": "council", "councils": "council", "water-treatment": "water treatment"}

STOPWORDS = set("""
a an the and or of in on for to at by with from that which what where who whose me show find search list give get
i we our us need want looking look examples example similar relevant all any some project projects work works
done recent past have has been were was is are be about across within around near than more over under above below
between less greater min max minimum maximum least most please can you do did
""".split())

UNITS = {"k": 1e3, "m": 1e6, "mil": 1e6, "million": 1e6, "b": 1e9, "bn": 1e9, "billion": 1e9}
NUM = r"\$?\s*(\d+(?:\.\d+)?)\s*(k|m|mil|million|bn|b|billion)?\b"

VALUE_RANGES = [("<$1m", 0, 1e6), ("$1–10m", 1e6, 1e7), ("$10–50m", 1e7, 5e7), ("$50–100m", 5e7, 1e8), (">$100m", 1e8, None)]

FACETS = ["doc_type", "sector", "region", "client", "service_line", "status", "source"]


def _num(value, unit):
    return float(value) * UNITS.get((unit or "").lower(), 1)


def _fmt_money(v):
    if v >= 1e9:
        return f"${v / 1e9:g}b"
    if v >= 1e6:
        return f"${v / 1e6:g}m"
    if v >= 1e3:
        return f"${v / 1e3:g}k"
    return f"${v:g}"


def parse_query(q: str, clients: list[str]) -> dict:
    """Return {'keywords', 'filters', 'chips'} parsed from a natural-language query."""
    text = f" {q.strip()} "
    filters: dict = {}
    chips: list[dict] = []

    def take(pattern, flags=re.I):
        nonlocal text
        m = re.search(pattern, text, flags)
        if m:
            text = text[: m.start()] + " " + text[m.end():]
        return m

    for phrase, repl in SYNONYMS.items():
        text = re.sub(rf"\b{re.escape(phrase)}\b", repl, text, flags=re.I)

    # Contract value
    m = take(rf"\bbetween\s+{NUM}\s+(?:and|-|to)\s+{NUM}")
    if m:
        filters["value_min"], filters["value_max"] = _num(m[1], m[2] or m[4]), _num(m[3], m[4])
    else:
        m = take(rf"(?:\bover|\babove|\bmore than|\bgreater than|>|\bat least|\bminimum)\s*{NUM}")
        if m:
            filters["value_min"] = _num(m[1], m[2])
        m = take(rf"(?:\bunder|\bbelow|\bless than|<|\bup to|\bmaximum)\s*{NUM}")
        if m:
            filters["value_max"] = _num(m[1], m[2])
    if "value_min" in filters:
        chips.append({"key": "value_min", "value": filters["value_min"], "label": f"Value ≥ {_fmt_money(filters['value_min'])}"})
    if "value_max" in filters:
        chips.append({"key": "value_max", "value": filters["value_max"], "label": f"Value ≤ {_fmt_money(filters['value_max'])}"})

    # Clients (before regions/sectors so "Transport for NSW" / "Queensland Health" stay intact)
    lowered_clients = [(c, c.lower()) for c in clients if c]
    for alias in sorted(CLIENT_ALIASES, key=len, reverse=True):
        if take(rf"\b{re.escape(alias)}\b"):
            matched = [c for c, lc in lowered_clients if CLIENT_ALIASES[alias] in lc]
            for c in matched:
                filters.setdefault("client", [])
                if c not in filters["client"]:
                    filters["client"].append(c)
                    chips.append({"key": "client", "value": c, "label": f"Client: {c}"})
    for c, lc in sorted(lowered_clients, key=lambda x: -len(x[1])):
        if len(lc) > 6 and take(rf"\b{re.escape(lc)}\b"):
            filters.setdefault("client", [])
            if c not in filters["client"]:
                filters["client"].append(c)
                chips.append({"key": "client", "value": c, "label": f"Client: {c}"})

    # Regions
    regions: list[str] = []
    for pattern, codes in REGION_WORDS:
        if take(rf"\b{pattern}\b"):
            regions += codes
    for code, codes in REGION_CODES.items():
        # Upper-case codes anywhere, or lower-case after a preposition ("in vic")
        if take(rf"\b{code}\b", flags=0) or take(rf"\b(?:in|across|within|around)\s+{code.lower()}\b", flags=0):
            regions += codes
    for r in dict.fromkeys(regions):
        filters.setdefault("region", []).append(r)
        chips.append({"key": "region", "value": r, "label": f"Region: {r}"})

    # Sectors
    for pattern, sector in SECTOR_WORDS:
        if take(rf"\b(?:{pattern})\b(?: sector)?"):
            filters.setdefault("sector", []).append(sector)
            chips.append({"key": "sector", "value": sector, "label": f"Sector: {sector}"})

    # Content / entity types
    for pattern, t in TYPE_WORDS:
        if take(rf"\b(?:{pattern})\b"):
            if t not in filters.get("doc_type", []):
                filters.setdefault("doc_type", []).append(t)
                chips.append({"key": "doc_type", "value": t, "label": f"Type: {t.replace('_', ' ')}"})

    # Outcome status
    for pattern, status in STATUS_WORDS:
        if take(rf"\b(?:{pattern})\b"):
            filters.setdefault("status", []).append(status)
            chips.append({"key": "status", "value": status, "label": f"Status: {status}"})

    words = [w for w in re.findall(r"[A-Za-z0-9&']+", text) if w.lower() not in STOPWORDS and len(w) > 1]
    return {"keywords": " ".join(words), "filters": filters, "chips": chips}


def fts_expression(keywords: str, mode="AND") -> str | None:
    tokens = [t for t in re.findall(r"[A-Za-z0-9]+", keywords) if len(t) > 1]
    if not tokens:
        return None
    return f" {mode} ".join(f'"{t}"*' for t in tokens)


def _filter_sql(filters: dict, exclude: str | None = None):
    clauses, params = [], []
    for key in FACETS:
        if key == exclude:
            continue
        vals = filters.get(key)
        if not vals:
            continue
        clause = f"d.{key} IN ({', '.join('?' for _ in vals)})"
        params += vals
        if key == "client":
            # Contacts match a client filter when they have worked with that client.
            likes = " OR ".join("ct.clients LIKE ?" for _ in vals)
            clause = (f"({clause} OR (d.entity_type = 'contact' AND EXISTS "
                      f"(SELECT 1 FROM contacts ct WHERE ct.id = d.entity_id AND ({likes}))))")
            params += [f'%"{v}"%' for v in vals]
        clauses.append(clause)
    if exclude != "value_range" and filters.get("value_range"):
        ors = []
        for label, lo, hi in VALUE_RANGES:
            if label in filters["value_range"]:
                ors.append("(d.value >= ?" + (" AND d.value < ?)" if hi else ")"))
                params += [lo] + ([hi] if hi else [])
        if ors:
            clauses.append("(" + " OR ".join(ors) + ")")
    if filters.get("value_min") is not None:
        clauses.append("d.value >= ?")
        params.append(filters["value_min"])
    if filters.get("value_max") is not None:
        clauses.append("d.value <= ?")
        params.append(filters["value_max"])
    return clauses, params


def _base(db, user, fts, filters, exclude=None):
    perm_sql, perm_params = content_clause(user, "d", "d.entity_id")
    clauses, params = _filter_sql(filters, exclude)
    where = " AND ".join([perm_sql] + clauses)
    if fts:
        return (f"FROM search_index JOIN search_docs d ON d.rowid = search_index.rowid "
                f"WHERE search_index MATCH ? AND {where}", [fts] + perm_params + params)
    return f"FROM search_docs d WHERE {where}", perm_params + params


def run_search(db, user, keywords: str, filters: dict, limit=60, offset=0) -> dict:
    relaxed = False
    fts = fts_expression(keywords)
    from_sql, params = _base(db, user, fts, filters)
    total = db.execute(f"SELECT COUNT(*) {from_sql}", params).fetchone()[0]
    if fts and total == 0 and len(keywords.split()) > 1:
        fts = fts_expression(keywords, "OR")
        relaxed = True
        from_sql, params = _base(db, user, fts, filters)
        total = db.execute(f"SELECT COUNT(*) {from_sql}", params).fetchone()[0]

    if fts:
        select = ("SELECT d.*, bm25(search_index, 10.0, 3.0, 4.0) AS score, "
                  "snippet(search_index, 1, '[[', ']]', ' … ', 24) AS snippet ")
        order = " ORDER BY score"
    else:
        select = "SELECT d.*, 0 AS score, NULL AS snippet "
        order = " ORDER BY CASE d.entity_type WHEN 'content' THEN 0 WHEN 'opportunity' THEN 1 ELSE 2 END, d.updated_at DESC"
    results = [dict(r) for r in db.execute(f"{select}{from_sql}{order} LIMIT ? OFFSET ?", params + [limit, offset])]

    facets = {}
    for key in FACETS:
        f_sql, f_params = _base(db, user, fts, filters, exclude=key)
        facets[key] = [{"value": r[0], "count": r[1]} for r in db.execute(
            f"SELECT d.{key}, COUNT(*) {f_sql} AND d.{key} IS NOT NULL GROUP BY d.{key} ORDER BY COUNT(*) DESC LIMIT 25", f_params)]
    f_sql, f_params = _base(db, user, fts, filters, exclude="value_range")
    case = " ".join(f"WHEN d.value >= {lo}" + (f" AND d.value < {hi}" if hi else "") + f" THEN '{label}'" for label, lo, hi in VALUE_RANGES)
    counts = dict(db.execute(f"SELECT CASE {case} END AS b, COUNT(*) {f_sql} AND d.value IS NOT NULL GROUP BY b", f_params).fetchall())
    facets["value_range"] = [{"value": label, "count": counts.get(label, 0)} for label, _, _ in VALUE_RANGES]

    terms = [t for t in re.findall(r"[A-Za-z0-9]+", keywords) if len(t) > 1]
    return {"total": total, "results": results, "facets": facets, "terms": terms, "relaxed": relaxed}


def similar_content(db, user, title: str, limit=3) -> list[dict]:
    words = [w for w in re.findall(r"[A-Za-z0-9]+", title) if w.lower() not in STOPWORDS and len(w) > 2]
    fts = fts_expression(" ".join(words), "OR")
    if not fts:
        return []
    from_sql, params = _base(db, user, fts, {})
    return [dict(r) for r in db.execute(
        f"SELECT d.entity_id, d.doc_type, d.title, d.sector, d.client, bm25(search_index, 10.0, 3.0, 4.0) AS score "
        f"{from_sql} AND d.entity_type = 'content' ORDER BY score LIMIT ?", params + [limit])]
