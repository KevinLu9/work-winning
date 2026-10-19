/**
 * In-browser port of the Flask routes in server/app/routes/*.py, used only by the single-file
 * shareable build. Each handler mirrors its Python counterpart (same SQL, same response shape).
 * Keep in step with the server; `npm run test:parity` compares both against the same database.
 */
import { ApiError } from "@/lib/errors"
import { all, get, nowIso, round, rowToDict, rows, run, todayIso, value } from "./sql"
import { canApprove, canEdit, contentClause, isEnterpriseAdmin, opportunityClause, type User } from "./permissions"
import { FACETS, parseQuery, runSearch, similarContent, type Filters } from "./search"

export interface Bootstrap {
  mode: "synthetic" | "real"
  meta: Record<string, any>
  constants: {
    groups: string[]
    people_fields: Record<string, string>
    region_prefix: Record<string, string>
    review_months: Record<string, number>
    value_options: string[]
    stage_order: string[]
  }
}

let boot: Bootstrap

export function setBootstrap(b: Bootstrap) {
  boot = b
}

const notFound = () => new ApiError(404, "Not found or you do not have access")

function currentUser(userId: string): User {
  const user = get<User>("SELECT * FROM users WHERE id = ?", [userId])
  if (!user) throw new ApiError(403, `Unknown user ${userId}`)
  return user
}

function audit(user: User | null, action: string, entityType: string | null = null, entityId: string | null = null, detail?: unknown) {
  run("INSERT INTO audit_log (ts, user_id, action, entity_type, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)",
    [nowIso(), user?.id ?? null, action, entityType, entityId, detail ? JSON.stringify(detail) : null])
}

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ")

// ---------------------------------------------------------------- indexing (server/app/indexing.py)
const CONTENT_TEXT_KEYS = [
  "description", "scope", "challenge", "solution", "outcomes", "executive_summary", "methodology",
  "lessons_learned", "story", "highlights", "statement", "capabilities", "caption", "sections",
  "services_delivered", "client_responses", "service_offering",
]

function flatten(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string") return v
  if (typeof v === "number") return String(v)
  if (Array.isArray(v)) return v.map(flatten).join(" ")
  if (typeof v === "object") return Object.values(v as object).map(flatten).join(" ")
  return ""
}

function indexContent(item: Record<string, any>) {
  const body = typeof item.body_json === "string" ? JSON.parse(item.body_json) : item.body_json ?? {}
  const text = CONTENT_TEXT_KEYS.map((k) => flatten(body[k])).join(" ")
  const tags = [item.type.replace(/_/g, " "), item.sector, item.business_unit, item.service_line, item.client, item.geography,
    (JSON.parse(item.tags || "[]") as string[]).join(" ")].filter(Boolean).join(" ")
  const doc: Record<string, unknown> = {
    entity_type: "content", entity_id: item.id, doc_type: item.type, title: item.title, subtitle: item.client ?? null,
    sector: item.sector, client: item.client ?? null, region: item.geography ?? null, service_line: item.service_line ?? null,
    value: item.contract_value ?? null, status: body.outcome_status ?? null, visibility: item.visibility,
    is_restricted: item.is_restricted ?? 0, approval_status: item.approval_status ?? "approved", owner: item.owner ?? null,
    updated_at: item.updated_at ?? null, source: item.data_source ?? "synthetic",
  }
  const cols = Object.keys(doc)
  const existing = get<{ rowid: number }>("SELECT rowid FROM search_docs WHERE entity_type = ? AND entity_id = ?", ["content", item.id])
  let rowid: number
  if (existing) {
    rowid = existing.rowid
    run(`UPDATE search_docs SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE rowid = ?`, [...cols.map((c) => doc[c]), rowid])
    run("DELETE FROM search_index WHERE rowid = ?", [rowid])
  } else {
    rowid = run(`INSERT INTO search_docs (${cols.join(", ")}) VALUES (${placeholders(cols.length)})`, cols.map((c) => doc[c]))
  }
  run("INSERT INTO search_index (rowid, title, body, tags) VALUES (?, ?, ?, ?)", [rowid, item.title, `${item.summary ?? ""} ${text}`, tags])
}

