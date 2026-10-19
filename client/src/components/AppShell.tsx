import { useEffect, useState, type FormEvent } from "react"
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import {
  BookOpen,
  Briefcase,
  ChevronsUpDown,
  ClipboardCheck,
  Home,
  Menu,
  Search,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import ventiaLogo from "@/assets/ventia-logo.webp"
import { ROLE_LABELS, SECTOR_SHORT } from "@/lib/format"
import { useMeta, usePersona } from "@/lib/persona"

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Profiles & Case Studies", icon: BookOpen },
  { to: "/opportunities", label: "Opportunities", icon: Briefcase },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/submit", label: "Submit Content", icon: Upload },
  { to: "/governance", label: "Governance", icon: ClipboardCheck },
]

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("")
}

function Brand() {
  return (
    <Link to="/" className="flex flex-col gap-3 px-2" aria-label="One Work Winning Hub home">
      <img src={ventiaLogo} alt="Ventia" width={1879} height={850} className="-ml-2 h-16 w-auto self-start" />
      <div className="border-l-2 border-sidebar-primary pl-2.5 leading-tight">
        <div className="font-serif text-lg font-semibold text-white">One Work Winning Hub</div>
        <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/70">Enterprise knowledge</div>
      </div>
    </Link>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-white",
              isActive && "bg-sidebar-accent text-white shadow-inner",
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar p-4">
      <Brand />
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/80">
        <div className="mb-1 font-semibold text-white">{import.meta.env.MODE === "share" ? "Shared demo (offline)" : "Demo environment"}</div>
        {import.meta.env.MODE === "share" &&
          `Runs entirely in this file with ${import.meta.env.VITE_SHARE_DATA === "synthetic" ? "synthetic demo data" : "only the real Salesforce export"}; changes you make last until you close it. `}
        SharePoint and Entra ID are simulated. Only 8 opportunities come from the Salesforce export; badges mark which records are real and which are synthetic. Switch persona (top right) to see how sector-first permissions change results.
      </div>
    </div>
  )
}

function PersonaSwitcher() {
  const { data: meta } = useMeta()
  const { user, switchPersona } = usePersona()
  if (!meta || !user) return <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
  const bySector = meta.sectors.map((s) => ({ sector: s.name, users: meta.users.filter((u) => u.sector === s.name) }))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-10 gap-2 pl-1.5">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary text-[11px] text-primary-foreground">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left leading-tight md:block">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {ROLE_LABELS[user.role]} · {SECTOR_SHORT[user.sector]}
            </div>
          </div>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Switch persona (simulated Entra ID)</DropdownMenuLabel>
        {bySector.map(({ sector, users }) => (
          <DropdownMenuGroup key={sector}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">{sector}</DropdownMenuLabel>
            {users.map((u) => (
              <DropdownMenuItem key={u.id} onSelect={() => switchPersona(u.id)} className={cn(u.id === user.id && "bg-accent")}>
                <div className="flex flex-col">
                  <span className="text-sm">{u.name}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[u.role]} · {u.title}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function GlobalSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [q, setQ] = useState("")
  useEffect(() => {
    if (location.pathname === "/search") setQ(params.get("q") ?? "")
  }, [location.pathname, params])
  function submit(e: FormEvent) {
    e.preventDefault()
    navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }
  return (
    <form onSubmit={submit} className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search case studies, projects, bids, people…"
        className="h-10 bg-background pl-9"
        aria-label="Search work-winning content"
      />
    </form>
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarBody />
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-none p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <GlobalSearch />
          <div className="ml-auto">
            <PersonaSwitcher />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
