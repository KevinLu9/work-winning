import { useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { BookOpen, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContentCard } from "@/components/cards"
import { EmptyState, PageHeader } from "@/components/common"
import { api, qs } from "@/lib/api"
import { useMeta } from "@/lib/persona"
import type { ContentSummary } from "@/lib/types"

const TYPE_TABS = [
  { value: "case_study,project_profile", label: "All" },
  { value: "case_study", label: "Case studies" },
  { value: "project_profile", label: "Project profiles" },
  { value: "bid_submission", label: "Bid submissions" },
  { value: "template,capability_statement,good_news_story,image", label: "Collateral" },
]

export default function LibraryPage() {
  const { data: meta } = useMeta()
  const [type, setType] = useState(TYPE_TABS[0].value)
  const [sector, setSector] = useState("all")
  const [sort, setSort] = useState("recent")
  const [q, setQ] = useState("")
  const params = { type: type.split(","), sector: sector === "all" ? undefined : sector, sort, q, limit: 120 }
  const { data, isLoading } = useQuery({
    queryKey: ["content", params],
    queryFn: () => api.get<{ total: number; items: ContentSummary[] }>(`/content${qs(params)}`),
    placeholderData: keepPreviousData,
  })

  return (
    <div>
      <PageHeader
        eyebrow="Content repository"
        title="Project profiles & case studies"
        description="Project profiles are generated from every won Salesforce opportunity. Case studies add outcomes, photography and reference contacts. Bid submissions capture lessons learned from every closed tender."
      />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={type} onValueChange={setType}>
          <TabsList className="h-auto flex-wrap">
            {TYPE_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title or client" className="pl-9" />
          </div>
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger className="sm:w-56"><SelectValue placeholder="Sector" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sectors</SelectItem>
              {meta?.sectors.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently updated</SelectItem>
              <SelectItem value="value">Contract value</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{data ? `${data.total} items visible to you` : " "}</p>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
      ) : !data?.items.length ? (
        <EmptyState icon={BookOpen} title="Nothing here yet">Try another sector or content type.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((c) => <ContentCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  )
}