// ---------------------------------------------------------------- meta (routes/meta.py)
function stats(user: User) {
  const [cSql, cParams] = contentClause(user)
  const [oSql, oParams] = opportunityClause(user)
  const byType = Object.fromEntries(all<{ type: string; n: number }>(
    `SELECT type, COUNT(*) AS n FROM content_items c WHERE ${cSql} AND c.approval_status = 'approved' GROUP BY type`, cParams).map((r) => [r.type, r.n]))
  const opp = get<Record<string, number | null>>(
    `SELECT SUM(CASE WHEN status = 'won' THEN tcv END) AS won_tcv, SUM(CASE WHEN status = 'open' THEN tcv END) AS pipeline_tcv, ` +
    `SUM(status = 'won') AS won, SUM(status = 'lost') AS lost, SUM(status = 'open') AS open FROM opportunity_facets f WHERE ${oSql}`, oParams)!
  const due = value<number>("SELECT COUNT(*) FROM content_items WHERE sector = ? AND review_date <= date(?, '+30 days')", [user.sector, todayIso()])
  const recent = rows(
    `SELECT id, type, title, summary, sector, client, geography, contract_value, visibility, owner, updated_at ` +
    `FROM content_items c WHERE ${cSql} AND c.approval_status = 'approved' AND c.type IN ('case_study', 'project_profile', 'good_news_story', 'bid_submission') ` +
    `ORDER BY updated_at DESC LIMIT 6`, cParams)
  const sectors = all<{ name: string; short_name: string; description: string }>("SELECT name, short_name, description FROM sectors ORDER BY name").map((s) => {
    const n = value<number>(`SELECT COUNT(*) FROM content_items c WHERE ${cSql} AND c.sector = ?`, [...cParams, s.name])
    const w = get<{ n: number; tcv: number | null }>(
      `SELECT COUNT(*) AS n, SUM(tcv) AS tcv FROM opportunity_facets f WHERE ${oSql} AND f.sector = ? AND f.status = 'won'`, [...oParams, s.name])!
    return { name: s.name, short_name: s.short_name, description: s.description, content_count: n, won_count: w.n, won_tcv: w.tcv ?? 0 }
  })
  return {
    content_by_type: byType, content_total: Object.values(byType).reduce((a, b) => a + b, 0),
    won_tcv: opp.won_tcv ?? 0, pipeline_tcv: opp.pipeline_tcv ?? 0, won: opp.won ?? 0, lost: opp.lost ?? 0, open: opp.open ?? 0,
    contacts: value<number>("SELECT COUNT(*) FROM contacts"), due_for_review: due, recent, sectors,
  }
}

// ---------------------------------------------------------------- search (routes/search.py)
function search(user: User, q: URLSearchParams) {
  const query = (q.get("q") ?? "").trim()
  const filters: Filters = {}
  for (const k of [...FACETS, "value_range"]) if (q.getAll(k).length) filters[k] = q.getAll(k)
  for (const k of ["value_min", "value_max"]) if (q.get(k)) filters[k] = parseFloat(q.get(k)!)

  let parsed: { keywords: string; filters: Filters; chips: unknown[] } = { keywords: query, filters: {}, chips: [] }
  if (query && q.get("parse") !== "0") {
    const clients = all<{ client: string }>("SELECT DISTINCT client FROM search_docs WHERE client IS NOT NULL").map((r) => r.client)
    parsed = parseQuery(query, clients)
    for (const [k, v] of Object.entries(parsed.filters)) {
      if (Array.isArray(v)) filters[k] = [...new Set([...((filters[k] as string[]) ?? []), ...v])]
      else if (filters[k] === undefined) filters[k] = v
    }
  }
  const limit = Math.min(parseInt(q.get("limit") ?? "60", 10), 200)
  const result = runSearch(user, parsed.keywords, filters, limit, parseInt(q.get("offset") ?? "0", 10))
  audit(user, "search", "search", null, { q: query, filters, total: result.total })
  return { ...result, query, keywords: parsed.keywords, chips: parsed.chips, filters }
}

// ---------------------------------------------------------------- content (routes/content.py)
const MANDATORY = ["type", "title", "sector", "business_unit", "service_line", "contract_value_range", "client", "geography", "confidentiality", "owner", "review_date"]
const EDITABLE = ["title", "summary", "body", "business_unit", "service_line", "contract_value", "contract_value_range", "client",
  "geography", "confidentiality", "visibility", "shares", "restricted_flags", "owner", "review_date", "expiry_date", "tags"]
const LIST_COLUMNS = "id, type, title, summary, sector, business_unit, service_line, contract_value, contract_value_range, client, " +
  "geography, confidentiality, visibility, restricted_flags, is_restricted, owner, review_date, expiry_date, " +
  "approval_status, version, source_opportunity_id, data_source, updated_at, body_json"

function getVisible(user: User, id: string) {
  const [sql, params] = contentClause(user)
  const row = get(`SELECT * FROM content_items c WHERE c.id = ? AND ${sql}`, [id, ...params])
  if (!row) throw notFound()
  return row
}

function validate(data: Record<string, any>, partial = false) {
  const errors: Record<string, string> = {}
  if (!partial) for (const f of MANDATORY) if (!String(data[f] || "").trim()) errors[f] = "Required"
  const types = (boot.meta.content_types as { value: string }[]).map((t) => t.value)
  const flags = (boot.meta.restricted_flags as { value: string }[]).map((f) => f.value)
  if (data.type && !types.includes(data.type)) errors.type = "Unknown content type"
  if (data.confidentiality && !(boot.meta.confidentiality as string[]).includes(data.confidentiality)) errors.confidentiality = "Unknown confidentiality level"
  if (data.contract_value_range && !boot.constants.value_options.includes(data.contract_value_range)) errors.contract_value_range = "Unknown value range"
  if (data.visibility && !["sector_only", "shared", "enterprise"].includes(data.visibility)) errors.visibility = "Unknown visibility"
  if (data.visibility === "shared" && !data.shares?.length) errors.shares = "Select at least one sector to share with"
  const bad = ((data.restricted_flags ?? []) as string[]).filter((f) => !flags.includes(f))
  if (bad.length) errors.restricted_flags = `Unknown flags: ${bad.join(", ")}`
  if (data.review_date && !(/^\d{4}-\d{2}-\d{2}$/.test(data.review_date) && !Number.isNaN(Date.parse(data.review_date)))) errors.review_date = "Use YYYY-MM-DD"
  if (Object.keys(errors).length) throw new ApiError(400, "Validation failed", errors)
}

