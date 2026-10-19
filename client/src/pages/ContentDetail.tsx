import { useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Archive,
  ArrowLeft,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ExternalLink,
  History,
  Lock,
  MapPin,
  Quote,
  Share2,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ApprovalBadge,
  EmptyState,
  Field,
  FlagBadges,
  OutcomeBadge,
  PhotoPlaceholder,
  SectorBadge,
  SourceBadge,
  TypeBadge,
  TypeIcon,
  VisibilityBadge,
} from "@/components/common"
import { HeroBanner, MediaPanel } from "@/components/media"
import { VisibilityPicker, type VisibilityValue } from "@/components/visibility"
import { api, ApiError } from "@/lib/api"
import { date, daysFromToday, money, relativeDays, TYPE_LABELS, VISIBILITY_LABELS } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ContentDetail } from "@/lib/types"

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-primary">{title}</h2>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-mid" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  )
}

function Body({ item }: { item: ContentDetail }) {
  const b = item.body ?? {}
  switch (item.type) {
    case "case_study":
      return (
        <div className="space-y-6">
          <Section title="The challenge">{b.challenge}</Section>
          <Section title="Our solution">{b.solution}</Section>
          {b.outcomes?.length > 0 && <Section title="Outcomes"><List items={b.outcomes} /></Section>}
          {b.source_url && (
            <a href={b.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-mid hover:underline">
              <ExternalLink className="size-3.5" /> Read the published project page
            </a>
          )}
          {b.reference_contact && (
            <Section title="Client reference">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                <Quote className="size-5 text-brand-mid" />
                <div>
                  <div className="font-medium">{b.reference_contact.name}</div>
                  <div className="text-muted-foreground">{b.reference_contact.title}, {b.reference_contact.organisation}</div>
                  {item.restricted_flags.includes("referee") && <div className="mt-1 text-xs text-destructive">Referee details are restricted. Do not share outside the sector.</div>}
                </div>
              </div>
            </Section>
          )}
        </div>
      )
    case "project_profile":
      return (
        <div className="space-y-6">
          <Section title="Project description">{b.description}</Section>
          {b.services_delivered?.length > 0 && (
            <Section title="Services delivered">
              <div className="flex flex-wrap gap-1.5">{b.services_delivered.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
            </Section>
          )}
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Contract value">{money(b.contract_value)}</Field>
            <Field label="Duration">{b.duration_months ? `${b.duration_months} months` : "—"}</Field>
            <Field label="Start">{date(b.start_date)}</Field>
            <Field label="End">{date(b.end_date)}</Field>
          </dl>
        </div>
      )
    case "bid_submission":
      return (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <OutcomeBadge status={b.outcome_status} />
            {b.win_loss_reasons?.map((r: string) => <Badge key={r} variant="outline">{r}</Badge>)}
            {b.tender_number && <span className="text-xs text-muted-foreground">Tender {b.tender_number} · submitted {date(b.submitted_date)}</span>}
          </div>
          <Section title="Executive summary">{b.executive_summary}</Section>
          {b.methodology?.length > 0 && (
            <Section title="Methodology">
              <ol className="space-y-2">
                {b.methodology.map((m: string, i: number) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
          {b.client_responses?.length > 0 && (
            <Section title="Client responses">
              <div className="space-y-3">
                {b.client_responses.map((r: { question: string; answer: string }, i: number) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="font-medium">Q: {r.question}</div>
                    <div className="mt-1 text-muted-foreground">{r.answer}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {b.lessons_learned?.length > 0 && (
            <Section title="Lessons learned">
              <div className={cn("rounded-lg border p-3", b.outcome_status === "won" ? "border-success/50 bg-success/10" : "border-destructive/20 bg-destructive/5")}>
                <List items={b.lessons_learned} />
              </div>
            </Section>
          )}
        </div>
      )
    case "template":
      return (
        <div className="space-y-6">
          <Section title="About this template">{b.description}</Section>
          {b.sections && <Section title="Sections"><List items={b.sections} /></Section>}
        </div>
      )
    case "good_news_story":
      return (
        <div className="space-y-6">
          <Section title="Story">{b.story}</Section>
          {b.highlights && <Section title="Highlights"><List items={b.highlights} /></Section>}
        </div>
      )
    case "capability_statement":
      return (
        <div className="space-y-6">
          <Section title="Statement">{b.statement}</Section>
          {b.capabilities?.length > 0 && <Section title="Capabilities"><List items={b.capabilities} /></Section>}
        </div>
      )
    case "image":
      return (
        <div className="space-y-3">
          <PhotoPlaceholder seed={b.photo_seed} type="image" className="h-64 rounded-xl" />
          <p className="text-sm text-muted-foreground">{b.caption} · Photo: {b.photographer}</p>
        </div>
      )
    default:
      return <pre className="text-xs">{JSON.stringify(b, null, 2)}</pre>
  }
}

/** Sector admin (and Enterprise Admin) controls: change who can see the item, or archive it for everyone. */
function AdminActions({ item }: { item: ContentDetail }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [visOpen, setVisOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [vis, setVis] = useState<VisibilityValue>({ visibility: item.visibility, shares: item.shares })
  const [error, setError] = useState<string>()

  const changeVisibility = useMutation({
    mutationFn: () => api.post<{ visibility: string }>(`/content/${item.id}/visibility`, vis),
    onSuccess: (r) => {
      toast.success("Visibility updated", { description: VISIBILITY_LABELS[r.visibility] })
      setVisOpen(false)
      queryClient.invalidateQueries()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) setError(e.fields.shares ?? e.fields.visibility)
      else toast.error(e.message)
    },
  })
  const archive = useMutation({
    mutationFn: () => api.post(`/content/${item.id}/archive`),
    onSuccess: () => {
      toast.success("Content archived", { description: "Restore it from Governance → Archived." })
      queryClient.invalidateQueries()
      navigate("/governance")
    },
    onError: (e) => toast.error(e.message),
  })

  function openVisibility() {
    setVis({ visibility: item.visibility, shares: item.shares })
    setError(undefined)
    setVisOpen(true)
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Administrator</div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={openVisibility}><Share2 className="size-4" /> Visibility</Button>
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setArchiveOpen(true)}>
          <Archive className="size-4" /> Archive
        </Button>
      </div>

      <Dialog open={visOpen} onOpenChange={setVisOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Change visibility</DialogTitle>
            <DialogDescription>Choose who can find and open this {TYPE_LABELS[item.type].toLowerCase()} outside {item.sector}.</DialogDescription>
          </DialogHeader>
          <VisibilityPicker value={vis} onChange={(v) => { setVis(v); setError(undefined) }} sector={item.sector} error={error} />
          {item.restricted_flags.length > 0 && (
            <p className="rounded-lg border border-warning bg-warning/20 p-3 text-sm">
              This item has restricted content, so it stays visible to {item.sector} only, whatever you choose here.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisOpen(false)}>Cancel</Button>
            <Button onClick={() => changeVisibility.mutate()} disabled={changeVisibility.isPending}>Save visibility</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this content?</DialogTitle>
            <DialogDescription>
              "{item.title}" will be hidden from everyone, in every sector: search, the library, related content and its files.
              You can restore it later from Governance → Archived.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => archive.mutate()} disabled={archive.isPending}><Archive className="size-4" /> Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ContentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: item, isLoading, error } = useQuery({ queryKey: ["content", id], queryFn: () => api.get<ContentDetail>(`/content/${id}`) })

  const approve = useMutation({
    mutationFn: (decision: "approve" | "reject") => api.post<{ notification: string; approval_status: string }>(`/content/${id}/approve`, { decision }),
    onSuccess: (r) => {
      toast.success(`Content ${r.approval_status}`, { description: r.notification })
      queryClient.invalidateQueries()
    },
    onError: (e) => toast.error(e.message),
  })
  const review = useMutation({
    mutationFn: () => api.post<{ review_date: string }>(`/content/${id}/review`),
    onSuccess: (r) => {
      toast.success("Review recorded", { description: `Next review due ${date(r.review_date)}` })
      queryClient.invalidateQueries()
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) return <Skeleton className="h-[70vh] rounded-xl" />
  if (error || !item)
    return (
      <EmptyState icon={Lock} title={error instanceof ApiError && error.status === 404 ? "Not found or you do not have access" : "Could not load content"}>
        This item may be restricted to another sector. Switch persona or ask the sector content owner for access.
      </EmptyState>
    )

  const reviewDays = daysFromToday(item.review_date)
  const expired = (daysFromToday(item.expiry_date) ?? 1) < 0
  const hasMedia = item.type === "case_study" || item.type === "project_profile"
  const hero = item.attachments.find((a) => a.role === "hero")

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="size-4" /> Back
      </Button>

      {item.approval_status !== "approved" && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning bg-warning/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <b>{item.approval_status === "pending" ? "Awaiting sector approval." : "This submission was rejected."}</b>{" "}
            Only {item.sector} can see this item until it is approved.
          </div>
          {item.permissions.can_approve && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => approve.mutate("approve")} disabled={approve.isPending}><ThumbsUp className="size-4" /> Approve</Button>
              <Button size="sm" variant="outline" onClick={() => approve.mutate("reject")} disabled={approve.isPending}><ThumbsDown className="size-4" /> Reject</Button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        {hasMedia && <HeroBanner heroId={hero?.id} seed={item.body?.photo_seed ?? item.title.length} type={item.type} className="h-48 sm:h-72" />}
        <div className="p-5 sm:p-8">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <TypeBadge type={item.type} />
            <SectorBadge sector={item.sector} short={false} />
            <VisibilityBadge visibility={item.visibility} restricted={item.is_restricted} />
            <ApprovalBadge status={item.approval_status} />
            <SourceBadge
              source={item.data_source}
              tip={item.data_source === "synthetic" && item.opportunity?.source === "salesforce"
                ? "The narrative is generated for the demo. The metadata comes from a real Salesforce record."
                : undefined}
            />
          </div>
          <h1 className="text-2xl font-semibold text-primary sm:text-3xl">{item.title}</h1>
          {item.summary && <p className="mt-2 max-w-3xl text-muted-foreground">{item.summary}</p>}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {item.client && <span className="inline-flex items-center gap-1.5"><Briefcase className="size-4" />{item.client}</span>}
            {item.geography && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" />{item.geography}</span>}
            {item.contract_value ? <span className="font-medium text-foreground">{money(item.contract_value)}</span> : null}
            {item.owner && <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" />Owner: {item.owner}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <Body item={item} />
            </CardContent>
          </Card>
          {hasMedia && (
            <Card>
              <CardContent className="pt-6">
                {/* The shareable build has no file storage, so it never offers uploads. */}
                <MediaPanel contentId={item.id} attachments={item.attachments} canEdit={item.permissions.can_edit && !import.meta.env.VITE_SHARE_DATA} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Governance</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Review date</span>
                <span className={cn("font-medium", reviewDays !== null && reviewDays < 0 && "text-destructive")}>
                  {date(item.review_date)} <span className="block text-right text-xs font-normal text-muted-foreground">{relativeDays(item.review_date)}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expiry date</span>
                <span className={cn("font-medium", expired && "text-destructive")}>{date(item.expiry_date)}{expired && " (expired)"}</span>
              </div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">v{item.version}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Confidentiality</span><span className="font-medium">{item.confidentiality}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Approval</span><span className="font-medium capitalize">{item.approval_status}</span></div>
              {item.restricted_flags.length > 0 && (
                <div>
                  <div className="mb-1 text-muted-foreground">Restricted content</div>
                  <FlagBadges flags={item.restricted_flags} />
                </div>
              )}
              {item.visibility === "shared" && (
                <div>
                  <div className="mb-1 text-muted-foreground">Shared with</div>
                  <div className="flex flex-wrap gap-1">{item.shares.map((s) => <SectorBadge key={s} sector={s} />)}</div>
                </div>
              )}
              {(item.permissions.can_approve || item.permissions.can_edit) && reviewDays !== null && reviewDays <= 30 && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => review.mutate()} disabled={review.isPending}>
                  <CalendarCheck className="size-4" /> Mark as reviewed
                </Button>
              )}
              {item.permissions.can_approve && <AdminActions item={item} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Metadata</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Sector" className="col-span-2">{item.sector}</Field>
                <Field label="Business unit" className="col-span-2">{item.business_unit ?? <span className="text-destructive">Missing</span>}</Field>
                <Field label="Service line" className="col-span-2">{item.service_line ?? <span className="text-destructive">Missing</span>}</Field>
                <Field label="Value range">{item.contract_value_range ?? "—"}</Field>
                <Field label="Geography">{item.geography ?? <span className="text-destructive">Missing</span>}</Field>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Who to talk to</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {item.contacts.length === 0 && <p className="text-sm text-muted-foreground">No linked contacts.</p>}
              {item.contacts.map((c) => (
                <Link key={`${c.id}-${c.role}`} to={`/contacts/${c.id}`} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-muted">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
                    {c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.role} · {c.title}</div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          {item.opportunity && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Source Salesforce opportunity</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Link to={`/opportunities/${item.opportunity.id}`} className="font-medium text-primary hover:underline">{item.opportunity.name}</Link>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{item.opportunity.stage}</Badge>
                  {item.opportunity.brs_number && <Badge variant="outline">BRS {item.opportunity.brs_number}</Badge>}
                  <SourceBadge source={item.opportunity.source} />
                </div>
                <div className="text-muted-foreground">TCV {money(item.opportunity.tcv)} · closed {date(item.opportunity.close_date)}</div>
                {item.opportunity.teamsite && (
                  <a href="#" onClick={(e) => { e.preventDefault(); toast.info("SharePoint is simulated in this demo", { description: item.opportunity!.teamsite! }) }} className="inline-flex items-center gap-1 text-brand-mid hover:underline">
                    <ExternalLink className="size-3.5" /> SharePoint teamsite {item.opportunity.teamsite}
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {item.related.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Related content</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {item.related.map((r) => (
                  <Link key={r.id} to={`/content/${r.id}`} className="flex items-start gap-2 rounded-md p-1.5 text-sm hover:bg-muted">
                    <TypeIcon type={r.type} className="mt-0.5 size-4 shrink-0 text-brand-mid" />
                    <span><span className="line-clamp-2">{r.title}</span><span className="text-xs text-muted-foreground">{TYPE_LABELS[r.type]}</span></span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><History className="size-4" /> Version history</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {item.versions.map((v, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={i === 0 ? "default" : "outline"}>v{v.version}</Badge>
                      <span className="text-xs text-muted-foreground">{date(v.changed_at)}</span>
                    </div>
                    <div className="mt-0.5 text-muted-foreground">{v.summary} · {v.changed_by}</div>
                  </li>
                ))}
              </ol>
              <Separator className="my-3" />
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {expired ? <XCircle className="size-3.5 text-destructive" /> : <CheckCircle2 className="size-3.5 text-brand-mid" />}
                {expired ? "Expired content: verify before reuse" : "Current: safe to reuse within visibility rules"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
