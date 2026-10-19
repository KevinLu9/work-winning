import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, Database, ExternalLink, Lock, MapPin, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Bars } from "@/components/charts"
import { ApprovalBadge, EmptyState, OutcomeBadge, SectorBadge, SourceBadge, StatCard, TypeIcon, VisibilityBadge } from "@/components/common"
import { api } from "@/lib/api"
import { date, formatField, money, TYPE_LABELS } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { OpportunityDetail, OpportunityField } from "@/lib/types"

function fieldValue(groups: OpportunityDetail["groups"], column: string) {
  for (const g of groups) for (const f of g.fields) if (f.column === column) return f.value
  return null
}

function FieldValue({ f }: { f: OpportunityField }) {
  if (f.type === "link" && f.value)
    return (
      <a href="#" onClick={(e) => { e.preventDefault(); toast.info("SharePoint is simulated in this demo", { description: String(f.value) }) }} className="inline-flex items-center gap-1 text-brand-mid hover:underline">
        <ExternalLink className="size-3.5" />{String(f.value)}
      </a>
    )
  if (f.type === "multiselect" && Array.isArray(f.value) && f.value.length)
    return <div className="flex flex-wrap gap-1">{f.value.map((v: string) => <Badge key={v} variant="outline">{v}</Badge>)}</div>
  return <>{formatField(f.value, f.type)}</>
}

export default function OpportunityDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)
  const { data, isLoading, error } = useQuery({ queryKey: ["opportunity", id], queryFn: () => api.get<OpportunityDetail>(`/opportunities/${id}`) })

  if (isLoading) return <Skeleton className="h-[70vh] rounded-xl" />
  if (error || !data)
    return <EmptyState icon={Lock} title="Not found or you do not have access">Restricted opportunities are only visible within their own sector.</EmptyState>

  const v = (c: string) => fieldValue(data.groups, c)
  const scope = v("Scope_of_Works__c")
  const teamsite = v("Proposal_Teamsite__c")

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="size-4" /> Back
      </Button>

      <div className="rounded-2xl border bg-card p-5 sm:p-8">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="gap-1"><TypeIcon type="opportunity" className="size-3" />Salesforce opportunity</Badge>
          <SectorBadge sector={data.facets.sector} short={false} />
          <OutcomeBadge status={data.facets.status} />
          <Badge variant="outline">{v("StageName")}</Badge>
          {data.facets.restricted ? <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive"><Lock className="size-3" />Restricted</Badge> : <Badge variant="outline">Unrestricted</Badge>}
          <SourceBadge source={data.facets.source} />
        </div>
        <h1 className="text-2xl font-semibold text-primary sm:text-3xl">{data.name}</h1>
        {scope && <p className="mt-2 max-w-3xl text-muted-foreground">{scope}</p>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span>{data.facets.client}</span>
          {data.facets.region && <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{data.facets.regions || data.facets.region}</span>}
          {v("BRS_Opportunity_Number__c") && <span>BRS {v("BRS_Opportunity_Number__c")}</span>}
          {v("Opportunity_Status__c") && <span>Status: {v("Opportunity_Status__c")}</span>}
          {teamsite && (
            <a href="#" onClick={(e) => { e.preventDefault(); toast.info("SharePoint is simulated in this demo", { description: String(teamsite) }) }} className="inline-flex items-center gap-1 text-brand-mid hover:underline">
              <ExternalLink className="size-3.5" />Proposal teamsite
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total contract value" value={money(data.facets.tcv)} />
        <StatCard label="Annual contract value" value={money(v("Annual_Contract_Value__c"))} />
        <StatCard label="Probability" value={`${v("Probability") ?? 0}%`} hint={v("Go_Get__c") ? `Go/Get: ${v("Go_Get__c")}` : undefined} />
        <StatCard label="Weighted value" value={money(v("Total_Weighted_Contract_Value__c"))} />
        <StatCard label="Contract period" value={v("Contract_Period_monthsRev1__c") ? `${v("Contract_Period_monthsRev1__c")} mo` : "—"} hint={v("New_or_Renewal_Work__c")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Key dates</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative space-y-3 border-l border-border pl-4">
              {data.timeline.map((t) => (
                <li key={t.column} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-brand-mid" />
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{date(t.date)}</div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Pursuit & delivery team</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.people.length === 0 && <p className="text-sm text-muted-foreground">No people recorded.</p>}
            {data.people.map((p, i) => {
              const inner = (
                <>
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><UserRound className="size-4" /></div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.role}</div>
                  </div>
                </>
              )
              return p.contact_id ? (
                <Link key={i} to={`/contacts/${p.contact_id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">{inner}</Link>
              ) : (
                <div key={i} className="flex items-center gap-3 p-2">{inner}</div>
              )
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Reusable content from this opportunity</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.content.length === 0 && <p className="text-sm text-muted-foreground">No derived content yet. <Link to="/submit" className="text-brand-mid hover:underline">Submit a case study →</Link></p>}
            {data.content.map((c) => (
              <Link key={c.id} to={`/content/${c.id}`} className="flex items-start gap-2 rounded-lg p-2 hover:bg-muted">
                <TypeIcon type={c.type} className="mt-0.5 size-4 shrink-0 text-brand-mid" />
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-medium">{c.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {TYPE_LABELS[c.type]} <VisibilityBadge visibility={c.visibility} /> <ApprovalBadge status={c.approval_status} />
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.revenue_split.length > 0 && (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Revenue split by region</CardTitle>
              <p className="text-xs text-muted-foreground">From Australia_*/New_Zealand_* revenue fields · {data.revenue_split.map((r) => `${r.region} ${r.percent}%`).join(" · ")}</p>
            </CardHeader>
            <CardContent>
              <Bars data={data.revenue_split} xKey="region" series={[{ key: "revenue", label: "Revenue" }, { key: "weighted", label: "Weighted revenue" }]} />
            </CardContent>
          </Card>
        )}
        {data.fy_forecast.length > 0 && (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Revenue forecast by financial year</CardTitle>
              <p className="text-xs text-muted-foreground">From Estimated_FY25–FY31 revenue and margin fields</p>
            </CardHeader>
            <CardContent>
              <Bars data={data.fy_forecast} xKey="fy" series={[{ key: "revenue", label: "Revenue" }, { key: "margin", label: "Margin" }]} />
            </CardContent>
          </Card>
        )}
      </div>

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-primary"><Database className="size-5" /> All Salesforce fields</h2>
            <p className="text-sm text-muted-foreground">
              {data.populated_count} of {data.total_fields} fields populated. Labels and groups come from the field dictionary (sf_field_meta).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
            <Label htmlFor="show-all" className="text-sm">Show empty fields</Label>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.groups.map((g) => {
            const fields = g.fields.filter((f) => showAll || f.populated)
            if (!fields.length) return null
            return (
              <Card key={g.name} className={cn(g.name === "System" && "opacity-90")}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    {g.name}
                    <span className="text-xs font-normal text-muted-foreground">{g.fields.filter((f) => f.populated).length} / {g.fields.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y">
                    {fields.map((f) => (
                      <div key={f.column} className={cn("grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 py-2 text-sm", !f.populated && "text-muted-foreground")}>
                        <dt>
                          <div className="font-medium">{f.label}</div>
                          <code className="text-[10px] break-all text-muted-foreground">{f.column}</code>
                        </dt>
                        <dd className={cn("break-words", f.populated && f.type === "currency" && "tabular-nums")}><FieldValue f={f} /></dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
