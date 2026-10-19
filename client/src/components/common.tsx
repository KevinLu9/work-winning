import type { ReactNode } from "react"
import {
  Archive,
  Award,
  Briefcase,
  Building2,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  Database,
  FileStack,
  FileText,
  FlaskConical,
  Globe2,
  Image as ImageIcon,
  LayoutTemplate,
  Lock,
  Megaphone,
  ShieldCheck,
  Share2,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { FLAG_LABELS, SECTOR_SHORT, TYPE_LABELS, VISIBILITY_LABELS } from "@/lib/format"
import type { ApprovalStatus, DataSource, OutcomeStatus, Visibility } from "@/lib/types"

export const TYPE_ICONS: Record<string, LucideIcon> = {
  case_study: Award,
  project_profile: Building2,
  bid_submission: FileStack,
  template: LayoutTemplate,
  good_news_story: Megaphone,
  capability_statement: ShieldCheck,
  image: ImageIcon,
  opportunity: Briefcase,
  contact: UserRound,
}

export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = TYPE_ICONS[type] ?? FileText
  return <Icon className={className} aria-hidden />
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="secondary" className="gap-1 font-medium">
      <TypeIcon type={type} className="size-3" />
      {TYPE_LABELS[type] ?? type}
    </Badge>
  )
}

const VIS_STYLE: Record<Visibility, { icon: LucideIcon; cls: string; tip: string }> = {
  sector_only: { icon: Lock, cls: "bg-amber-50 text-amber-900 border-amber-200", tip: "Visible only to the originating sector" },
  shared: { icon: Share2, cls: "bg-sky-50 text-sky-900 border-sky-200", tip: "Shared with approved sectors" },
  enterprise: { icon: Globe2, cls: "bg-emerald-50 text-emerald-900 border-emerald-200", tip: "Visible organisation-wide" },
}

export function VisibilityBadge({ visibility, restricted }: { visibility: Visibility; restricted?: boolean | number }) {
  const v = VIS_STYLE[visibility]
  const Icon = v.icon
  return (
    <span className="inline-flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("gap-1", v.cls)}>
            <Icon className="size-3" />
            {VISIBILITY_LABELS[visibility]}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{v.tip}</TooltipContent>
      </Tooltip>
      {restricted ? (
        <Badge variant="outline" className="gap-1 border-destructive/30 bg-destructive/5 text-destructive">
          <Lock className="size-3" /> Restricted
        </Badge>
      ) : null}
    </span>
  )
}

export function FlagBadges({ flags }: { flags: string[] }) {
  if (!flags?.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge key={f} variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive">
          {FLAG_LABELS[f] ?? f}
        </Badge>
      ))}
    </div>
  )
}

const SOURCE_STYLE: Record<DataSource, { icon: LucideIcon; label: string; cls: string; tip: string }> = {
  salesforce: {
    icon: Database,
    label: "Salesforce export",
    cls: "border-primary/30 bg-primary/10 text-primary",
    tip: "Real record from salesforce_synthetic_cut.xlsx",
  },
  synthetic: {
    icon: FlaskConical,
    label: "Synthetic",
    cls: "border-dashed border-muted-foreground/40 bg-muted text-muted-foreground",
    tip: "Generated for the demo. Only Salesforce columns populated in the export are filled.",
  },
  user: {
    icon: UserRound,
    label: "User submitted",
    cls: "border-sky-200 bg-sky-50 text-sky-900",
    tip: "Submitted through this app",
  },
  public: {
    icon: Globe2,
    label: "Ventia website",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-900",
    tip: "Written from a project page published on ventia.com",
  },
}

/** Where a record came from: the real Salesforce export, demo generation, a user submission, or ventia.com. */
export function SourceBadge({ source, tip }: { source: DataSource | null | undefined; tip?: string }) {
  if (!source) return null
  const s = SOURCE_STYLE[source]
  const Icon = s.icon
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("gap-1", s.cls)}>
          <Icon className="size-3" />
          {s.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip ?? s.tip}</TooltipContent>
    </Tooltip>
  )
}

export function SectorBadge({ sector, short = true }: { sector: string | null | undefined; short?: boolean }) {
  if (!sector) return null
  return (
    <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
      {short ? SECTOR_SHORT[sector] ?? sector : sector}
    </Badge>
  )
}

export function OutcomeBadge({ status }: { status: OutcomeStatus | null | undefined }) {
  if (!status) return null
  const map = {
    won: { icon: CircleCheck, cls: "bg-success/25 text-primary border-success/50", label: "Won" },
    lost: { icon: CircleX, cls: "bg-destructive/10 text-destructive border-destructive/30", label: "Lost" },
    open: { icon: CircleDot, cls: "bg-brand-mid/10 text-brand-mid border-brand-mid/30", label: "Open" },
  }[status]
  const Icon = map.icon
  return (
    <Badge variant="outline" className={cn("gap-1", map.cls)}>
      <Icon className="size-3" />
      {map.label}
    </Badge>
  )
}

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  if (status === "approved") return null
  if (status === "archived")
    return <Badge variant="outline" className="gap-1 border-muted-foreground/30 bg-muted text-muted-foreground"><Archive className="size-3" />Archived</Badge>
  return (
    <Badge variant="outline" className={cn("gap-1", status === "pending" ? "border-warning bg-warning/30 text-foreground" : "border-destructive/30 text-destructive")}>
      <Clock className="size-3" />
      {status === "pending" ? "Pending approval" : "Rejected"}
    </Badge>
  )
}

/** Renders FTS snippets where matches are wrapped in [[ ]] markers. */
export function Snippet({ text }: { text: string | null | undefined }) {
  if (!text) return null
  const parts = text.split(/(\[\[.*?\]\])/g)
  return (
    <>
      {parts.map((p, i) => (p.startsWith("[[") ? <mark key={i}>{p.slice(2, -2)}</mark> : <span key={i}>{p}</span>))}
    </>
  )
}

/** Highlights search terms (prefix match) in plain text such as titles. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const re = new RegExp(`\\b(${escaped.join("|")})\\w*`, "gi")
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index))
    out.push(<mark key={m.index}>{m[0]}</mark>)
    last = (m.index ?? 0) + m[0].length
  }
  out.push(text.slice(last))
  return <>{out}</>
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-mid">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold text-primary sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {Icon && <Icon className="size-4 text-brand-mid" />}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-primary">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon = FileText, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <Icon className="mb-3 size-8 text-muted-foreground" />
      <div className="font-medium">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

/** Deterministic branded placeholder for project photography (no external image hosting). */
export function PhotoPlaceholder({ seed = 1, type = "image", className }: { seed?: number; type?: string; className?: string }) {
  const palettes = [
    ["#004825", "#00994d"],
    ["#00994d", "#a0cd60"],
    ["#004825", "#671c32"],
    ["#0b5a33", "#a0cd60"],
  ]
  const [a, b] = palettes[seed % palettes.length]
  const angle = (seed * 37) % 360
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{ background: `linear-gradient(${angle}deg, ${a}, ${b})` }}
      aria-hidden
    >
      <svg className="absolute inset-0 h-full w-full opacity-15" viewBox="0 0 200 100" preserveAspectRatio="none">
        <path d={`M0 ${70 + (seed % 20)} L40 ${40 + (seed % 30)} L80 ${60 + (seed % 15)} L130 ${30 + (seed % 25)} L200 ${55 + (seed % 20)} L200 100 L0 100Z`} fill="white" />
      </svg>
      <TypeIcon type={type} className="relative size-10 text-white/80" />
    </div>
  )
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children ?? "—"}</dd>
    </div>
  )
}