function writeLinks(id: string, data: Record<string, any>) {
  run("DELETE FROM content_shares WHERE content_id = ?", [id])
  if (data.visibility === "shared") for (const s of data.shares ?? []) run("INSERT OR IGNORE INTO content_shares VALUES (?, ?)", [id, s])
}

function listContent(user: User, q: URLSearchParams) {
  const [sql, p] = contentClause(user)
  const clauses = [sql]
  const params = [...p]
  for (const key of ["type", "sector", "geography", "service_line"]) {
    const vals = q.getAll(key)
    if (vals.length) {
      clauses.push(`c.${key} IN (${placeholders(vals.length)})`)
      params.push(...vals)
    }
  }
  const status = q.get("approval_status") ?? "approved"
  if (status !== "all") {
    clauses.push("c.approval_status = ?")
    params.push(status)
  }
  if (q.get("q")) {
    clauses.push("(c.title LIKE ? OR c.summary LIKE ? OR c.client LIKE ?)")
    params.push(...Array(3).fill(`%${q.get("q")}%`))
  }
  const order = ({ recent: "c.updated_at DESC", value: "c.contract_value DESC", title: "c.title" } as Record<string, string>)[q.get("sort") ?? ""] ?? "c.updated_at DESC"
  const where = clauses.join(" AND ")
  const total = value<number>(`SELECT COUNT(*) FROM content_items c WHERE ${where}`, params)
  const limit = Math.min(parseInt(q.get("limit") ?? "48", 10), 200)
  const items = rows(`SELECT ${LIST_COLUMNS} FROM content_items c WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...params, limit, parseInt(q.get("offset") ?? "0", 10)])
  return { total, items }
}

function getContent(user: User, id: string) {
  const item = rowToDict<Record<string, any>>(getVisible(user, id))
  item.shares = all<{ sector: string }>("SELECT sector FROM content_shares WHERE content_id = ?", [id]).map((r) => r.sector)
  item.contacts = rows("SELECT ct.id, ct.name, ct.title, ct.primary_sector, ct.expertise, cc.role FROM content_contacts cc " +
    "JOIN contacts ct ON ct.id = cc.contact_id WHERE cc.content_id = ? ORDER BY cc.role", [id])
  item.versions = rows("SELECT version, changed_by, changed_at, summary FROM content_versions WHERE content_id = ? ORDER BY version DESC", [id])
  item.opportunity = null
  if (item.source_opportunity_id) {
    const [oSql, oParams] = opportunityClause(user)
    item.opportunity = get(
      `SELECT o."ItemInternalId" AS id, o."Name" AS name, o."StageName" AS stage, o."Opportunity_Status__c" AS status, ` +
      `o."TCV_Converted__c" AS tcv, o."CloseDate" AS close_date, o."Proposal_Teamsite__c" AS teamsite, ` +
      `o."BRS_Opportunity_Number__c" AS brs_number, o."Won_Lost_Reason__c" AS reasons, f.client, f.region, f.source ` +
      `FROM opportunities o JOIN opportunity_facets f ON f.opportunity_id = o."ItemInternalId" ` +
      `WHERE o."ItemInternalId" = ? AND ${oSql}`, [item.source_opportunity_id, ...oParams]) ?? null
  }
  const [cSql, cParams] = contentClause(user)
  item.related = rows(
    `SELECT id, type, title, sector FROM content_items c WHERE ${cSql} AND c.id != ? AND c.approval_status = 'approved' ` +
    `AND (c.source_opportunity_id = ? OR (c.service_line = ? AND c.type = ?)) ORDER BY c.source_opportunity_id = ? DESC LIMIT 5`,
    [...cParams, id, item.source_opportunity_id, item.service_line, item.type, item.source_opportunity_id])
  item.permissions = { can_edit: canEdit(user, item as { sector: string }), can_approve: canApprove(user, item.sector) }
  audit(user, "view", "content", id)
  return item
}

function randomId() {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
}

function createContent(user: User, data: Record<string, any>) {
  data.visibility ??= "sector_only" // Confidential by default (BRD §7, §13)
  validate(data)
  if (data.sector !== user.sector && !isEnterpriseAdmin(user)) throw new ApiError(403, "You can only submit content for your own sector")
  const flags = [...new Set((data.restricted_flags ?? []) as string[])].sort()
  const now = nowIso()
  const item: Record<string, any> = {
    id: `${data.type.slice(0, 2)}-${randomId()}`, type: data.type, title: data.title.trim(), summary: data.summary ?? null,
    body_json: JSON.stringify(data.body ?? {}), sector: data.sector, business_unit: data.business_unit, service_line: data.service_line,
    contract_value: data.contract_value ?? null, contract_value_range: data.contract_value_range, client: data.client,
    geography: data.geography, confidentiality: data.confidentiality, visibility: data.visibility,
    restricted_flags: JSON.stringify(flags), is_restricted: flags.length ? 1 : 0, owner: data.owner, review_date: data.review_date,
    expiry_date: data.expiry_date ?? null, approval_status: "pending", version: 1, source_opportunity_id: data.source_opportunity_id ?? null,
    tags: JSON.stringify(data.tags ?? []), data_source: "user", created_by: user.id, created_at: now, updated_at: now,
  }
  const cols = Object.keys(item)
  run(`INSERT INTO content_items (${cols.join(", ")}) VALUES (${placeholders(cols.length)})`, cols.map((c) => item[c]))
  writeLinks(item.id, data)
  run("INSERT INTO content_versions (content_id, version, changed_by, changed_at, summary) VALUES (?, 1, ?, ?, ?)",
    [item.id, user.name, now, "Submitted for approval"])
  if (item.source_opportunity_id) {
    run("INSERT OR IGNORE INTO content_contacts SELECT ?, contact_id, role FROM contact_opportunities WHERE opportunity_id = ?",
      [item.id, item.source_opportunity_id])
  }
  const owner = get<{ id: string }>("SELECT id FROM contacts WHERE name = ?", [item.owner])
  if (owner) run("INSERT OR IGNORE INTO content_contacts VALUES (?, ?, 'Content Owner')", [item.id, owner.id])
  indexContent(item)
  audit(user, "create", "content", item.id, { title: item.title, visibility: item.visibility })
  return { id: item.id, approval_status: "pending" }
}

function updateContent(user: User, id: string, raw: Record<string, any>, q: URLSearchParams) {
  const current = rowToDict<Record<string, any>>(getVisible(user, id))
  if (!canEdit(user, current as { sector: string })) throw new ApiError(403, "Only the originating sector can edit this content")
  const data = Object.fromEntries(Object.entries(raw).filter(([k]) => EDITABLE.includes(k)))
  validate(data, true)
  const updates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (k === "body") updates.body_json = JSON.stringify(v)
    else if (k === "restricted_flags" || k === "tags") {
      updates[k] = JSON.stringify([...new Set((v ?? []) as string[])].sort())
      if (k === "restricted_flags") updates.is_restricted = (v as string[] | null)?.length ? 1 : 0
    } else if (k !== "shares") updates[k] = v
  }
  const version = current.version + 1
  Object.assign(updates, { version, updated_at: nowIso() })
  if (!canApprove(user, current.sector)) updates.approval_status = "pending" // edits by contributors go back through approval
  const keys = Object.keys(updates)
  run(`UPDATE content_items SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`, [...keys.map((k) => updates[k]), id])
  if ("visibility" in data || "shares" in data) writeLinks(id, { visibility: data.visibility ?? current.visibility, shares: data.shares ?? [] })
  run("INSERT INTO content_versions (content_id, version, changed_by, changed_at, summary, snapshot_json) VALUES (?, ?, ?, ?, ?, ?)",
    [id, version, user.name, nowIso(), q.get("summary") || `Updated ${Object.keys(data).sort().join(", ")}`, JSON.stringify(current)])
  indexContent(get("SELECT * FROM content_items WHERE id = ?", [id])!)
  audit(user, "update", "content", id, { fields: Object.keys(data).sort() })
  return { id, version }
}

function approveContent(user: User, id: string, data: Record<string, any>) {
  const item = getVisible(user, id)
  if (!canApprove(user, item.sector)) throw new ApiError(403, "Only the sector administrator can approve content")
  const decision = data.decision ?? "approve"
  const status = ({ approve: "approved", reject: "rejected" } as Record<string, string>)[decision]
  if (!status) throw new ApiError(400, "decision must be approve or reject")
  run("UPDATE content_items SET approval_status = ?, updated_at = ? WHERE id = ?", [status, nowIso(), id])
  indexContent(get("SELECT * FROM content_items WHERE id = ?", [id])!)
  audit(user, decision, "content", id, { note: data.note ?? null })
  return { id, approval_status: status, notification: `Teams notification sent to ${item.owner} (simulated)` }
}

function markReviewed(user: User, id: string) {
  const item = getVisible(user, id)
  if (!canApprove(user, item.sector) && item.owner !== user.name) {
    throw new ApiError(403, "Only the content owner or sector administrator can complete a review")
  }
  const months = boot.constants.review_months[item.type] ?? 12
  const t = new Date()
  const total = t.getMonth() + months
  const pad = (n: number) => String(n).padStart(2, "0")
  const next = `${t.getFullYear() + Math.floor(total / 12)}-${pad((total % 12) + 1)}-${pad(Math.min(t.getDate(), 28))}`
  run("UPDATE content_items SET review_date = ?, updated_at = ? WHERE id = ?", [next, nowIso(), id])
  run("INSERT INTO content_versions (content_id, version, changed_by, changed_at, summary) VALUES (?, ?, ?, ?, ?)",
    [id, item.version, user.name, nowIso(), `Reviewed - next review ${next}`])
  audit(user, "review", "content", id, { next_review: next })
  return { id, review_date: next }
}

// ---------------------------------------------------------------- opportunities (routes/opportunities.py)
const FROM = 'FROM opportunities o JOIN opportunity_facets f ON f.opportunity_id = o."ItemInternalId"'
const LIST_SELECT =
  'o."ItemInternalId" AS id, o."Name" AS name, o."StageName" AS stage, o."Opportunity_Status__c" AS opp_status, ' +
  'o."Business_Unit__c" AS business_unit, o."Probability" AS probability, o."CloseDate" AS close_date, ' +
  'o."Proposal_Manager__c" AS proposal_manager, o."New_or_Renewal_Work__c" AS work_type, ' +
  'o."Visibility_Classification__c" AS classification, o."BRS_Opportunity_Number__c" AS brs_number, ' +
  "f.sector, f.client, f.region, f.service_line, f.status, f.tcv, f.source"
const SORTS: Record<string, string> = {
  name: 'o."Name"', client: "f.client", sector: "f.sector", stage: 'o."StageName"', tcv: "f.tcv",
  probability: 'o."Probability"', close: 'o."CloseDate"', manager: 'o."Proposal_Manager__c"',
}

function oppWhere(user: User, q: URLSearchParams): [string, unknown[]] {
  const [sql, p] = opportunityClause(user)
  const clauses = [sql]
  const params = [...p]
  for (const [key, col] of [["sector", "f.sector"], ["status", "f.status"], ["region", "f.region"], ["stage", 'o."StageName"'],
    ["client", "f.client"], ["source", "f.source"]]) {
    const vals = q.getAll(key)
    if (vals.length) {
      clauses.push(`${col} IN (${placeholders(vals.length)})`)
      params.push(...vals)
    }
  }
  if (q.get("q")) {
    clauses.push('(o."Name" LIKE ? OR f.client LIKE ? OR o."Scope_of_Works__c" LIKE ? OR o."Proposal_Manager__c" LIKE ?)')
    params.push(...Array(4).fill(`%${q.get("q")}%`))
  }
  return [clauses.join(" AND "), params]
}

function listOpportunities(user: User, q: URLSearchParams) {
  const [where, params] = oppWhere(user, q)
  const sort = SORTS[q.get("sort") ?? ""] ?? 'o."CloseDate"'
  const dir = q.get("dir") === "asc" ? "ASC" : "DESC"
  const pageSize = Math.min(parseInt(q.get("page_size") ?? "25", 10), 200)
  const page = Math.max(parseInt(q.get("page") ?? "1", 10), 1)
  const total = value<number>(`SELECT COUNT(*) ${FROM} WHERE ${where}`, params)
  const items = rows(`SELECT ${LIST_SELECT} ${FROM} WHERE ${where} ORDER BY ${sort} ${dir} NULLS LAST LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize])
  return { total, page, page_size: pageSize, items }
}

