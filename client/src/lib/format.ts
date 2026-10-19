export function money(v: number | null | undefined, opts: { compact?: boolean } = { compact: true }): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—"
  if (!opts.compact) return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(v)
  const abs = Math.abs(v)
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}b`
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}m`
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}k`
  return `$${v.toFixed(0)}`
}

export function date(v: string | null | undefined): string {
  if (!v) return "—"
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
}

export function daysFromToday(v: string | null | undefined): number | null {
  if (!v) return null
  const d = new Date(`${v.slice(0, 10)}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

export function relativeDays(v: string | null | undefined): string {
  const n = daysFromToday(v)
  if (n === null) return "—"
  if (n === 0) return "today"
  if (n < 0) return `${-n} day${n === -1 ? "" : "s"} overdue`
  return `in ${n} day${n === 1 ? "" : "s"}`
}

export const TYPE_LABELS: Record<string, string> = {
  case_study: "Case study",
  project_profile: "Project profile",
  bid_submission: "Bid submission",
  template: "Template",
  good_news_story: "Good-news story",
  capability_statement: "Capability statement",
  image: "Image",
  opportunity: "Opportunity",
  contact: "Contact",
}

export const VISIBILITY_LABELS: Record<string, string> = {
  sector_only: "Sector only",
  shared: "Shared",
  enterprise: "Enterprise",
}

export const FLAG_LABELS: Record<string, string> = {
  pricing: "Pricing",
  current_tender: "Current tender",
  government: "Government",
  nda: "NDA",
  client_sensitive: "Client-sensitive",
  referee: "Referee info",
  cv: "Employee CV",
}

export const ROLE_LABELS: Record<string, string> = {
  bid_manager: "Bid Manager",
  proposal_writer: "Proposal Writer",
  sector_admin: "Sector Admin",
  enterprise_admin: "Enterprise Admin",
}

export const SECTOR_SHORT: Record<string, string> = {
  "Defence & Social Infrastructure": "D&SI",
  Transport: "Transport",
  Telecommunications: "Telco",
  "Infrastructure Services": "IS",
  "Corporate Services": "Corporate",
}

export function formatField(value: any, type: string): string {
  if (value === null || value === undefined || value === "") return "—"
  switch (type) {
    case "currency":
      return money(Number(value), { compact: false })
    case "percent":
      return `${Number(value).toLocaleString("en-AU", { maximumFractionDigits: 1 })}%`
    case "date":
    case "datetime":
      return date(String(value))
    case "boolean":
      return value ? "Yes" : "No"
    case "multiselect":
      return Array.isArray(value) ? value.join(", ") || "—" : String(value)
    default:
      return typeof value === "number" ? value.toLocaleString("en-AU") : String(value)
  }
}
