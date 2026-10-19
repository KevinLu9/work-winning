import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, BookOpen, Briefcase, CalendarClock, Search, Sparkles, Trophy, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ContentCard } from "@/components/cards"
import { EmptyState, StatCard } from "@/components/common"
import { api } from "@/lib/api"
import { money, TYPE_LABELS } from "@/lib/format"
import { usePersona } from "@/lib/persona"
import type { Stats } from "@/lib/types"

const EXAMPLES = [
  "water treatment projects in VIC",
  "case studies in QLD over $5m",
  "who has worked with Optus",
  "completed road maintenance in New Zealand",
  "NBN bid submissions",
  "hospital facilities management",
]

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = usePersona()
  const [q, setQ] = useState("")
  const { data: stats, isLoading } = useQuery({ queryKey: ["stats"], queryFn: () => api.get<Stats>("/stats") })

  function go(query: string) {
    navigate(`/search?q=${encodeURIComponent(query)}`)
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    go(q)
  }

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 sm:py-14">
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-brand-mid/40 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-success/20 blur-3xl" aria-hidden />
        <div className="relative max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
            <Sparkles className="size-3.5 text-success" /> Search first. One source of truth for work-winning.
          </div>
          <h1 className="text-3xl font-semibold text-white sm:text-5xl">
            Find experience, content and experts in minutes, not days.
          </h1>
          <p className="mt-3 text-white/80">
            Welcome{user ? `, ${user.name.split(" ")[0]}` : ""}. Search across case studies, project profiles, past submissions,
            Salesforce opportunities and people across all five sectors.
          </p>
          <form onSubmit={submit} className="mt-6 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder='Try "water treatment projects completed in local government"'
                className="h-12 border-none bg-white pl-11 text-base text-foreground shadow-lg"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 bg-success px-6 text-primary hover:bg-success/90">
              Search
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => go(ex)}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/90 transition hover:bg-white/15"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Reusable content" value={stats.content_total} hint={`${stats.content_by_type.case_study ?? 0} case studies · ${stats.content_by_type.project_profile ?? 0} profiles`} icon={BookOpen} />
            <StatCard label="Won contract value" value={money(stats.won_tcv)} hint={`${stats.won} won · ${stats.lost} lost`} icon={Trophy} />
            <StatCard label="Open pipeline" value={money(stats.pipeline_tcv)} hint={`${stats.open} live opportunities`} icon={Briefcase} />
            <StatCard
              label="Due for review"
              value={stats.due_for_review}
              hint={<Link to="/governance" className="text-brand-mid hover:underline">In your sector →</Link>}
              icon={CalendarClock}
            />
          </>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold text-primary">Recently updated</h2>
            <p className="text-sm text-muted-foreground">Approved content visible to you</p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/library">
              Browse library <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {stats && stats.recent.length === 0 ? (
          <EmptyState icon={BookOpen} title="No content yet">
            Only the Salesforce export is loaded. <Link to="/submit" className="text-brand-mid hover:underline">Submit the first case study</Link>,
            or run <code>npm run seed:synthetic</code> to load demo content.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats?.recent.map((c) => <ContentCard key={c.id} c={c} />) ??
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold text-primary">Sectors</h2>
        <p className="mb-4 text-sm text-muted-foreground">Sector ownership with enterprise discoverability</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stats?.sectors.map((s) => (
            <Link
              key={s.name}
              to={`/search?sector=${encodeURIComponent(s.name)}`}
              className="group rounded-xl border bg-card p-4 shadow-xs transition hover:border-brand-mid/50 hover:shadow-md"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-mid">{s.short_name}</div>
              <div className="mt-1 font-serif font-semibold group-hover:text-primary">{s.name}</div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
              <div className="mt-3 flex justify-between text-xs">
                <span><b className="tabular-nums">{s.content_count}</b> items</span>
                <span><b className="tabular-nums">{money(s.won_tcv)}</b> won</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { to: "/contacts", icon: Users, title: "Find an expert", body: "Bid, commercial, technical and operational specialists drawn from Salesforce pursuit teams." },
          { to: "/submit", icon: BookOpen, title: "Share a win", body: `Submit a ${TYPE_LABELS.case_study.toLowerCase()} or project profile. It is sector-only until you choose otherwise.` },
          { to: "/opportunities", icon: Briefcase, title: "Explore the pipeline", body: "Every Salesforce field for every opportunity you can see, grouped and labelled." },
        ].map(({ to, icon: Icon, title, body }) => (
          <Link key={to} to={to} className="flex gap-3 rounded-xl border bg-secondary/60 p-4 transition hover:bg-secondary">
            <Icon className="mt-0.5 size-5 shrink-0 text-brand-mid" />
            <div>
              <div className="font-semibold text-primary">{title}</div>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
