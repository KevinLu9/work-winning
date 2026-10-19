/**
 * In-browser port of server/app/search.py: rule-based query parsing, FTS5 search and facets.
 * Keep in step with the Python version; `npm run test:parity` compares the two.
 */
import { all, value } from "./sql"
import { contentClause, type User } from "./permissions"

const REGION_WORDS: [string, string[]][] = [
  ["new south wales", ["NSW"]], ["western australia", ["WA"]], ["south australia", ["SA"]],
  ["northern territory", ["NT"]], ["australian capital territory", ["ACT"]], ["new zealand", ["NZ North", "NZ South"]],
  ["north island", ["NZ North"]], ["south island", ["NZ South"]],
  ["queensland", ["QLD"]], ["victoria", ["VIC"]], ["tasmania", ["TAS"]],
  ["nation(?:al|wide)", ["National"]],
]
const REGION_CODES: [string, string[]][] = [
  ["QLD", ["QLD"]], ["NSW", ["NSW"]], ["VIC", ["VIC"]], ["WA", ["WA"]], ["SA", ["SA"]], ["TAS", ["TAS"]],
  ["NT", ["NT"]], ["ACT", ["ACT"]], ["NZ", ["NZ North", "NZ South"]],
]
const SECTOR_WORDS: [string, string][] = [
  ["defence (?:&|and) social infrastructure|d&si|dsi|social infrastructure|defence sector", "Defence & Social Infrastructure"],
  ["telecommunications|telco|telecoms?", "Telecommunications"],
  ["infrastructure services", "Infrastructure Services"],
  ["corporate services", "Corporate Services"],
  ["transport(?! for)", "Transport"],
]
const TYPE_WORDS: [string, string][] = [
  ["case stud(?:y|ies)", "case_study"],
  ["project profiles?", "project_profile"],
  ["bid submissions?|tender responses?|submissions?|bids?", "bid_submission"],
  ["templates?", "template"],
  ["good[- ]news(?: stor(?:y|ies))?", "good_news_story"],
  ["capability statements?", "capability_statement"],
  ["photos?|images?|pictures?|graphics?", "image"],
  ["contacts?|experts?|people|specialists?|who (?:knows|has worked|can help)", "contact"],
  ["opportunit(?:y|ies)", "opportunity"],
]
const STATUS_WORDS: [string, string][] = [
  ["completed|won|delivered|successful|winning", "won"],
  ["lost|unsuccessful", "lost"],
  ["open|active|current|live|in progress|pipeline", "open"],
]
const CLIENT_ALIASES: Record<string, string> = {
  nbn: "nbn co", optus: "optus", telstra: "telstra", tpg: "tpg", chorus: "chorus", spark: "spark nz",
  "rio tinto": "rio tinto", bhp: "bhp", fortescue: "fortescue", south32: "south32",
  "seq water": "seq water", "sydney water": "sydney water", "melbourne water": "melbourne water",
  "yarra valley water": "yarra valley water", watercare: "watercare", tmr: "transport and main roads",
  "main roads": "transport and main roads", tfnsw: "transport for nsw", "transport for nsw": "transport for nsw",
  "waka kotahi": "waka kotahi", nzta: "waka kotahi", kiwirail: "kiwirail", transurban: "transurban",
  "sydney trains": "sydney trains", "queensland rail": "queensland rail", "metro trains": "metro trains",
  "department of defence": "department of defence", "queensland health": "queensland health",
  "te whatu ora": "te whatu ora", "service nsw": "service nsw",
}
const SYNONYMS: Record<string, string> = { "local government": "council", councils: "council", "water-treatment": "water treatment" }
const STOPWORDS = new Set(`
a an the and or of in on for to at by with from that which what where who whose me show find search list give get
i we our us need want looking look examples example similar relevant all any some project projects work works
done recent past have has been were was is are be about across within around near than more over under above below
between less greater min max minimum maximum least most please can you do did
`.split(/\s+/).filter(Boolean))

const UNITS: Record<string, number> = { k: 1e3, m: 1e6, mil: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 }
const NUM = String.raw`\$?\s*(\d+(?:\.\d+)?)\s*(k|m|mil|million|bn|b|billion)?\b`

export const VALUE_RANGES: [string, number, number | null][] = [
  ["<$1m", 0, 1e6], ["$1–10m", 1e6, 1e7], ["$10–50m", 1e7, 5e7], ["$50–100m", 5e7, 1e8], [">$100m", 1e8, null],
]
export const FACETS = ["doc_type", "sector", "region", "client", "service_line", "status", "source"] as const

export type Filters = Record<string, string[] | number | undefined>
export interface Chip { key: string; value: string | number; label: string }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const num = (v: string, unit?: string) => parseFloat(v) * (UNITS[(unit || "").toLowerCase()] ?? 1)
const g = (v: number) => String(parseFloat(v.toPrecision(6))) // Python's :g format

function fmtMoney(v: number) {
  if (v >= 1e9) return `$${g(v / 1e9)}b`
  if (v >= 1e6) return `$${g(v / 1e6)}m`
  if (v >= 1e3) return `$${g(v / 1e3)}k`
  return `$${g(v)}`
}