function opportunityStats(user: User, q: URLSearchParams) {
  const [where, params] = oppWhere(user, q)
  const byStage = new Map(all<{ stage: string; count: number; tcv: number | null }>(
    `SELECT o."StageName" AS stage, COUNT(*) AS count, SUM(f.tcv) AS tcv ${FROM} WHERE ${where} GROUP BY 1`, params)
    .map((r) => [r.stage, { stage: r.stage, count: r.count, tcv: r.tcv ?? 0 }]))
  const bySector = all(
    `SELECT f.sector, SUM(CASE WHEN f.status = 'won' THEN f.tcv ELSE 0 END) AS won, ` +
    `SUM(CASE WHEN f.status = 'open' THEN f.tcv ELSE 0 END) AS open, SUM(CASE WHEN f.status = 'lost' THEN f.tcv ELSE 0 END) AS lost, ` +
    `SUM(f.status = 'won') AS won_count, SUM(f.status = 'lost') AS lost_count, COUNT(*) AS count ` +
    `${FROM} WHERE ${where} GROUP BY f.sector ORDER BY f.sector`, params)
  const reasons = all(
    `SELECT j.value AS reason, SUM(f.status = 'won') AS won, SUM(f.status = 'lost') AS lost ` +
    `${FROM}, json_each(o."Won_Lost_Reason__c") j WHERE ${where} AND json_valid(o."Won_Lost_Reason__c") GROUP BY j.value ORDER BY COUNT(*) DESC`, params)
  const t = get<Record<string, number | null>>(
    `SELECT COUNT(*) AS count, SUM(CASE WHEN f.status = 'open' THEN f.tcv END) AS pipeline, SUM(CASE WHEN f.status = 'won' THEN f.tcv END) AS won_tcv, ` +
    `SUM(f.status = 'won') AS won, SUM(f.status = 'lost') AS lost, SUM(CASE WHEN f.status = 'open' THEN o."Total_Weighted_Contract_Value__c" END) AS weighted ` +
    `${FROM} WHERE ${where}`, params)!
  const closed = (t.won ?? 0) + (t.lost ?? 0)
  const order = boot.constants.stage_order
  return {
    by_stage: [...order.filter((s) => byStage.has(s)).map((s) => byStage.get(s)!), ...[...byStage].filter(([k]) => !order.includes(k)).map(([, v]) => v)],
    by_sector: bySector, reasons,
    totals: { count: t.count, pipeline_tcv: t.pipeline ?? 0, won_tcv: t.won_tcv ?? 0, weighted_pipeline: t.weighted ?? 0,
      win_rate: closed ? round(((t.won ?? 0) / closed) * 100, 1) : null },
  }
}

