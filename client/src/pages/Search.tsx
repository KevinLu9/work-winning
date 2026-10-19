import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Filter, Info, SearchX, Sparkles, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResultCard } from "@/components/cards"
import { EmptyState } from "@/components/common"
import { api, qs } from "@/lib/api"
import { TYPE_LABELS } from "@/lib/format"
import type { FacetValue, SearchResponse } from "@/lib/types"

const LIST_KEYS = ["source", "doc_type", "sector", "region", "client", "service_line", "status", "value_range"] as const
type ListKey = (typeof LIST_KEYS)[number]

const FACET_TITLES: Record<ListKey, string> = {
  doc_type: "Content type",
  sector: "Sector",
  region: "Region",
  client: "Client",
  service_line: "Service line",
  status: "Outcome",
  value_range: "Contract value",
  source: "Data source",
}
const STATUS_LABELS: Record<string, string> = { won: "Won / completed", lost: "Lost", open: "Open / live" }
const SOURCE_LABELS: Record<string, string> = { salesforce: "Salesforce export", synthetic: "Synthetic", user: "User submitted" }
const CONTENT_TYPES = ["case_study", "project_profile", "bid_submission", "template", "good_news_story", "capability_statement", "image"]
const TABS = [
  { value: "all", label: "All" },
  { value: "content", label: "Content" },
  { value: "opportunity", label: "Opportunities" },
  { value: "contact", label: "People" },
]

function facetLabel(key: ListKey, value: string) {
  if (key === "doc_type") return TYPE_LABELS[value] ?? value
  if (key === "status") return STATUS_LABELS[value] ?? value
  if (key === "source") return SOURCE_LABELS[value] ?? value
  return value
}