export function parseQuery(q: string, clients: string[]) {
  let text = ` ${q.trim()} `
  const filters: Record<string, any> = {}
  const chips: Chip[] = []

  const take = (pattern: string, flags = "i") => {
    const m = new RegExp(pattern, flags).exec(text)
    if (m) text = text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)
    return m
  }
  const addList = (key: string, v: string) => {
    filters[key] ??= []
    filters[key].push(v)
  }

  for (const [phrase, repl] of Object.entries(SYNONYMS)) {
    text = text.replace(new RegExp(`\\b${escapeRe(phrase)}\\b`, "gi"), repl)
  }

  // Contract value
  let m = take(String.raw`\bbetween\s+${NUM}\s+(?:and|-|to)\s+${NUM}`)
  if (m) {
    filters.value_min = num(m[1], m[2] || m[4])
    filters.value_max = num(m[3], m[4])
  } else {
    m = take(String.raw`(?:\bover|\babove|\bmore than|\bgreater than|>|\bat least|\bminimum)\s*${NUM}`)
    if (m) filters.value_min = num(m[1], m[2])
    m = take(String.raw`(?:\bunder|\bbelow|\bless than|<|\bup to|\bmaximum)\s*${NUM}`)
    if (m) filters.value_max = num(m[1], m[2])
  }
  if ("value_min" in filters) chips.push({ key: "value_min", value: filters.value_min, label: `Value ≥ ${fmtMoney(filters.value_min)}` })
  if ("value_max" in filters) chips.push({ key: "value_max", value: filters.value_max, label: `Value ≤ ${fmtMoney(filters.value_max)}` })

  // Clients (before regions/sectors so "Transport for NSW" / "Queensland Health" stay intact)
  const lowered = clients.filter(Boolean).map((c) => [c, c.toLowerCase()] as const)
  const addClient = (c: string) => {
    filters.client ??= []
    if (!filters.client.includes(c)) {
      filters.client.push(c)
      chips.push({ key: "client", value: c, label: `Client: ${c}` })
    }
  }
  for (const alias of Object.keys(CLIENT_ALIASES).sort((a, b) => b.length - a.length)) {
    if (take(`\\b${escapeRe(alias)}\\b`)) {
      for (const [c, lc] of lowered) if (lc.includes(CLIENT_ALIASES[alias])) addClient(c)
    }
  }
  for (const [c, lc] of [...lowered].sort((a, b) => b[1].length - a[1].length)) {
    if (lc.length > 6 && take(`\\b${escapeRe(lc)}\\b`)) addClient(c)
  }

  // Regions
  const regions: string[] = []
  for (const [pattern, codes] of REGION_WORDS) if (take(`\\b${pattern}\\b`)) regions.push(...codes)
  for (const [code, codes] of REGION_CODES) {
    // Upper-case codes anywhere, or lower-case after a preposition ("in vic")
    if (take(`\\b${code}\\b`, "") || take(`\\b(?:in|across|within|around)\\s+${code.toLowerCase()}\\b`, "")) regions.push(...codes)
  }
  for (const r of new Set(regions)) {
    addList("region", r)
    chips.push({ key: "region", value: r, label: `Region: ${r}` })
  }

  for (const [pattern, sector] of SECTOR_WORDS) {
    if (take(`\\b(?:${pattern})\\b(?: sector)?`)) {
      addList("sector", sector)
      chips.push({ key: "sector", value: sector, label: `Sector: ${sector}` })
    }
  }
  for (const [pattern, t] of TYPE_WORDS) {
    if (take(`\\b(?:${pattern})\\b`) && !(filters.doc_type ?? []).includes(t)) {
      addList("doc_type", t)
      chips.push({ key: "doc_type", value: t, label: `Type: ${t.replace(/_/g, " ")}` })
    }
  }
  for (const [pattern, status] of STATUS_WORDS) {
    if (take(`\\b(?:${pattern})\\b`)) {
      addList("status", status)
      chips.push({ key: "status", value: status, label: `Status: ${status}` })
    }
  }

  const words = (text.match(/[A-Za-z0-9&']+/g) ?? []).filter((w) => !STOPWORDS.has(w.toLowerCase()) && w.length > 1)
  return { keywords: words.join(" "), filters: filters as Filters, chips }
}

export function ftsExpression(keywords: string, mode = "AND"): string | null {
  const tokens = (keywords.match(/[A-Za-z0-9]+/g) ?? []).filter((t) => t.length > 1)
  return tokens.length ? tokens.map((t) => `"${t}"*`).join(` ${mode} `) : null
}

function filterSql(filters: Filters, exclude?: string): [string[], unknown[]] {
  const clauses: string[] = []
  const params: unknown[] = []
  for (const key of FACETS) {
    if (key === exclude) continue
    const vals = filters[key] as string[] | undefined
    if (!vals?.length) continue
    let clause = `d.${key} IN (${vals.map(() => "?").join(", ")})`
    params.push(...vals)
    if (key === "client") {
      // Contacts match a client filter when they have worked with that client.
      const likes = vals.map(() => "ct.clients LIKE ?").join(" OR ")
      clause = `(${clause} OR (d.entity_type = 'contact' AND EXISTS (SELECT 1 FROM contacts ct WHERE ct.id = d.entity_id AND (${likes}))))`
      params.push(...vals.map((v) => `%"${v}"%`))
    }
    clauses.push(clause)
  }
  const ranges = filters.value_range as string[] | undefined
  if (exclude !== "value_range" && ranges?.length) {
    const ors: string[] = []
    for (const [label, lo, hi] of VALUE_RANGES) {
      if (ranges.includes(label)) {
        ors.push("(d.value >= ?" + (hi ? " AND d.value < ?)" : ")"))
        params.push(lo, ...(hi ? [hi] : []))
      }
    }
    if (ors.length) clauses.push(`(${ors.join(" OR ")})`)
  }
  if (filters.value_min != null) {
    clauses.push("d.value >= ?")
    params.push(filters.value_min)
  }
  if (filters.value_max != null) {
    clauses.push("d.value <= ?")
    params.push(filters.value_max)
  }
  return [clauses, params]
}

function base(user: User, fts: string | null, filters: Filters, exclude?: string): [string, unknown[]] {
  const [permSql, permParams] = contentClause(user, "d", "d.entity_id")
  const [clauses, params] = filterSql(filters, exclude)
  const where = [permSql, ...clauses].join(" AND ")
  if (fts) {
    return [`FROM search_index JOIN search_docs d ON d.rowid = search_index.rowid WHERE search_index MATCH ? AND ${where}`,
      [fts, ...permParams, ...params]]
  }
  return [`FROM search_docs d WHERE ${where}`, [...permParams, ...params]]
}

export function runSearch(user: User, keywords: string, filters: Filters, limit = 60, offset = 0) {
  let relaxed = false
  let fts = ftsExpression(keywords)
  let [fromSql, params] = base(user, fts, filters)
  let total = value<number>(`SELECT COUNT(*) ${fromSql}`, params)
  if (fts && total === 0 && keywords.split(/\s+/).filter(Boolean).length > 1) {
    fts = ftsExpression(keywords, "OR")
    relaxed = true;
    [fromSql, params] = base(user, fts, filters)
    total = value<number>(`SELECT COUNT(*) ${fromSql}`, params)
  }

  const select = fts
    ? "SELECT d.*, bm25(search_index, 10.0, 3.0, 4.0) AS score, snippet(search_index, 1, '[[', ']]', ' … ', 24) AS snippet "
    : "SELECT d.*, 0 AS score, NULL AS snippet "
  const order = fts
    ? " ORDER BY score"
    : " ORDER BY CASE d.entity_type WHEN 'content' THEN 0 WHEN 'opportunity' THEN 1 ELSE 2 END, d.updated_at DESC"
  const results = all(`${select}${fromSql}${order} LIMIT ? OFFSET ?`, [...params, limit, offset])

  const facets: Record<string, { value: string; count: number }[]> = {}
  for (const key of FACETS) {
    const [fSql, fParams] = base(user, fts, filters, key)
    facets[key] = all<{ value: string; count: number }>(
      `SELECT d.${key} AS value, COUNT(*) AS count ${fSql} AND d.${key} IS NOT NULL GROUP BY d.${key} ORDER BY COUNT(*) DESC LIMIT 25`, fParams)
  }
  const [fSql, fParams] = base(user, fts, filters, "value_range")
  const cases = VALUE_RANGES.map(([label, lo, hi]) => `WHEN d.value >= ${lo}` + (hi ? ` AND d.value < ${hi}` : "") + ` THEN '${label}'`).join(" ")
  const counts = Object.fromEntries(
    all<{ b: string; n: number }>(`SELECT CASE ${cases} END AS b, COUNT(*) AS n ${fSql} AND d.value IS NOT NULL GROUP BY b`, fParams).map((r) => [r.b, r.n]),
  )
  facets.value_range = VALUE_RANGES.map(([label]) => ({ value: label, count: counts[label] ?? 0 }))

  const terms = (keywords.match(/[A-Za-z0-9]+/g) ?? []).filter((t) => t.length > 1)
  return { total, results, facets, terms, relaxed }
}

export function similarContent(user: User, title: string, limit = 3) {
  const words = (title.match(/[A-Za-z0-9]+/g) ?? []).filter((w) => !STOPWORDS.has(w.toLowerCase()) && w.length > 2)
  const fts = ftsExpression(words.join(" "), "OR")
  if (!fts) return []
  const [fromSql, params] = base(user, fts, {})
  return all(
    `SELECT d.entity_id, d.doc_type, d.title, d.sector, d.client, bm25(search_index, 10.0, 3.0, 4.0) AS score ${fromSql} AND d.entity_type = 'content' ORDER BY score LIMIT ?`,
    [...params, limit],
  )
}
