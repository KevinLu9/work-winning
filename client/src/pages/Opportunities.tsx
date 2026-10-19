import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, Briefcase, ChevronLeft, ChevronRight, Lock, Percent, Search, Target, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Bars } from "@/components/charts"
import { OutcomeBadge, PageHeader, SectorBadge, SourceBadge, StatCard } from "@/components/common"
import { api, qs } from "@/lib/api"
import { date, money, SECTOR_SHORT } from "@/lib/format"
import { useMeta } from "@/lib/persona"
import type { OpportunityRow } from "@/lib/types"

interface OppStats {
  by_stage: { stage: string; count: number; tcv: number }[]
  by_sector: { sector: string; won: number; open: number; lost: number; won_count: number; lost_count: number; count: number }[]
  reasons: { reason: string; won: number; lost: number }[]
  totals: { count: number; pipeline_tcv: number; won_tcv: number; weighted_pipeline: number; win_rate: number | null }
}

const COLUMNS: { key: string; label: string; className?: string }[] = [
  { key: "name", label: "Opportunity" },
  { key: "client", label: "Client", className: "hidden md:table-cell" },
  { key: "sector", label: "Sector", className: "hidden lg:table-cell" },
  { key: "stage", label: "Stage" },
  { key: "tcv", label: "TCV", className: "text-right" },
  { key: "probability", label: "Prob.", className: "hidden sm:table-cell text-right" },
  { key: "close", label: "Close", className: "hidden md:table-cell" },
  { key: "manager", label: "Proposal manager", className: "hidden xl:table-cell" },
]

export default function OpportunitiesPage() {
  const navigate = useNavigate()
  const { data: meta } = useMeta()
  const [q, setQ] = useState("")
  const [sector, setSector] = useState("all")
  const [status, setStatus] = useState("all")
  const [source, setSource] = useState("all")
  const [sort, setSort] = useState({ key: "close", dir: "desc" })
  const [page, setPage] = useState(1)

  const filters = { q, sector: sector === "all" ? undefined : sector, status: status === "all" ? undefined : status, source: source === "all" ? undefined : source }
  const listParams = { ...filters, sort: sort.key, dir: sort.dir, page, page_size: 20 }
  const { data: list, isFetching } = useQuery({
    queryKey: ["opportunities", listParams],
    queryFn: () => api.get<{ total: number; items: OpportunityRow[] }>(`/opportunities${qs(listParams)}`),
    placeholderData: keepPreviousData,
  })
  const { data: stats } = useQuery({
    queryKey: ["opportunity-stats", filters],
    queryFn: () => api.get<OppStats>(`/opportunities/stats${qs(filters)}`),
    placeholderData: keepPreviousData,
  })

  function toggleSort(key: string) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "client" ? "asc" : "desc" }))
    setPage(1)
  }
  const pages = list ? Math.max(1, Math.ceil(list.total / 20)) : 1

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Salesforce integration"
        title="Opportunity explorer"
        description="Salesforce Opportunity records loaded from salesforce_synthetic_cut.xlsx (all 284 fields). Opportunities classified as Restricted are only visible to their own sector."
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search name, client, scope or proposal manager" className="pl-9" />
        </div>
        <Select value={sector} onValueChange={(v) => { setSector(v); setPage(1) }}>
          <SelectTrigger className="sm:w-60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sectors</SelectItem>
            {meta?.sectors.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => { setSource(v); setPage(1) }}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All data sources</SelectItem>
            {meta?.data_sources.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard label="Opportunities" value={stats.totals.count} icon={Briefcase} />
            <StatCard label="Open pipeline (TCV)" value={money(stats.totals.pipeline_tcv)} hint={`Weighted ${money(stats.totals.weighted_pipeline)}`} icon={Target} />
            <StatCard label="Won (TCV)" value={money(stats.totals.won_tcv)} icon={Trophy} />
            <StatCard label="Win rate" value={stats.totals.win_rate !== null ? `${stats.totals.win_rate}%` : "—"} hint="Won ÷ closed" icon={Percent} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base">Contract value by stage</CardTitle></CardHeader>
          <CardContent>
            {stats && <Bars data={stats.by_stage.map((s) => ({ ...s, stage: s.stage.replace("Proposal/Price Quote", "Proposal").replace("Negotiation/Review", "Negotiation") }))} xKey="stage" series={[{ key: "tcv", label: "TCV" }]} layout="vertical" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base">Value by sector and outcome</CardTitle></CardHeader>
          <CardContent>
            {stats && (
              <Bars
                data={stats.by_sector.map((s) => ({ ...s, sector: SECTOR_SHORT[s.sector] ?? s.sector }))}
                xKey="sector"
                stacked
                series={[{ key: "won", label: "Won" }, { key: "open", label: "Open" }, { key: "lost", label: "Lost" }]}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base">Won / lost reasons</CardTitle></CardHeader>
          <CardContent>
            {stats && (
              <Bars
                data={stats.reasons.slice(0, 8)}
                xKey="reason"
                layout="vertical"
                series={[{ key: "won", label: "Won" }, { key: "lost", label: "Lost" }]}
                format={(v) => String(v)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={isFetching ? "opacity-70" : ""}>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableHead key={c.key} className={c.className}>
                    <button className="inline-flex items-center gap-1 font-medium hover:text-foreground" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sort.key === c.key && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list?.items.map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/opportunities/${o.id}`)}>
                  <TableCell className="max-w-xs">
                    <Link to={`/opportunities/${o.id}`} className="line-clamp-2 font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      {o.name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <OutcomeBadge status={o.status} />
                      <SourceBadge source={o.source} />
                      {o.classification === "Restricted" && <span className="inline-flex items-center gap-0.5 text-destructive"><Lock className="size-3" />Restricted</span>}
                      <span className="md:hidden">{o.client}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-[200px] truncate md:table-cell">{o.client}</TableCell>
                  <TableCell className="hidden lg:table-cell"><SectorBadge sector={o.sector} /></TableCell>
                  <TableCell className="text-sm">{o.stage}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(o.tcv)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{o.probability ?? "—"}%</TableCell>
                  <TableCell className="hidden whitespace-nowrap md:table-cell">{date(o.close_date)}</TableCell>
                  <TableCell className="hidden xl:table-cell">{o.proposal_manager ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>{list ? `${list.total} opportunities` : "Loading…"}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
              <span className="tabular-nums">{page} / {pages}</span>
              <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