function populated(v: unknown, type: string) {
  if (v == null || v === "" || v === "[]" || v === "#Collection(String)") return false
  if (v === 0 && type !== "boolean") return false
  return true
}

const TIMELINE: [string, string][] = [
  ["CreatedDate", "Opportunity created"], ["Proposal_Start_Date__c", "Proposal start"], ["Tender_Start_Date__c", "Tender start"],
  ["Initial_Tender_Close_Date__c", "Initial tender close"], ["Submitted_to_Sector_Date__c", "Submitted to sector"],
  ["Proposal_Closing_Date__c", "Proposal closing"], ["Tender_Closing_Date__c", "Tender closing"], ["CloseDate", "Close / award date"],
  ["Contract_Start_Date__c", "Contract start"], ["Contract_End_Date_formula__c", "Contract end"],
]

function getOpportunity(user: User, id: string) {
  const [oSql, oParams] = opportunityClause(user)
  const opp = get<Record<string, any>>(
    `SELECT o.*, f.sector AS _sector, f.client AS _client, f.region AS _region, f.regions AS _regions, ` +
    `f.service_line AS _service_line, f.status AS _status, f.tcv AS _tcv, f.is_restricted AS _restricted, f.source AS _source ` +
    `${FROM} WHERE o."ItemInternalId" = ? AND ${oSql}`, [id, ...oParams])
  if (!opp) throw notFound()
  const facets: Record<string, unknown> = {}
  for (const k of Object.keys(opp)) {
    if (k.startsWith("_")) {
      facets[k.slice(1)] = opp[k]
      delete opp[k]
    }
  }
  const meta = rows<Record<string, any>>("SELECT * FROM sf_field_meta ORDER BY sort_order")
  const groups = new Map(boot.constants.groups.map((g) => [g, [] as unknown[]]))
  for (const m of meta) {
    let v = opp[m.column_name]
    if (m.field_type === "multiselect" && typeof v === "string") {
      try {
        v = JSON.parse(v)
      } catch {
        /* keep raw */
      }
    }
    groups.get(m.field_group)!.push({
      column: m.column_name, label: m.label, type: m.field_type, value: v ?? null,
      populated: populated(opp[m.column_name], m.field_type) && Boolean(m.display), is_key: Boolean(m.is_key),
    })
  }

  const split = Object.entries(boot.constants.region_prefix).flatMap(([region, prefix]) => {
    const pct = opp[`${prefix}__c`] || 0
    const rev = opp[`${prefix}_Revenue__c`] || 0
    return pct || rev ? [{ region, percent: pct, revenue: rev, weighted: opp[`${prefix}_Weighted_Revenue__c`] || 0 }] : []
  })
  const timeline = TIMELINE.filter(([col]) => opp[col]).map(([column, label]) => ({ column, label, date: String(opp[column]).slice(0, 10) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const contactIds: Record<string, string> = {}
  for (const c of all<{ source_name: string; name: string; id: string }>("SELECT source_name, name, id FROM contacts")) {
    contactIds[c.source_name] = c.id
    contactIds[c.name] = c.id
  }
  const people: Record<string, unknown>[] = Object.entries(boot.constants.people_fields)
    .filter(([col]) => opp[col])
    .map(([column, role]) => ({ column, role, name: opp[column], contact_id: contactIds[opp[column]] ?? null }))
  people.push(...rows('SELECT ct.name, ct.id AS contact_id, co.role, NULL AS "column" FROM contact_opportunities co JOIN contacts ct ON ct.id = co.contact_id ' +
    "WHERE co.opportunity_id = ? AND co.role IN ('Delivery Lead', 'Technical Lead')", [id]))

  const fy = []
  for (let n = 25; n < 32; n++) {
    const rev = opp[`Estimated_FY${n}_Revenue__c`] || 0
    if (rev) fy.push({ fy: `FY${n}`, revenue: rev, margin: opp[`Estimated_FY${n}_Margin__c`] || 0, weighted_revenue: opp[`Estimated_FY${n}_Weighted_Revenue__c`] || 0 })
  }
  const [cSql, cParams] = contentClause(user)
  const content = rows(`SELECT id, type, title, visibility, approval_status FROM content_items c WHERE ${cSql} AND c.source_opportunity_id = ?`, [...cParams, id])
  audit(user, "view", "opportunity", id)
  const groupList = [...groups].map(([name, fields]) => ({ name, fields }))
  return {
    id, name: opp.Name ?? null, facets, groups: groupList,
    populated_count: groupList.reduce((a, g) => a + g.fields.filter((f: any) => f.populated).length, 0), total_fields: meta.length,
    revenue_split: split, timeline, people, fy_forecast: fy, content,
  }
}

// ---------------------------------------------------------------- contacts (routes/contacts.py)
function listContacts(q: URLSearchParams) {
  const clauses = ["1 = 1"]
  const params: unknown[] = []
  if (q.get("q")) {
    clauses.push("(name LIKE ? OR title LIKE ? OR clients LIKE ? OR service_lines LIKE ? OR expertise LIKE ?)")
    params.push(...Array(5).fill(`%${q.get("q")}%`))
  }
  if (q.get("sector")) {
    clauses.push("(primary_sector = ? OR sectors LIKE ?)")
    params.push(q.get("sector"), `%"${q.get("sector")}"%`)
  }
  if (q.get("source")) {
    clauses.push("data_source = ?")
    params.push(q.get("source"))
  }
  for (const e of q.getAll("expertise")) {
    clauses.push("expertise LIKE ?")
    params.push(`%"${e}"%`)
  }
  const sort = ({ name: "name", wins: "win_count DESC", tcv: "total_tcv DESC" } as Record<string, string>)[q.get("sort") ?? ""] ?? "opp_count DESC"
  return rows(`SELECT * FROM contacts WHERE ${clauses.join(" AND ")} ORDER BY is_team, ${sort}`, params)
}

function getContact(user: User, id: string) {
  const row = get("SELECT * FROM contacts WHERE id = ?", [id])
  if (!row) throw notFound()
  const contact = rowToDict<Record<string, any>>(row)
  const [oSql, oParams] = opportunityClause(user)
  contact.opportunities = rows(
    `SELECT o."ItemInternalId" AS id, o."Name" AS name, o."StageName" AS stage, o."CloseDate" AS close_date, ` +
    `group_concat(co.role, ', ') AS roles, f.client, f.sector, f.status, f.tcv, f.source ` +
    `FROM contact_opportunities co JOIN opportunities o ON o."ItemInternalId" = co.opportunity_id ` +
    `JOIN opportunity_facets f ON f.opportunity_id = o."ItemInternalId" ` +
    `WHERE co.contact_id = ? AND ${oSql} GROUP BY o."ItemInternalId" ORDER BY o."CloseDate" DESC`, [id, ...oParams])
  const [cSql, cParams] = contentClause(user)
  contact.content = rows(
    `SELECT DISTINCT c.id, c.type, c.title, c.sector, c.updated_at, CASE WHEN c.owner = ? THEN 1 ELSE 0 END AS is_owner ` +
    `FROM content_items c LEFT JOIN content_contacts cc ON cc.content_id = c.id ` +
    `WHERE (cc.contact_id = ? OR c.owner = ?) AND c.approval_status = 'approved' AND ${cSql} ` +
    `ORDER BY is_owner DESC, c.updated_at DESC LIMIT 30`, [contact.name, id, contact.name, ...cParams])
  contact.hidden_opportunities = contact.opp_count - contact.opportunities.length
  audit(user, "view", "contact", id)
  return contact
}

// ---------------------------------------------------------------- governance (routes/governance.py)
const MANDATORY_SQL = ["sector", "business_unit", "service_line", "contract_value_range", "client", "geography", "confidentiality", "owner", "review_date"]
  .map((c) => `COALESCE(${c}, '') != ''`).join(" AND ")
const QUEUE_COLS = "id, type, title, sector, owner, review_date, expiry_date, approval_status, visibility, updated_at, created_by"

function governance(user: User, q: URLSearchParams) {
  const today = todayIso()
  // Governance queues are scoped to the viewer's sector; Enterprise Admins see every sector.
  const scope = isEnterpriseAdmin(user) ? q.get("sector") : user.sector
  const [where, params]: [string, unknown[]] = scope ? ["sector = ?", [scope]] : ["1 = 1", []]
  const queue = (extra: string, extraParams: unknown[] = [], order = "review_date") =>
    rows(`SELECT ${QUEUE_COLS} FROM content_items WHERE ${where} AND ${extra} ORDER BY ${order} LIMIT 100`, [...params, ...extraParams])

  const roster = rows<Record<string, any>>("SELECT * FROM sectors ORDER BY name").map((s) => {
    const st = get<Record<string, number | null>>(
      `SELECT COUNT(*) AS n, SUM(${MANDATORY_SQL}) AS complete, SUM(review_date < ?) AS overdue, SUM(approval_status = 'pending') AS pending, ` +
      `SUM(visibility = 'sector_only') AS so, SUM(visibility = 'shared') AS sh, SUM(visibility = 'enterprise') AS en, SUM(is_restricted) AS restricted, ` +
      `SUM(COALESCE(owner, '') = '') AS no_owner FROM content_items WHERE sector = ?`, [today, s.name])!
    const n = st.n ?? 0
    return {
      ...s, content_count: n, completeness: n ? round(((st.complete ?? 0) / n) * 100, 1) : 100,
      overdue: st.overdue ?? 0, pending: st.pending ?? 0,
      visibility: { sector_only: st.so ?? 0, shared: st.sh ?? 0, enterprise: st.en ?? 0 },
      restricted: st.restricted ?? 0, no_owner: st.no_owner ?? 0,
    }
  })
  const incomplete = rows(`SELECT ${QUEUE_COLS}, business_unit, geography, service_line, client FROM content_items ` +
    `WHERE ${where} AND NOT (${MANDATORY_SQL}) LIMIT 50`, params)
  return {
    scope: scope || "All sectors", can_approve: scope ? canApprove(user, scope) : isEnterpriseAdmin(user),
    overdue: queue("review_date < ?", [today]),
    due_soon: queue("review_date >= ? AND review_date <= date(?, '+30 days')", [today, today]),
    expired: queue("expiry_date < ?", [today], "expiry_date"),
    pending: queue("approval_status = 'pending'", [], "updated_at DESC"),
    rejected: queue("approval_status = 'rejected'", [], "updated_at DESC"),
    incomplete, roster,
  }
}

function auditLog(user: User, q: URLSearchParams) {
  if (user.role !== "enterprise_admin" && user.role !== "sector_admin") throw new ApiError(403, "Audit log is available to administrators")
  const clauses = ["1 = 1"]
  const params: unknown[] = []
  if (user.role === "sector_admin") {
    clauses.push("u.sector = ?")
    params.push(user.sector)
  }
  if (q.get("action")) {
    clauses.push("a.action = ?")
    params.push(q.get("action"))
  }
  return rows("SELECT a.*, u.name AS user_name, u.sector AS user_sector FROM audit_log a LEFT JOIN users u ON u.id = a.user_id " +
    `WHERE ${clauses.join(" AND ")} ORDER BY a.id DESC LIMIT 200`, params)
}

// ---------------------------------------------------------------- router
type Handler = (user: User, m: RegExpMatchArray, q: URLSearchParams, body: Record<string, any>) => unknown

const ROUTES: [string, RegExp, Handler][] = [
  ["GET", /^\/me$/, (u) => u],
  ["GET", /^\/meta$/, () => boot.meta],
  ["GET", /^\/stats$/, (u) => stats(u)],
  ["GET", /^\/search$/, (u, _m, q) => search(u, q)],
  ["GET", /^\/content$/, (u, _m, q) => listContent(u, q)],
  ["POST", /^\/content$/, (u, _m, _q, b) => createContent(u, b)],
  ["GET", /^\/content\/similar$/, (u, _m, q) => similarContent(u, q.get("title") ?? "")],
  ["GET", /^\/content\/([^/]+)$/, (u, m) => getContent(u, m[1])],
  ["PATCH", /^\/content\/([^/]+)$/, (u, m, q, b) => updateContent(u, m[1], b, q)],
  ["POST", /^\/content\/([^/]+)\/approve$/, (u, m, _q, b) => approveContent(u, m[1], b)],
  ["POST", /^\/content\/([^/]+)\/review$/, (u, m) => markReviewed(u, m[1])],
  ["GET", /^\/opportunities$/, (u, _m, q) => listOpportunities(u, q)],
  ["GET", /^\/opportunities\/stats$/, (u, _m, q) => opportunityStats(u, q)],
  ["GET", /^\/opportunities\/([^/]+)$/, (u, m) => getOpportunity(u, m[1])],
  ["GET", /^\/contacts$/, (_u, _m, q) => listContacts(q)],
  ["GET", /^\/contacts\/([^/]+)$/, (u, m) => getContact(u, m[1])],
  ["GET", /^\/governance$/, (u, _m, q) => governance(u, q)],
  ["GET", /^\/audit$/, (u, _m, q) => auditLog(u, q)],
]

/** Handle an API call (path without the /api prefix, e.g. "/search?q=nbn") as the given persona. */
export function handle(method: string, pathWithQuery: string, body: unknown, userId: string): unknown {
  const [path, query = ""] = pathWithQuery.split("?")
  const q = new URLSearchParams(query)
  for (const [m, re, handler] of ROUTES) {
    const match = m === method ? path.match(re) : null
    if (match) return handler(currentUser(userId), match.map(decodeURIComponent) as RegExpMatchArray, q, (body ?? {}) as Record<string, any>)
  }
  throw notFound()
}
