import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Globe2, Info, Link2, Lock, Send, Share2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader, TypeIcon } from "@/components/common"
import { api, ApiError, qs } from "@/lib/api"
import { FLAG_LABELS, TYPE_LABELS, VISIBILITY_LABELS } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useMeta, usePersona } from "@/lib/persona"
import type { OpportunityRow, Option, Visibility } from "@/lib/types"

const STEPS = ["Type", "Metadata", "Content", "Visibility", "Review"]
const UPLOAD_TYPES = ["case_study", "project_profile", "bid_submission", "image", "good_news_story", "template", "capability_statement"]

type BodyField = { key: string; label: string; kind: "text" | "textarea" | "lines" | "number"; placeholder?: string }
const BODY_FIELDS: Record<string, BodyField[]> = {
  case_study: [
    { key: "challenge", label: "Client challenge", kind: "textarea" },
    { key: "solution", label: "Our solution", kind: "textarea" },
    { key: "outcomes", label: "Outcomes (one per line)", kind: "lines", placeholder: "Zero lost-time injuries over 1.2 million hours" },
  ],
  project_profile: [
    { key: "description", label: "Project description", kind: "textarea" },
    { key: "services_delivered", label: "Services delivered (one per line)", kind: "lines" },
    { key: "duration_months", label: "Duration (months)", kind: "number" },
  ],
  bid_submission: [
    { key: "executive_summary", label: "Executive summary", kind: "textarea" },
    { key: "methodology", label: "Methodology steps (one per line)", kind: "lines" },
    { key: "lessons_learned", label: "Lessons learned (one per line)", kind: "lines" },
  ],
  image: [{ key: "caption", label: "Caption", kind: "text" }, { key: "photographer", label: "Photographer / source", kind: "text" }],
  good_news_story: [{ key: "story", label: "Story", kind: "textarea" }],
  template: [{ key: "description", label: "What is this template for?", kind: "textarea" }],
  capability_statement: [{ key: "statement", label: "Capability statement", kind: "textarea" }, { key: "capabilities", label: "Capabilities (one per line)", kind: "lines" }],
}

interface FormState {
  type: string
  title: string
  summary: string
  sector: string
  business_unit: string
  service_line: string
  contract_value_range: string
  client: string
  geography: string
  confidentiality: string
  owner: string
  review_date: string
  source_opportunity_id: string
  body: Record<string, string>
  visibility: Visibility
  shares: string[]
  restricted_flags: string[]
}

