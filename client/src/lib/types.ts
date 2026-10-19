export type Visibility = "sector_only" | "shared" | "enterprise"
export type ApprovalStatus = "approved" | "pending" | "rejected" | "archived"
export type OutcomeStatus = "won" | "lost" | "open"
export type DataSource = "salesforce" | "synthetic" | "user" | "public"

export interface User {
  id: string
  name: string
  title: string
  role: "bid_manager" | "proposal_writer" | "sector_admin" | "enterprise_admin"
  sector: string
}

export interface Sector {
  id: string
  name: string
  short_name: string
  description: string
  content_owner: string | null
  administrator: string
  backup_administrator: string | null
  business_units: string[]
  service_lines: string[]
}

export interface Option {
  value: string
  label: string
  description?: string
  review_months?: number
  use_when?: string
  includes?: string[]
}

export interface Meta {
  sectors: Sector[]
  users: User[]
  regions: Option[]
  content_types: Option[]
  value_ranges: string[]
  confidentiality: string[]
  restricted_flags: Option[]
  visibility: Option[]
  clients: string[]
  stages: string[]
  expertise: string[]
  data_sources: Option[]
}

export interface ContentSummary {
  id: string
  type: string
  title: string
  summary: string | null
  sector: string
  business_unit: string | null
  service_line: string | null
  contract_value: number | null
  contract_value_range: string | null
  client: string | null
  geography: string | null
  confidentiality: string
  visibility: Visibility
  restricted_flags: string[]
  is_restricted: number
  owner: string | null
  review_date: string | null
  expiry_date: string | null
  approval_status: ApprovalStatus
  version: number
  source_opportunity_id: string | null
  data_source: DataSource
  updated_at: string
  body: Record<string, any>
  hero_id: string | null
}

export type AttachmentRole = "hero" | "image" | "document"

export interface Attachment {
  id: string
  role: AttachmentRole
  filename: string
  mime_type: string
  size: number
  uploaded_by: string | null
  uploaded_at: string
}

export interface ContentDetail extends ContentSummary {
  shares: string[]
  tags: string[]
  created_at: string
  created_by: string | null
  contacts: { id: string; name: string; title: string; primary_sector: string; expertise: string[]; role: string }[]
  versions: { version: number; changed_by: string; changed_at: string; summary: string }[]
  attachments: Attachment[]
  opportunity: null | {
    id: string; name: string; stage: string; status: string; tcv: number | null; close_date: string
    teamsite: string | null; brs_number: number | null; reasons: string | null; client: string; region: string; source: DataSource
  }
  related: { id: string; type: string; title: string; sector: string }[]
  permissions: { can_edit: boolean; can_approve: boolean }
}

export interface SearchResult {
  entity_type: "content" | "opportunity" | "contact"
  entity_id: string
  doc_type: string
  title: string
  subtitle: string | null
  sector: string | null
  client: string | null
  region: string | null
  service_line: string | null
  value: number | null
  status: OutcomeStatus | null
  visibility: Visibility
  is_restricted: number
  approval_status: ApprovalStatus
  owner: string | null
  updated_at: string | null
  source: DataSource
  snippet: string | null
  score: number
}

export interface FacetValue { value: string; count: number }

export interface Chip { key: string; value: string | number; label: string }

export interface SearchResponse {
  total: number
  results: SearchResult[]
  facets: Record<string, FacetValue[]>
  terms: string[]
  relaxed: boolean
  query: string
  keywords: string
  chips: Chip[]
  filters: Record<string, string[] | number>
}

export interface OpportunityRow {
  id: string
  name: string
  stage: string
  opp_status: string
  business_unit: string | null
  probability: number | null
  close_date: string | null
  proposal_manager: string | null
  work_type: string | null
  classification: string | null
  brs_number: number | null
  sector: string
  client: string
  region: string | null
  service_line: string | null
  status: OutcomeStatus
  tcv: number | null
  source: DataSource
}

export interface OpportunityField {
  column: string
  label: string
  type: string
  value: any
  populated: boolean
  is_key: boolean
}

export interface OpportunityDetail {
  id: string
  name: string
  facets: { sector: string; client: string; region: string; regions: string; service_line: string; status: OutcomeStatus; tcv: number | null; restricted: number; source: DataSource }
  groups: { name: string; fields: OpportunityField[] }[]
  populated_count: number
  total_fields: number
  revenue_split: { region: string; percent: number; revenue: number; weighted: number }[]
  timeline: { column: string; label: string; date: string }[]
  people: { column: string | null; role: string; name: string; contact_id: string | null }[]
  fy_forecast: { fy: string; revenue: number; margin: number; weighted_revenue: number }[]
  content: { id: string; type: string; title: string; visibility: Visibility; approval_status: ApprovalStatus }[]
}

export interface Contact {
  id: string
  name: string
  source_name: string
  title: string
  location: string
  primary_sector: string | null
  sectors: string[]
  expertise: string[]
  roles: string[]
  clients: string[]
  service_lines: string[]
  bio: string
  opp_count: number
  win_count: number
  closed_count: number
  total_tcv: number
  is_team: number
  data_source: DataSource
}

export interface ContactDetail extends Contact {
  opportunities: { id: string; name: string; stage: string; close_date: string; roles: string; client: string; sector: string; status: OutcomeStatus; tcv: number | null; source: DataSource }[]
  content: { id: string; type: string; title: string; sector: string; updated_at: string; is_owner: number }[]
  hidden_opportunities: number
}

export interface QueueItem {
  id: string
  type: string
  title: string
  sector: string
  owner: string | null
  review_date: string | null
  expiry_date: string | null
  approval_status: ApprovalStatus
  visibility: Visibility
  updated_at: string
  created_by: string | null
  business_unit?: string | null
  geography?: string | null
  service_line?: string | null
  client?: string | null
}

export interface Governance {
  scope: string
  can_approve: boolean
  overdue: QueueItem[]
  due_soon: QueueItem[]
  expired: QueueItem[]
  pending: QueueItem[]
  rejected: QueueItem[]
  archived: QueueItem[]
  incomplete: QueueItem[]
  roster: (Sector & {
    content_count: number; completeness: number; overdue: number; pending: number
    visibility: Record<Visibility, number>; restricted: number; no_owner: number; archived: number
  })[]
}

export interface Stats {
  content_by_type: Record<string, number>
  content_total: number
  won_tcv: number
  pipeline_tcv: number
  won: number
  lost: number
  open: number
  contacts: number
  due_for_review: number
  recent: ContentSummary[]
  sectors: { name: string; short_name: string; description: string; content_count: number; won_count: number; won_tcv: number }[]
}
