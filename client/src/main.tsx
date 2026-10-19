import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppShell } from "@/components/AppShell"
import { PersonaProvider } from "@/lib/persona"
import { ApiError } from "@/lib/api"
import HomePage from "@/pages/Home"
import SearchPage from "@/pages/Search"
import LibraryPage from "@/pages/Library"
import ContentDetailPage from "@/pages/ContentDetail"
import OpportunitiesPage from "@/pages/Opportunities"
import OpportunityDetailPage from "@/pages/OpportunityDetail"
import ContactsPage from "@/pages/Contacts"
import ContactDetailPage from "@/pages/ContactDetail"
import SubmitPage from "@/pages/Submit"
import GovernancePage from "@/pages/Governance"
import NotFoundPage from "@/pages/NotFound"
import "./index.css"

// The shareable single file is opened from disk (file://), where only hash URLs work.
const Router = import.meta.env.MODE === "share" ? HashRouter : BrowserRouter

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && [403, 404].includes(err.status)) && count < 2,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PersonaProvider>
        <TooltipProvider delayDuration={200}>
          <Router>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="content/:id" element={<ContentDetailPage />} />
                <Route path="opportunities" element={<OpportunitiesPage />} />
                <Route path="opportunities/:id" element={<OpportunityDetailPage />} />
                <Route path="contacts" element={<ContactsPage />} />
                <Route path="contacts/:id" element={<ContactDetailPage />} />
                <Route path="submit" element={<SubmitPage />} />
                <Route path="governance" element={<GovernancePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Router>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </PersonaProvider>
    </QueryClientProvider>
  </StrictMode>,
)
