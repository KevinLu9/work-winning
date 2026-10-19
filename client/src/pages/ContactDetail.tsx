import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Lock, MapPin, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, OutcomeBadge, SectorBadge, SourceBadge, StatCard, TypeIcon } from "@/components/common"
import { api } from "@/lib/api"
import { date, money, TYPE_LABELS } from "@/lib/format"
import type { ContactDetail } from "@/lib/types"
import { initials } from "./Contacts"

export default function ContactDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: c, isLoading, error } = useQuery({ queryKey: ["contact", id], queryFn: () => api.get<ContactDetail>(`/contacts/${id}`) })

  if (isLoading) return <Skeleton className="h-[60vh] rounded-xl" />
  if (error || !c) return <EmptyState title="Contact not found" />

  const winRate = c.closed_count ? Math.round((c.win_count / c.closed_count) * 100) : null

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="size-4" /> Back
      </Button>
      <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:p-8">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-2xl font-semibold text-primary-foreground">
          {c.is_team ? <Users className="size-8" /> : initials(c.name)}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-primary sm:text-3xl">{c.name}</h1>
          <div className="text-muted-foreground">{c.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SourceBadge source={c.data_source} />
            {c.sectors.map((s) => <SectorBadge key={s} sector={s} short={false} />)}
            {c.expertise.map((e) => <Badge key={e} variant="secondary">{e}</Badge>)}
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{c.location}</span>
          </div>
          <p className="mt-3 max-w-2xl text-sm">{c.bio}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pursuits" value={c.opp_count} />
        <StatCard label="Wins" value={c.win_count} />
        <StatCard label="Win rate" value={winRate !== null ? `${winRate}%` : "—"} hint={`${c.closed_count} closed`} />
        <StatCard label="Total TCV" value={money(c.total_tcv)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Roles on pursuits</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">{c.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Clients worked with</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">{c.clients.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Service lines</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">{c.service_lines.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Opportunities</CardTitle>
          {c.hidden_opportunities > 0 && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3" />{c.hidden_opportunities} restricted opportunities from other sectors are hidden</p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead className="hidden md:table-cell">Role</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead className="text-right">TCV</TableHead>
                <TableHead className="hidden md:table-cell">Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.opportunities.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="max-w-sm">
                    <Link to={`/opportunities/${o.id}`} className="line-clamp-2 font-medium text-primary hover:underline">{o.name}</Link>
                    <div className="mt-0.5 flex flex-wrap gap-1"><OutcomeBadge status={o.status} /><SourceBadge source={o.source} /></div>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{o.roles}</TableCell>
                  <TableCell className="hidden max-w-[200px] truncate sm:table-cell">{o.client}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(o.tcv)}</TableCell>
                  <TableCell className="hidden whitespace-nowrap md:table-cell">{date(o.close_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {c.content.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Content they own or contributed to</CardTitle></CardHeader>
          <CardContent className="grid gap-1 sm:grid-cols-2">
            {c.content.map((x) => (
              <Link key={x.id} to={`/content/${x.id}`} className="flex items-start gap-2 rounded-lg p-2 hover:bg-muted">
                <TypeIcon type={x.type} className="mt-0.5 size-4 shrink-0 text-brand-mid" />
                <div className="min-w-0">
                  <div className="line-clamp-1 text-sm font-medium">{x.title}</div>
                  <div className="text-xs text-muted-foreground">{TYPE_LABELS[x.type]}{x.is_owner ? " · Owner" : ""}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
