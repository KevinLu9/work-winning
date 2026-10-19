import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertCircle, ArchiveRestore, CalendarClock, CheckCircle2, ClipboardList, FileWarning, ShieldCheck, ThumbsDown, ThumbsUp, Timer } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState, PageHeader, SectorBadge, StatCard, TypeIcon, VisibilityBadge } from "@/components/common"
import { api, ApiError, qs } from "@/lib/api"
import { date, relativeDays, TYPE_LABELS } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useMeta, usePersona } from "@/lib/persona"
import type { Governance, QueueItem } from "@/lib/types"

interface AuditRow { id: number; ts: string; user_name: string | null; user_sector: string | null; action: string; entity_type: string | null; entity_id: string | null; detail: any }

function Queue({ items, dateKey, actions, linked = true }: {
  items: QueueItem[]; dateKey?: "review_date" | "expiry_date"; actions?: (i: QueueItem) => ReactNode; linked?: boolean
}) {
  if (!items.length) return <EmptyState icon={CheckCircle2} title="Nothing in this queue">All clear for this sector.</EmptyState>
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Content</TableHead>
            <TableHead className="hidden md:table-cell">Owner</TableHead>
            <TableHead className="hidden sm:table-cell">Visibility</TableHead>
            {dateKey && <TableHead>{dateKey === "review_date" ? "Review" : "Expiry"}</TableHead>}
            {actions && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="max-w-md">
                {linked ? (
                  <Link to={`/content/${i.id}`} className="flex items-start gap-2 font-medium text-primary hover:underline">
                    <TypeIcon type={i.type} className="mt-0.5 size-4 shrink-0 text-brand-mid" />
                    <span className="line-clamp-2">{i.title}</span>
                  </Link>
                ) : (
                  // Archived content has no page: it is hidden from everyone until restored.
                  <div className="flex items-start gap-2 font-medium text-muted-foreground">
                    <TypeIcon type={i.type} className="mt-0.5 size-4 shrink-0" />
                    <span className="line-clamp-2">{i.title}</span>
                  </div>
                )}
                <div className="mt-0.5 flex gap-1.5 pl-6 text-xs text-muted-foreground">{TYPE_LABELS[i.type]} <SectorBadge sector={i.sector} /></div>
              </TableCell>
              <TableCell className="hidden md:table-cell">{i.owner ?? <span className="text-destructive">Unassigned</span>}</TableCell>
              <TableCell className="hidden sm:table-cell"><VisibilityBadge visibility={i.visibility} /></TableCell>
              {dateKey && (
                <TableCell className="whitespace-nowrap">
                  <div>{date(i[dateKey])}</div>
                  <div className={cn("text-xs", (i[dateKey] ?? "") < new Date().toISOString().slice(0, 10) ? "text-destructive" : "text-muted-foreground")}>{relativeDays(i[dateKey])}</div>
                </TableCell>
              )}
              {actions && <TableCell className="text-right">{actions(i)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default function GovernancePage() {
  const { data: meta } = useMeta()
  const { user } = usePersona()
  const queryClient = useQueryClient()
  const [sector, setSector] = useState("all")
  const isEA = user?.role === "enterprise_admin"
  const params = isEA && sector !== "all" ? { sector } : {}
  const { data, isLoading } = useQuery({ queryKey: ["governance", params], queryFn: () => api.get<Governance>(`/governance${qs(params)}`) })
  const isAdmin = user?.role === "enterprise_admin" || user?.role === "sector_admin"
  const { data: audit } = useQuery({ queryKey: ["audit"], queryFn: () => api.get<AuditRow[]>("/audit"), enabled: isAdmin, retry: (_, e) => !(e instanceof ApiError) })

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approve" | "reject" }) => api.post<{ approval_status: string; notification: string }>(`/content/${id}/approve`, { decision }),
    onSuccess: (r) => {
      toast.success(`Content ${r.approval_status}`, { description: r.notification })
      queryClient.invalidateQueries()
    },
    onError: (e) => toast.error(e.message),
  })
  const reviewed = useMutation({
    mutationFn: (id: string) => api.post<{ review_date: string }>(`/content/${id}/review`),
    onSuccess: (r) => {
      toast.success("Review recorded", { description: `Next review ${date(r.review_date)}` })
      queryClient.invalidateQueries()
    },
    onError: (e) => toast.error(e.message),
  })

  const restore = useMutation({
    mutationFn: (id: string) => api.post(`/content/${id}/restore`),
    onSuccess: () => {
      toast.success("Content restored", { description: "It is visible again under its previous visibility settings." })
      queryClient.invalidateQueries()
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading || !data || !meta) return <Skeleton className="h-[70vh] rounded-xl" />

  const approveActions = data.can_approve
    ? (i: QueueItem) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={() => decide.mutate({ id: i.id, decision: "approve" })}><ThumbsUp className="size-3.5" /><span className="hidden lg:inline">Approve</span></Button>
          <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: i.id, decision: "reject" })}><ThumbsDown className="size-3.5" /></Button>
        </div>
      )
    : undefined
  const restoreActions = data.can_approve
    ? (i: QueueItem) => (
        <Button size="sm" variant="outline" onClick={() => restore.mutate(i.id)} disabled={restore.isPending}>
          <ArchiveRestore className="size-3.5" /> Restore
        </Button>
      )
    : undefined
  const reviewActions = data.can_approve
    ? (i: QueueItem) => <Button size="sm" variant="outline" onClick={() => reviewed.mutate(i.id)}><CheckCircle2 className="size-3.5" /> Reviewed</Button>
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content governance"
        title={`Governance: ${data.scope}`}
        description="Every item has an owner, review cycle, approval status and version. Repositories fail when ownership isn't defined, so queues are scoped to each sector's administrator."
        actions={isEA && (
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sectors</SelectItem>
              {meta.sectors.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      />
      {!data.can_approve && (
        <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          You are viewing your sector's queues read-only. Switch to the <b>Sector Content Administrator</b> persona to approve content and complete reviews.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Overdue reviews" value={data.overdue.length} icon={AlertCircle} />
        <StatCard label="Due in 30 days" value={data.due_soon.length} icon={CalendarClock} />
        <StatCard label="Awaiting approval" value={data.pending.length} icon={Timer} />
        <StatCard label="Expired" value={data.expired.length} icon={FileWarning} />
      </div>

      <Tabs defaultValue={data.pending.length ? "pending" : "overdue"}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="pending">Approvals <Badge variant="secondary" className="ml-1">{data.pending.length}</Badge></TabsTrigger>
          <TabsTrigger value="overdue">Overdue <Badge variant="secondary" className="ml-1">{data.overdue.length}</Badge></TabsTrigger>
          <TabsTrigger value="due">Due soon <Badge variant="secondary" className="ml-1">{data.due_soon.length}</Badge></TabsTrigger>
          <TabsTrigger value="expired">Expired <Badge variant="secondary" className="ml-1">{data.expired.length}</Badge></TabsTrigger>
          <TabsTrigger value="incomplete">Incomplete metadata <Badge variant="secondary" className="ml-1">{data.incomplete.length}</Badge></TabsTrigger>
          {data.rejected.length > 0 && <TabsTrigger value="rejected">Rejected <Badge variant="secondary" className="ml-1">{data.rejected.length}</Badge></TabsTrigger>}
          {data.archived.length > 0 && <TabsTrigger value="archived">Archived <Badge variant="secondary" className="ml-1">{data.archived.length}</Badge></TabsTrigger>}
          {isAdmin && <TabsTrigger value="audit">Audit log</TabsTrigger>}
        </TabsList>
        <TabsContent value="pending" className="mt-4"><Queue items={data.pending} actions={approveActions} /></TabsContent>
        <TabsContent value="overdue" className="mt-4"><Queue items={data.overdue} dateKey="review_date" actions={reviewActions} /></TabsContent>
        <TabsContent value="due" className="mt-4"><Queue items={data.due_soon} dateKey="review_date" actions={reviewActions} /></TabsContent>
        <TabsContent value="expired" className="mt-4"><Queue items={data.expired} dateKey="expiry_date" /></TabsContent>
        <TabsContent value="incomplete" className="mt-4"><Queue items={data.incomplete} /></TabsContent>
        <TabsContent value="rejected" className="mt-4"><Queue items={data.rejected} /></TabsContent>
        <TabsContent value="archived" className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">Archived content is hidden from everyone, in every sector. Restoring it brings it back as approved, with the visibility it had before.</p>
          <Queue items={data.archived} actions={restoreActions} linked={false} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="audit" className="mt-4">
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>When</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead className="hidden md:table-cell">Entity</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {audit?.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(a.ts).toLocaleString("en-AU")}</TableCell>
                      <TableCell className="text-sm">{a.user_name ?? "system"}</TableCell>
                      <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                      <TableCell className="hidden max-w-sm truncate text-xs text-muted-foreground md:table-cell">
                        {a.entity_type} {a.entity_id ?? ""} {a.action === "search" && a.detail?.q ? `“${a.detail.q}” → ${a.detail.total}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <section>
        <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold text-primary"><ShieldCheck className="size-5" /> Sector ownership</h2>
        <p className="mb-4 text-sm text-muted-foreground">Each sector nominates a content owner, administrator and backup administrator.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.roster.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-base">{s.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">Content owner</dt><dd className="font-medium">{s.content_owner ?? <span className="font-normal text-muted-foreground">Not nominated</span>}</dd>
                  <dt className="text-muted-foreground">Administrator</dt><dd className="font-medium">{s.administrator}</dd>
                  <dt className="text-muted-foreground">Backup admin</dt><dd className="font-medium">{s.backup_administrator ?? <span className="font-normal text-muted-foreground">Not nominated</span>}</dd>
                </dl>
                <div>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Metadata completeness</span><span className="font-medium tabular-nums">{s.completeness}%</span></div>
                  <Progress value={s.completeness} className="h-2" />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span><ClipboardList className="mr-1 inline size-3" />{s.content_count} items</span>
                  <span className={s.overdue ? "text-destructive" : ""}>{s.overdue} overdue</span>
                  <span>{s.pending} pending</span>
                  <span>{s.restricted} restricted</span>
                  {s.archived > 0 && <span>{s.archived} archived</span>}
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted" title="Visibility mix: sector only / shared / enterprise">
                  {(["sector_only", "shared", "enterprise"] as const).map((v, i) => (
                    <div key={v} style={{ width: `${(s.visibility[v] / Math.max(1, s.content_count)) * 100}%` }}
                      className={cn("h-full", i === 0 ? "bg-amber-400" : i === 1 ? "bg-sky-500" : "bg-brand-mid", i > 0 && "border-l-2 border-card")} />
                  ))}
                </div>
                <div className="flex gap-3 text-[11px] text-muted-foreground">
                  <span>■ <span className="text-amber-600">Sector only</span> {s.visibility.sector_only}</span>
                  <span>■ <span className="text-sky-600">Shared</span> {s.visibility.shared}</span>
                  <span>■ <span className="text-brand-mid">Enterprise</span> {s.visibility.enterprise}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