function FacetGroup({ k, values, selected, onToggle }: { k: ListKey; values: FacetValue[]; selected: string[]; onToggle: (k: ListKey, v: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const nonEmpty = values.filter((v) => v.count > 0 || selected.includes(v.value))
  if (!nonEmpty.length) return null
  const shown = expanded ? nonEmpty : nonEmpty.slice(0, 6)
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{FACET_TITLES[k]}</div>
      <div className="space-y-1.5">
        {shown.map((v) => {
          const id = `f-${k}-${v.value}`
          return (
            <label key={v.value} htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox id={id} checked={selected.includes(v.value)} onCheckedChange={() => onToggle(k, v.value)} />
              <span className="flex-1 truncate">{facetLabel(k, v.value)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{v.count}</span>
            </label>
          )
        })}
      </div>
      {nonEmpty.length > 6 && (
        <button className="mt-1.5 text-xs font-medium text-brand-mid hover:underline" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : `Show ${nonEmpty.length - 6} more`}
        </button>
      )}
    </div>
  )
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState("all")
  const [visible, setVisible] = useState(20)
  const q = params.get("q") ?? ""

  const apiParams = useMemo(() => {
    const p: Record<string, unknown> = { q, parse: params.get("parse"), limit: 200 }
    for (const k of LIST_KEYS) p[k] = params.getAll(k)
    p.value_min = params.get("value_min")
    p.value_max = params.get("value_max")
    return p
  }, [params, q])

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["search", apiParams],
    queryFn: () => api.get<SearchResponse>(`/search${qs(apiParams)}`),
    placeholderData: keepPreviousData,
  })

  /** Switch to structured mode: keywords + explicit filters (parsed chips become real filters). */
  function applyFilters(mutate: (f: Record<string, string[] | number | undefined>) => void) {
    if (!data) return
    const f: Record<string, string[] | number | undefined> = {}
    for (const k of LIST_KEYS) f[k] = [...((data.filters[k] as string[]) ?? [])]
    f.value_min = data.filters.value_min as number | undefined
    f.value_max = data.filters.value_max as number | undefined
    mutate(f)
    const next = new URLSearchParams()
    if (data.keywords) next.set("q", data.keywords)
    next.set("parse", "0")
    for (const [k, v] of Object.entries(f)) {
      if (Array.isArray(v)) v.forEach((x) => next.append(k, x))
      else if (v !== undefined && v !== null) next.set(k, String(v))
    }
    setVisible(20)
    setParams(next)
  }

  function toggle(k: ListKey, v: string) {
    applyFilters((f) => {
      const arr = f[k] as string[]
      f[k] = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
    })
  }

  function removeChip(key: string, value: string | number) {
    applyFilters((f) => {
      if (key === "value_min" || key === "value_max") f[key] = undefined
      else f[key] = (f[key] as string[]).filter((x) => x !== value)
    })
  }

  const activeFilters = data
    ? LIST_KEYS.flatMap((k) => ((data.filters[k] as string[]) ?? []).map((v) => ({ key: k, value: v, label: `${FACET_TITLES[k]}: ${facetLabel(k, v)}` })))
        .concat(
          data.filters.value_min !== undefined ? [{ key: "value_min" as ListKey, value: String(data.filters.value_min), label: `Value ≥ $${(Number(data.filters.value_min) / 1e6).toFixed(1)}m` }] : [],
          data.filters.value_max !== undefined ? [{ key: "value_max" as ListKey, value: String(data.filters.value_max), label: `Value ≤ $${(Number(data.filters.value_max) / 1e6).toFixed(1)}m` }] : [],
        )
    : []
  const parsedKeys = new Set(data?.chips.map((c) => `${c.key}:${c.value}`))

  // Tab counts reflect the current result set (the doc_type facet deliberately ignores its own filter).
  const all = data?.results ?? []
  const tabCounts: Record<string, number> = {
    all: data?.total ?? 0,
    content: all.filter((r) => CONTENT_TYPES.includes(r.doc_type)).length,
    opportunity: all.filter((r) => r.entity_type === "opportunity").length,
    contact: all.filter((r) => r.entity_type === "contact").length,
  }
  const results = (data?.results ?? []).filter((r) =>
    tab === "all" ? true : tab === "content" ? r.entity_type === "content" : r.entity_type === tab,
  )

  const facets = data && (
    <div className="space-y-6">
      {LIST_KEYS.map((k) => (
        <FacetGroup key={k} k={k} values={data.facets[k] ?? []} selected={(data.filters[k] as string[]) ?? []} onToggle={toggle} />
      ))}
    </div>
  )

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primary sm:text-3xl">{q ? <>Results for “{q}”</> : "Search"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total} result${data.total === 1 ? "" : "s"}` : "Searching…"}
            {data?.relaxed && " · showing partial matches (no result matched every keyword)"}
          </p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="lg:hidden">
              <Filter className="size-4" /> Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto p-5">
            <SheetHeader className="p-0 pb-4">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            {facets}
          </SheetContent>
        </Sheet>
      </div>

      {data && data.chips.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-success/50 bg-success/10 p-3 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-mid" />
          <div>
            <span className="font-medium">Understood your query as:</span>{" "}
            {data.keywords ? <>keywords “{data.keywords}” plus </> : null}
            {data.chips.map((c) => c.label).join(", ")}. Remove any filter below to broaden the search.
          </div>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {activeFilters.map((c) => (
            <Badge key={`${c.key}:${c.value}`} variant="secondary" className="gap-1 py-1 pr-1 pl-2.5">
              {parsedKeys.has(`${c.key}:${c.value}`) && <Sparkles className="size-3 text-brand-mid" />}
              {c.label}
              <button onClick={() => removeChip(c.key, c.value)} className="rounded-full p-0.5 hover:bg-primary/10" aria-label={`Remove ${c.label}`}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setParams(q ? { q: data?.keywords ?? q, parse: "0" } : {})}>
            Clear all
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          {isLoading ? <Skeleton className="h-96 rounded-xl" /> : <div className="sticky top-24 rounded-xl border bg-card p-4">{facets}</div>}
        </aside>
        <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
          <Tabs value={tab} onValueChange={(v) => { setTab(v); setVisible(20) }} className="mb-4">
            <TabsList className="flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label} <span className="ml-1 text-xs text-muted-foreground tabular-nums">{tabCounts[t.value]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          ) : results.length === 0 ? (
            <EmptyState icon={SearchX} title="No matching content you can access">
              Try fewer keywords or remove a filter. Some content is visible only within its originating sector.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {results.slice(0, visible).map((r) => (
                <ResultCard key={`${r.entity_type}-${r.entity_id}`} r={r} terms={data?.terms ?? []} />
              ))}
              {results.length > visible && (
                <Button variant="outline" className="w-full" onClick={() => setVisible((v) => v + 20)}>
                  Show more ({results.length - visible} remaining)
                </Button>
              )}
              {data && data.total > data.results.length && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-3.5" /> Showing the top {data.results.length} of {data.total}. Refine with filters to narrow down.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