function addMonths(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function bucket(v: number | null) {
  if (!v) return ""
  if (v < 1e6) return "<$1m"
  if (v < 1e7) return "$1–10m"
  if (v < 5e7) return "$10–50m"
  if (v < 1e8) return "$50–100m"
  return ">$100m"
}

function FormField({ label, required, error, children, className }: { label: string; required?: boolean; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className={cn(error && "text-destructive")}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function Choice({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function TypeInfo({ type }: { type: Option }) {
  return (
    <div className="space-y-3 text-sm">
      <p>{type.description}</p>
      {type.use_when && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Use it when</div>
          <p className="mt-0.5">{type.use_when}</p>
        </div>
      )}
      {type.includes && type.includes.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You'll be asked for</div>
          <ul className="mt-1 space-y-1">
            {type.includes.map((x) => (
              <li key={x} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-mid" />
                {x}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Reviewed every {type.review_months} months.</p>
    </div>
  )
}

export default function SubmitPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: meta } = useMeta()
  const { user } = usePersona()
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<FormState>({
    type: "", title: "", summary: "", sector: "", business_unit: "", service_line: "", contract_value_range: "", client: "",
    geography: "", confidentiality: "Internal", owner: "", review_date: "", source_opportunity_id: "", body: {},
    visibility: "sector_only", shares: [], restricted_flags: [],
  })
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, sector: f.sector && user.role === "enterprise_admin" ? f.sector : user.sector, owner: f.owner || user.name }))
  }, [user])

  const sector = meta?.sectors.find((s) => s.name === form.sector)
  const selectedType = meta?.content_types.find((c) => c.value === form.type)
  const { data: opps } = useQuery({
    queryKey: ["submit-opps", form.sector],
    queryFn: () => api.get<{ items: OpportunityRow[] }>(`/opportunities${qs({ sector: form.sector, page_size: 200, sort: "name", dir: "asc" })}`),
    enabled: !!form.sector,
  })
  const { data: similar } = useQuery({
    queryKey: ["similar", form.title],
    queryFn: () => api.get<{ entity_id: string; doc_type: string; title: string; sector: string }[]>(`/content/similar${qs({ title: form.title })}`),
    enabled: step === 4 && form.title.length > 3,
  })

  function chooseType(t: string) {
    const months = meta?.content_types.find((c) => c.value === t)?.review_months ?? 12
    setForm((f) => ({ ...f, type: t, review_date: addMonths(months), body: {} }))
  }

  function linkOpportunity(id: string) {
    const o = opps?.items.find((x) => x.id === id)
    if (!o) return set("source_opportunity_id", "")
    setForm((f) => ({
      ...f,
      source_opportunity_id: id,
      title: f.title || o.name,
      business_unit: o.business_unit ?? f.business_unit,
      service_line: o.service_line ?? f.service_line,
      client: o.client ?? f.client,
      geography: o.region ?? f.geography,
      contract_value_range: bucket(o.tcv) || f.contract_value_range,
    }))
    toast.success("Metadata pre-filled from Salesforce")
  }

  const stepErrors = useMemo(() => {
    const e: Record<string, string> = {}
    if (step === 0 && !form.type) e.type = "Choose a content type"
    if (step === 1) {
      for (const k of ["title", "sector", "business_unit", "service_line", "contract_value_range", "client", "geography", "confidentiality", "owner", "review_date"] as const)
        if (!String(form[k]).trim()) e[k] = "Required"
    }
    if (step === 3 && form.visibility === "shared" && form.shares.length === 0) e.shares = "Select at least one sector"
    return e
  }, [step, form])

  function next() {
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length === 0) setStep((s) => s + 1)
  }

  const submit = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {}
      for (const f of BODY_FIELDS[form.type] ?? []) {
        const v = form.body[f.key]
        if (!v) continue
        body[f.key] = f.kind === "lines" ? v.split("\n").map((s) => s.trim()).filter(Boolean) : f.kind === "number" ? Number(v) : v
      }
      return api.post<{ id: string }>("/content", { ...form, body, source_opportunity_id: form.source_opportunity_id || null })
    },
    onSuccess: (r) => {
      toast.success("Submitted for approval", { description: `Your ${form.sector} sector administrator has been notified (simulated Teams).` })
      queryClient.invalidateQueries()
      navigate(`/content/${r.id}`)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) {
        setErrors(e.fields)
        setStep(1)
      }
      toast.error(e.message)
    },
  })

  if (!meta || !user) return null
  const canPickSector = user.role === "enterprise_admin"

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Content submission"
        title="Share work-winning content"
        description="Capture knowledge once and reuse it many times. New content is confidential by default: visible only to your sector until you choose to share it, and it goes to your sector administrator for approval."
      />

      <ol className="mb-6 grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:text-left">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
              i < step ? "border-brand-mid bg-brand-mid text-white" : i === step ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>
              {i < step ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={cn("text-xs font-medium sm:text-sm", i === step ? "text-primary" : "text-muted-foreground")}>{s}</span>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="space-y-6 pt-6">
          {step === 0 && (
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                {UPLOAD_TYPES.map((t) => {
                  const m = meta.content_types.find((c) => c.value === t)
                  return (
                    <div key={t} className={cn("relative rounded-xl border transition hover:border-brand-mid/60",
                      form.type === t && "border-primary bg-secondary ring-2 ring-primary/20")}>
                      <button onClick={() => chooseType(t)} className="flex w-full items-start gap-3 p-4 pr-12 text-left">
                        <TypeIcon type={t} className="mt-0.5 size-5 shrink-0 text-brand-mid" />
                        <div>
                          <div className="font-semibold">{TYPE_LABELS[t]}</div>
                          <div className="line-clamp-2 text-xs text-muted-foreground">{m?.description}</div>
                        </div>
                      </button>
                      {m && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 size-8 text-muted-foreground"
                              aria-label={`What is a ${TYPE_LABELS[t].toLowerCase()}?`}>
                              <Info className="size-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-80">
                            <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
                              <TypeIcon type={t} className="size-4" /> {TYPE_LABELS[t]}
                            </div>
                            <TypeInfo type={m} />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  )
                })}
              </div>
              {selectedType && (
                <div className="mt-4 rounded-xl border border-success/50 bg-success/10 p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
                    <TypeIcon type={selectedType.value} className="size-4" /> About {TYPE_LABELS[selectedType.value].toLowerCase()}s
                  </div>
                  <TypeInfo type={selectedType} />
                </div>
              )}
              {errors.type && <p className="mt-2 text-sm text-destructive">{errors.type}</p>}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-dashed bg-muted/40 p-4">
                <FormField label="Link to a Salesforce opportunity (optional, pre-fills metadata)">
                  <Select value={form.source_opportunity_id || undefined} onValueChange={linkOpportunity}>
                    <SelectTrigger className="w-full"><Link2 className="size-4" /><SelectValue placeholder="Choose an opportunity from your sector" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {opps?.items.map((o) => <SelectItem key={o.id} value={o.id}>{o.name} · {o.stage}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label="Title" required error={errors.title}>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. SEQ Water treatment plant O&M - outcomes" />
              </FormField>
              <FormField label="Summary">
                <Textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} rows={2} placeholder="One or two sentences shown in search results" />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Sector" required error={errors.sector}>
                  {canPickSector ? (
                    <Choice value={form.sector} onChange={(v) => setForm((f) => ({ ...f, sector: v, business_unit: "", service_line: "", source_opportunity_id: "" }))} options={meta.sectors.map((s) => s.name)} placeholder="Sector" />
                  ) : (
                    <Input value={form.sector} disabled />
                  )}
                </FormField>
                <FormField label="Business unit" required error={errors.business_unit}>
                  <Choice value={form.business_unit} onChange={(v) => set("business_unit", v)} options={sector?.business_units ?? []} placeholder="Business unit" />
                </FormField>
                <FormField label="Service line" required error={errors.service_line}>
                  <Choice value={form.service_line} onChange={(v) => set("service_line", v)} options={sector?.service_lines ?? []} placeholder="Service line" />
                </FormField>
                <FormField label="Contract value range" required error={errors.contract_value_range}>
                  <Choice value={form.contract_value_range} onChange={(v) => set("contract_value_range", v)} options={meta.value_ranges} placeholder="Value range" />
                </FormField>
                <FormField label="Client" required error={errors.client}>
                  <Choice value={form.client} onChange={(v) => set("client", v)} options={["Various clients", ...meta.clients]} placeholder="Client" />
                </FormField>
                <FormField label="Geography" required error={errors.geography}>
                  <Select value={form.geography || undefined} onValueChange={(v) => set("geography", v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Region" /></SelectTrigger>
                    <SelectContent>{meta.regions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label="Confidentiality level" required error={errors.confidentiality}>
                  <Choice value={form.confidentiality} onChange={(v) => set("confidentiality", v)} options={meta.confidentiality} placeholder="Confidentiality" />
                </FormField>
                <FormField label="Content owner" required error={errors.owner}>
                  <Input value={form.owner} onChange={(e) => set("owner", e.target.value)} />
                </FormField>
                <FormField label="Review date" required error={errors.review_date}>
                  <Input type="date" value={form.review_date} onChange={(e) => set("review_date", e.target.value)} />
                  <p className="text-xs text-muted-foreground">Suggested from the {TYPE_LABELS[form.type]?.toLowerCase()} review cycle</p>
                </FormField>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {(BODY_FIELDS[form.type] ?? []).map((f) => (
                <FormField key={f.key} label={f.label}>
                  {f.kind === "textarea" || f.kind === "lines" ? (
                    <Textarea rows={f.kind === "lines" ? 4 : 5} value={form.body[f.key] ?? ""} placeholder={f.placeholder}
                      onChange={(e) => set("body", { ...form.body, [f.key]: e.target.value })} />
                  ) : (
                    <Input type={f.kind === "number" ? "number" : "text"} value={form.body[f.key] ?? ""}
                      onChange={(e) => set("body", { ...form.body, [f.key]: e.target.value })} />
                  )}
                </FormField>
              ))}
              <p className="text-xs text-muted-foreground">Document upload goes to the sector SharePoint library (simulated in this demo).</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <RadioGroup value={form.visibility} onValueChange={(v) => set("visibility", v as Visibility)} className="gap-3">
                {meta.visibility.map((v) => {
                  const Icon = v.value === "sector_only" ? Lock : v.value === "shared" ? Share2 : Globe2
                  return (
                    <Label key={v.value} htmlFor={`vis-${v.value}`}
                      className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal", form.visibility === v.value && "border-primary bg-secondary")}>
                      <RadioGroupItem id={`vis-${v.value}`} value={v.value} className="mt-1" />
                      <Icon className="mt-0.5 size-5 text-brand-mid" />
                      <div>
                        <div className="font-semibold">{v.label}{v.value === "sector_only" && <span className="ml-2 text-xs font-normal text-muted-foreground">(default)</span>}</div>
                        <div className="text-sm text-muted-foreground">{v.description}</div>
                      </div>
                    </Label>
                  )
                })}
              </RadioGroup>
              {form.visibility === "shared" && (
                <FormField label="Share with sectors" required error={errors.shares}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {meta.sectors.filter((s) => s.name !== form.sector).map((s) => (
                      <label key={s.name} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={form.shares.includes(s.name)}
                          onCheckedChange={(c) => set("shares", c ? [...form.shares, s.name] : form.shares.filter((x) => x !== s.name))} />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </FormField>
              )}
              <div>
                <Label>Restricted content</Label>
                <p className="mb-2 text-xs text-muted-foreground">Restricted content is only visible to your sector, whatever visibility you choose above.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {meta.restricted_flags.map((f) => (
                    <label key={f.value} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.restricted_flags.includes(f.value)}
                        onCheckedChange={(c) => set("restricted_flags", c ? [...form.restricted_flags, f.value] : form.restricted_flags.filter((x) => x !== f.value))} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {[
                  ["Type", TYPE_LABELS[form.type]], ["Title", form.title], ["Sector", form.sector], ["Business unit", form.business_unit],
                  ["Service line", form.service_line], ["Value range", form.contract_value_range], ["Client", form.client], ["Geography", form.geography],
                  ["Confidentiality", form.confidentiality], ["Owner", form.owner], ["Review date", form.review_date],
                  ["Visibility", VISIBILITY_LABELS[form.visibility] + (form.visibility === "shared" ? ` → ${form.shares.join(", ")}` : "")],
                  ["Restrictions", form.restricted_flags.map((f) => FLAG_LABELS[f]).join(", ") || "None"],
                ].map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                ))}
              </dl>
              {similar && similar.length > 0 && (
                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Similar content already exists. Is this a duplicate?</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 space-y-1">
                      {similar.map((s) => (
                        <li key={s.entity_id}>
                          <a href={`/content/${s.entity_id}`} target="_blank" rel="noreferrer" className="text-brand-mid hover:underline">{s.title}</a>{" "}
                          <span className="text-xs">({TYPE_LABELS[s.doc_type]}, {s.sector})</span>
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}><ChevronLeft className="size-4" /> Back</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>Next <ChevronRight className="size-4" /></Button>
            ) : (
              <Button onClick={() => submit.mutate()} disabled={submit.isPending}><Send className="size-4" /> Submit for approval</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
