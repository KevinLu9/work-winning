import { Link } from "react-router-dom"
import { MapPin, UserRound } from "lucide-react"
import { ApprovalBadge, Highlight, OutcomeBadge, PhotoPlaceholder, SectorBadge, Snippet, SourceBadge, TypeBadge, TypeIcon, VisibilityBadge } from "@/components/common"
import { HeroBanner } from "@/components/media"
import { money } from "@/lib/format"
import type { ContentSummary, SearchResult } from "@/lib/types"

export function resultHref(r: Pick<SearchResult, "entity_type" | "entity_id">) {
  if (r.entity_type === "opportunity") return `/opportunities/${r.entity_id}`
  if (r.entity_type === "contact") return `/contacts/${r.entity_id}`
  return `/content/${r.entity_id}`
}

export function ResultCard({ r, terms }: { r: SearchResult; terms: string[] }) {
  return (
    <Link
      to={resultHref(r)}
      className="group flex gap-4 rounded-xl border bg-card p-4 shadow-xs transition hover:border-brand-mid/50 hover:shadow-md"
    >
      <div className="hidden size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary sm:flex">
        <TypeIcon type={r.doc_type} className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <TypeBadge type={r.doc_type} />
          <SectorBadge sector={r.sector} />
          {r.status && <OutcomeBadge status={r.status} />}
          <ApprovalBadge status={r.approval_status} />
          <SourceBadge source={r.source} />
          {r.entity_type !== "contact" && <VisibilityBadge visibility={r.visibility} restricted={r.is_restricted} />}
        </div>
        <div className="font-semibold text-foreground group-hover:text-primary">
          <Highlight text={r.title} terms={terms} />
        </div>
        {r.snippet ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            <Snippet text={r.snippet} />
          </p>
        ) : r.subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{r.subtitle}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {r.client && r.entity_type !== "contact" && <span>{r.client}</span>}
          {r.region && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {r.region}
            </span>
          )}
          {r.value ? <span className="font-medium text-foreground tabular-nums">{money(r.value)}</span> : null}
          {r.owner && (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3" />
              {r.owner}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export function ContentCard({ c }: { c: ContentSummary }) {
  const seed = c.body?.photo_seed ?? c.title.length
  return (
    <Link to={`/content/${c.id}`} className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition hover:border-brand-mid/50 hover:shadow-md">
      {c.type === "case_study" || c.type === "project_profile" ? (
        <HeroBanner heroId={c.hero_id} seed={seed} type={c.type} className="h-28" />
      ) : (
        c.type === "image" && <PhotoPlaceholder seed={seed} type={c.type} className="h-28" />
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <TypeBadge type={c.type} />
          <SectorBadge sector={c.sector} />
        </div>
        <div className="line-clamp-2 font-semibold group-hover:text-primary">{c.title}</div>
        {c.summary && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{c.summary}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
          <span className="truncate">{c.client}</span>
          {c.contract_value ? <span className="font-medium text-foreground tabular-nums">{money(c.contract_value)}</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <VisibilityBadge visibility={c.visibility} restricted={c.is_restricted} />
          <SourceBadge source={c.data_source} />
        </div>
      </div>
    </Link>
  )
}
