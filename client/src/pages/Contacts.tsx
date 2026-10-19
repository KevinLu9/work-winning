import { useState } from "react"
import { Link } from "react-router-dom"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { MapPin, Search, Trophy, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState, PageHeader, SectorBadge, SourceBadge } from "@/components/common"
import { api, qs } from "@/lib/api"
import { money } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useMeta } from "@/lib/persona"
import type { Contact } from "@/lib/types"

export function initials(name: string) {
  return name.replace(/^(Dr\.|Col\. \(Ret\.\))\s*/, "").split(" ").map((p) => p[0]).slice(0, 2).join("")
}

export default function ContactsPage() {
  const { data: meta } = useMeta()
  const [q, setQ] = useState("")
  const [sector, setSector] = useState("all")
  const [expertise, setExpertise] = useState<string[]>([])
  const [sort, setSort] = useState("opps")
  const [source, setSource] = useState("all")
  const params = { q, sector: sector === "all" ? undefined : sector, expertise, sort, source: source === "all" ? undefined : source }
  const { data, isLoading } = useQuery({
    queryKey: ["contacts", params],
    queryFn: () => api.get<Contact[]>(`/contacts${qs(params)}`),
    placeholderData: keepPreviousData,
  })

  return (
    <div>
      <PageHeader
        eyebrow="Contact discovery"
        title="Find the right people"
        description="Experts derived from Salesforce pursuit teams (proposal managers, bid writers, tender managers, estimators, commercial and legal leads) plus delivery leads on won contracts."
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, client, service line…" className="pl-9" />
        </div>
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="sm:w-60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sectors</SelectItem>
            {meta?.sectors.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="opps">Most pursuits</SelectItem>
            <SelectItem value="wins">Most wins</SelectItem>
            <SelectItem value="tcv">Largest TCV</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => { setSource(v) }}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All data sources</SelectItem>
            {meta?.data_sources.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {meta?.expertise.map((e) => {
          const on = expertise.includes(e)
          return (
            <button
              key={e}
              onClick={() => setExpertise((x) => (on ? x.filter((y) => y !== e) : [...x, e]))}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
              aria-pressed={on}
            >
              {e}
            </button>
          )
        })}
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <EmptyState icon={Users} title="No contacts match">Try removing an expertise filter.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Link key={c.id} to={`/contacts/${c.id}`} className="group flex flex-col rounded-xl border bg-card p-4 shadow-xs transition hover:border-brand-mid/50 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">{c.is_team ? <Users className="size-5" /> : initials(c.name)}</div>
                <div className="min-w-0">
                  <div className="truncate font-semibold group-hover:text-primary">{c.name}</div>
                  <div className="truncate text-sm text-muted-foreground">{c.title}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <SectorBadge sector={c.primary_sector} />
                <SourceBadge source={c.data_source} />
                {c.expertise.map((e) => <Badge key={e} variant="secondary">{e}</Badge>)}
              </div>
              <div className="mt-auto grid grid-cols-3 gap-2 pt-4 text-center text-xs">
                <div><div className="text-base font-semibold tabular-nums text-primary">{c.opp_count}</div>pursuits</div>
                <div><div className="inline-flex items-center gap-1 text-base font-semibold tabular-nums text-primary"><Trophy className="size-3.5 text-brand-mid" />{c.win_count}</div><div>wins</div></div>
                <div><div className="text-base font-semibold tabular-nums text-primary">{money(c.total_tcv)}</div>TCV</div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" />{c.location}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
