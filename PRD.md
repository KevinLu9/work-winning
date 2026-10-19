# Product Requirements Document

## One Work Winning Hub (OWWH) — Demo / MVP

**Version:** v0.1 (derived from BRD Draft v0.1)
**Source documents:** `BRD.md`, `BRAND.md`, `salesforce_synthetic_cut.xlsx`
**Date:** October 2026

---

## 1. Purpose

This PRD translates the OWWH Business Requirements Document into concrete, testable product requirements for a working demo application. The demo proves the MVP scope defined in BRD §12 — enterprise search, case studies, project profiles, contact directory, metadata-driven tagging, sector-first permissions, simulated SharePoint integration and content submission forms — using Salesforce Opportunity data as the backbone.

### 1.1 Goals

| # | Goal (BRD §4) | Product outcome | Demo metric |
|---|---|---|---|
| G1 | Increase visibility of reusable knowledge | One search box over content, opportunities and people | Search returns results across ≥3 entity types |
| G2 | Improve cross-sector collaboration | Shared / Enterprise visibility, cross-sector contact discovery | Content from other sectors visible when shared |
| G3 | Reduce duplication | Existing case studies/profiles surfaced before submission | Similar-content panel on submission review step |
| G4 | Faster bid preparation | Relevant content found in < 5 minutes | Search response < 5 s (target < 500 ms) |
| G5 | Capture knowledge from completed tenders | Closed opportunities generate bid-submission records with lessons learned | Every closed opportunity has a bid record |
| G6 | Consistent governance | Every item has owner, review date, approval status, version | Governance dashboard: 0 items without owner |
| G7 | Searchable expertise | Contacts derived from Salesforce people fields | Contact profile shows opportunities, wins, clients |
| G8 | AI-ready foundation | Standardised metadata on every item | Metadata completeness score per sector |

### 1.2 Non-goals (BRD §12 Deferred)

AI proposal generation, chatbot assistant, advanced analytics, automated document rewriting, full tender lifecycle management. Real SharePoint / Entra ID / Teams connectivity is **simulated** in the demo (see §9).

---

## 2. Users & Personas (BRD §5)

| Persona | Role in demo | Key needs |
|---|---|---|
| Bid Manager | Default user | Find past submissions, project profiles, contacts fast |
| Proposal Writer / Coordinator | Content consumer & submitter | Reusable exec summaries, methodologies, templates |
| Estimator / Commercial Manager | Consumer | Contract values, durations, win/loss reasons |
| Business Development Manager / GM | Consumer | Pipeline view by sector, client and region |
| Sector Administrator | Content owner | Approve submissions, manage review queue |
| Enterprise Administrator | Governance | Cross-sector governance view, audit log |

The demo provides a **persona switcher** in place of Entra ID sign-in. Each persona has a home sector and role; all permission checks use it.

### Sectors

Defence & Social Infrastructure (D&SI), Transport, Telecommunications, Infrastructure Services (IS), Corporate Services. The Salesforce field `Division__c` is the sector key.

---

## 3. Scope

| Capability | BRD ref | In demo |
|---|---|---|
| Enterprise search (keyword + natural-language style) | §6.1 | ✅ |
| Content repository: case studies, project profiles, bid content, templates, good-news stories, capability statements | §6.2 | ✅ |
| Contact discovery | §6.3 | ✅ |
| Guided content submission with mandatory metadata | §6.4 | ✅ |
| Sector-first permissions + restricted content | §7 | ✅ |
| Governance: ownership, review/expiry, approval, versioning | §8 | ✅ |
| Salesforce opportunity metadata | §9 | ✅ (seeded from xlsx) |
| SharePoint, Entra ID, Teams | §9 | Simulated |
| AI search / proposal assistance / classification | §10 | ❌ (rule-based query parsing only) |

---

## 4. Functional Requirements

Priority: **M** = Must (MVP), **S** = Should, **C** = Could.

### 4.1 Enterprise Search (BRD §6.1) — highest-priority capability

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-SRCH-01 | Single global search box available on every page | M | Header search submits to `/search?q=` from any screen |
| FR-SRCH-02 | Keyword search across content items, Salesforce opportunities and contacts | M | Query "NBN" returns the NBN opportunities, derived content and related contacts |
| FR-SRCH-03 | Natural-language style queries parsed into filters | M | "water treatment projects in VIC over $5m" → filters: Region=VIC, Value ≥ 5,000,000, keywords "water treatment"; shown as removable chips |
| FR-SRCH-04 | Filters: sector, client, region, service line, contract value range, content type | M | Each filter narrows results and shows facet counts |
| FR-SRCH-05 | Results ranked by relevance (BM25), grouped/tabbed by entity type | M | Tabs: All / Content / Opportunities / Contacts with counts |
| FR-SRCH-06 | Result cards show type, sector, client, value, visibility badge, owner, snippet with highlighted terms | M | Matched terms highlighted |
| FR-SRCH-07 | Results respect permissions | M | Items not visible to the active persona never appear, including in facet counts |
| FR-SRCH-08 | Search response time | M | < 5 s (BRD §11); target < 500 ms on demo dataset |
| FR-SRCH-09 | Example queries offered on the home page | S | Clicking an example runs the search |

**Search scope (BRD §6.1):** case studies, project profiles, bid submissions/tender responses, templates, good-news stories, photos/graphics (image items), capability statements, key contacts, Salesforce opportunity metadata.

### 4.2 Content Repository (BRD §6.2)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-CONT-01 | Case study records: client, contract value, location, scope, service offering, outcomes, photo, reference contacts, confidentiality | M | Detail page shows every listed field |
| FR-CONT-02 | Project profile records: description, contract value, duration, sector, services delivered | M | Generated for every Closed-Won opportunity |
| FR-CONT-03 | Bid content records: executive summary, methodology, client responses, submission outcome, lessons learned | M | Generated for every closed opportunity; win/loss reason from `Won_Lost_Reason__c` |
| FR-CONT-04 | Each content item links to its source Salesforce opportunity | M | "Source opportunity" card on detail page |
| FR-CONT-05 | Each content item exposes relevant internal contacts (BRD §6.3) | M | Contacts panel lists people with role on that work |
| FR-CONT-06 | Library browse view for project profiles & case studies with filters | M | Grid of cards filterable by sector/type |
| FR-CONT-07 | Proposal teamsite (SharePoint) link shown | S | `Proposal_Teamsite__c` rendered as a SharePoint link |

### 4.3 Salesforce Opportunity Explorer (BRD §6.1, §9)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-OPP-01 | Opportunity list with sortable columns: Name, client, sector, BU, stage, status, TCV, probability, close date, proposal manager | M | Sort and filter work server-side |
| FR-OPP-02 | Pipeline summary charts: value by stage, by sector, won/lost reasons | S | Charts use Ventia palette |
| FR-OPP-03 | Opportunity detail shows **every populated Salesforce field**, grouped (Overview, Commercial, Geography, Timeline, People, Delivery & JV, Risk & Compliance, System) | M | Empty / zero fields hidden; toggle "show all fields" reveals all 284 |
| FR-OPP-04 | State revenue split visualised from `Australia_<STATE>_Revenue__c` / `New_Zealand_*` fields | S | Bar chart with weighted vs unweighted |
| FR-OPP-05 | Key-date timeline: created → proposal close → tender close → contract start → contract end | S | Rendered from date fields |
| FR-OPP-06 | People fields link to contact profiles | M | Clicking Proposal Manager opens their contact page |

### 4.4 Contact Discovery (BRD §6.3)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-CONTACT-01 | Directory of internal contacts derived from Salesforce people fields | M | Built from the populated people fields: Proposal_Manager__c, Bid_Writer__c, Tender_Manager__c |
| FR-CONTACT-02 | Expertise tags: work-winning, technical, commercial, operational, legal; plus sector specialisms | M | Filterable |
| FR-CONTACT-03 | Profile: sectors, clients worked with, opportunities (count, wins, win rate, total TCV), content owned | M | Values reconcile with opportunity data |
| FR-CONTACT-04 | Contacts searchable via enterprise search | M | Name or expertise search returns the contact |

### 4.5 Content Submission Workflow (BRD §6.4)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-SUB-01 | Guided multi-step form: Type → Metadata → Content → Visibility & Restrictions → Review | M | Steps cannot be skipped while invalid |
| FR-SUB-02 | Upload types: case study, project profile, bid submission, image, good-news story (plus template, capability statement) | M | Type-specific content fields |
| FR-SUB-03 | Mandatory metadata: sector, business unit, service line, contract value range, client, geography, confidentiality level, owner, review date | M | Server rejects (HTTP 400) when any are missing |
| FR-SUB-04 | Visibility defaults to **Sector only** | M | Default selected on form and enforced server-side |
| FR-SUB-05 | Review date auto-suggested from content type review cycle | S | Case study / project profile +12 months, CV +6 months |
| FR-SUB-06 | Optionally link to a Salesforce opportunity, pre-filling metadata | S | Selecting opportunity fills sector, BU, client, geography, value range |
| FR-SUB-07 | Similar existing content shown on review step (reduce duplication) | S | Top 3 FTS matches on title |
| FR-SUB-08 | New submissions enter `pending` approval status and appear in sector admin queue | M | Visible in Governance → Approvals |

### 4.6 Security & Permissions (BRD §7)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-SEC-01 | Visibility levels: **Sector only**, **Shared** (named sectors), **Enterprise** | M | Enforced in every API query |
| FR-SEC-02 | Default visibility Sector only (confidential by default) | M | See FR-SUB-04 |
| FR-SEC-03 | Restricted flags: pricing, current tender, government contract, NDA, client-sensitive, referee information, employee CV | M | Restricted items visible only to the originating sector, regardless of sharing |
| FR-SEC-04 | Salesforce `Visibility_Classification__c` = Restricted limits an opportunity to its own Division | M | Other-sector personas cannot list or open it |
| FR-SEC-05 | Role-based actions: only Sector Admin (own sector) / Enterprise Admin may approve or edit governance fields | M | 403 otherwise |
| FR-SEC-06 | Audit logging of views, searches, creates, updates, approvals | M | Audit log table populated; visible to Enterprise Admin |
| FR-SEC-07 | Hidden items return 404 (no existence leak) | S | Direct URL to hidden item shows "not found or no access" |

### 4.7 Content Governance (BRD §8)

| ID | Requirement | Pri | Acceptance criteria |
|---|---|---|---|
| FR-GOV-01 | Each sector has Content Owner, Administrator, Backup Administrator | M | Shown on Governance page |
| FR-GOV-02 | Every item has owner, review date, expiry date, approval status, version | M | Detail page governance panel |
| FR-GOV-03 | Review queue: overdue and due within 30 days | M | Lists sorted by review date |
| FR-GOV-04 | Approval queue for pending submissions; approve / reject actions | M | Approve sets status `approved`, writes audit + version |
| FR-GOV-05 | Edits create a new version record | M | Version history list on detail page |
| FR-GOV-06 | Metadata completeness score per sector | S | % of items with all mandatory metadata |
| FR-GOV-07 | Review cycles: case studies annually, CVs 6-monthly, project profiles annually | M | Applied to seed data and suggestions |

### 4.8 Integrations (BRD §9) — simulated

| ID | Integration | Demo behaviour |
|---|---|---|
| FR-INT-01 | Salesforce | Opportunity data loaded from `salesforce_synthetic_cut.xlsx` into SQLite, preserving original column names |
| FR-INT-02 | SharePoint | `Proposal_Teamsite__c` displayed as SharePoint links; documents represented as content items |
| FR-INT-03 | Entra ID | Persona switcher; `X-OWWH-User` header identifies user |
| FR-INT-04 | Teams | Out of scope; notification copy shown on approval ("would notify via Teams") |

---

## 5. Data Requirements

### 5.1 Source data

`salesforce_synthetic_cut.xlsx` — one sheet, Salesforce `Opportunity` export with **284 columns** and 8 rows. Dates are Excel serial numbers and are converted to ISO-8601. Multi-select fields (`Won_Lost_Reason__c`, `VES_Service_Lines__c`, `Bonding_Type__c`) are JSON arrays.

The demo database contains the 8 source rows unchanged (apart from date conversion) plus ~142 synthetic rows with the same 284 columns. Synthetic rows only populate the **84 columns that hold a value in at least one source row**; the remaining 200 columns keep the export's own empty value, because they may not be used by the business. Synthetic values stay internally consistent (stage ↔ probability ↔ IsWon/IsClosed ↔ forecast category), and all five sectors are represented.

**FR-DATA-01 (Must):** Every opportunity, content item and contact is labelled with its data source: *Salesforce export*, *Synthetic* or *User submitted*. Search, Opportunities and Contacts can filter by data source.

### 5.2 Salesforce → OWWH field mapping

| OWWH concept | Salesforce column(s) |
|---|---|
| Sector | `Division__c` |
| Business unit | `Business_Unit__c` |
| Service line | `Line_of_Business__c`, `Discipline__c` |
| Client | `Opportunity_Parent_Account_Name__c` |
| Geography / region | `Project_Location__c`, `Location_of_Project__c`, `Country__c`, `Australia_<STATE>__c` |
| Contract value | `Amount`, `TCV_Converted__c`, `Estimated_Contract_Value_Rev__c` |
| Annual value | `Annual_Contract_Value__c`, `ACV_Converted__c` |
| Weighted value | `Total_Weighted_Contract_Value__c`, `Annual_Weighted_Contract_Value__c` |
| Duration | `Contract_Period_monthsRev1__c`, `Contract_Start_Date__c`, `Contract_End_Date_formula__c` |
| Scope / description | `Scope_of_Works__c`, `Name`, `Short_Opportunity_Name__c` |
| Outcome | `StageName`, `IsWon`, `IsClosed`, `Opportunity_Status__c`, `Won_Lost_Reason__c`, `Reason_Won_Lost__c` |
| Probability | `Probability`, `Go_Probability__c`, `Get_Probability__c`, `Go_Get__c` |
| New vs renewal | `New_or_Renewal_Work__c` |
| Contacts | `Proposal_Manager__c`, `Bid_Writer__c`, `Tender_Manager__c` (estimator, commercial and legal lead columns are empty in the export) |
| Key dates | `CreatedDate`, `Proposal_Closing_Date__c`, `Tender_Closing_Date__c`, `Initial_Tender_Close_Date__c`, `CloseDate` |
| Confidentiality | `Visibility_Classification__c` |
| SharePoint location | `Proposal_Teamsite__c` |
| Identifiers | `ItemInternalId` (PK), `Id`, `BRS_Opportunity_Number__c`, `Unique_Opportunity_Identifier__c` |

### 5.3 Derived content rules

| Content type | Derived from | Review cycle |
|---|---|---|
| Project profile | Every Closed-Won opportunity | 12 months |
| Case study | ~40% of Closed-Won opportunities (outcomes, photo, reference contact) | 12 months |
| Bid submission | Every closed opportunity (won or lost) — exec summary, methodology, lessons learned | 24 months |
| Template / capability statement / good-news story / image | 2–4 per sector | 12 months |

Some seeded items are deliberately past their review date so the governance queue has realistic content.

### 5.4 Mandatory metadata (applies to all content)

Sector, business unit, service line, contract value range (`<$1m`, `$1–10m`, `$10–50m`, `$50–100m`, `>$100m`), client, geography, confidentiality (Public, Internal, Confidential, Restricted), owner, review date.

---

## 6. UX Requirements

| Screen | Purpose | Key elements |
|---|---|---|
| Home | Search-first landing | Hero search, example queries, KPIs, recent content, sector tiles |
| Search | Discovery | Facets, chips for parsed filters, type tabs, highlighted snippets |
| Library | Browse profiles & case studies | Card grid, filters |
| Content detail | Reuse | Body sections, metadata, governance panel, contacts, source opportunity, versions |
| Opportunities | Pipeline explorer | Charts, sortable table |
| Opportunity detail | Full Salesforce context | Grouped field cards, revenue split chart, timeline, linked content |
| Contacts | Find expertise | Filterable directory, profiles |
| Submit | Capture knowledge | Five-step guided form |
| Governance | Ownership & quality | Review / expiry / approval queues, sector roster, completeness, audit log |

**Design system:** Ventia brand (`BRAND.md`). Primary deep green `#004825`, secondary mid green `#00994D`, success feijoa `#A0CD60`, warning safety yellow `#F5E646`, danger red earth `#9E3323`, info plum `#671C32`. Headings in **Source Serif 4**, body/numbers in **Inter**. Simple website-style experience, mobile responsive (BRD §11).

---

## 7. Non-Functional Requirements (BRD §11)

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Usability | Website-style navigation, ≤ 2 clicks from home to any content |
| NFR-02 | Usability | Responsive from 375 px to desktop |
| NFR-03 | Performance | Search < 5 s; target < 500 ms on demo data |
| NFR-04 | Security | Role-based access, permission filter applied in one shared module |
| NFR-05 | Security | Audit logging of all reads/writes |
| NFR-06 | Security | Data classification on every item |
| NFR-07 | Scalability | Sector list and metadata options data-driven (no hard-coded sector logic in UI) |
| NFR-08 | Maintainability | Field labels/groups for Salesforce columns configurable in `sf_field_meta` |
| NFR-09 | Maintainability | Database rebuildable from source with one command (`npm run seed`) |

---

## 8. Technical Architecture (demo)

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS v4, shadcn/ui, lucide-react icons, React Router, TanStack Query, Recharts |
| Backend | Python Flask (REST JSON API under `/api`) |
| Server | Flask debug server in development; **gunicorn** in production mode |
| Database | SQLite with FTS5 full-text index (`data/owwh.db`) |
| Python env | `venv` (`.venv/`) |
| Orchestration | Root `package.json` using **concurrently** to run the Flask API and Vite dev server together |

### Commands

| Command | Action |
|---|---|
| `npm run setup` | Create `.venv`, install Python + Node deps, seed database |
| `npm run seed` | Rebuild `data/owwh.db` from the xlsx |
| `npm run dev` | Flask API (`:5001`) + Vite (`:5173`, proxies `/api`) via concurrently |
| `npm start` | Build frontend, serve app + API via gunicorn on `:8000` |

### API surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/meta` | Sectors, personas, filter options, field metadata |
| GET | `/api/search` | Federated search with filters + facets |
| GET/POST | `/api/content` | List / create content |
| GET/PATCH | `/api/content/:id` | Detail / update (new version) |
| POST | `/api/content/:id/approve` | Approve or reject |
| GET | `/api/opportunities` | Paged list + pipeline stats |
| GET | `/api/opportunities/:id` | Full grouped field detail |
| GET | `/api/contacts`, `/api/contacts/:id` | Directory / profile |
| GET | `/api/governance` | Queues, roster, completeness |
| GET | `/api/audit` | Audit log (Enterprise Admin) |

---

## 9. Future State (BRD §10) — not in demo

- **AI search:** replace the rule-based query parser with an LLM/semantic retriever over the same metadata.
- **AI proposal assistance:** upload tender documents → suggest case studies, similar answers, project examples, graphics.
- **Content classification:** auto-tagging and keyword generation on submission.
- **Knowledge extraction:** reusable answers, frequent client questions, winning methodologies from bid records.

The standardised metadata and FTS index in this demo are the foundation for these (BRD principle 5: "Standardise metadata before introducing AI").

---

## 10. Traceability Matrix

| BRD section | PRD requirements | Screen / API |
|---|---|---|
| §6.1 Enterprise Search | FR-SRCH-01…09 | Search, Home / `/api/search` |
| §6.2 Content Repository | FR-CONT-01…07 | Library, Content detail / `/api/content` |
| §6.3 Contact Discovery | FR-CONTACT-01…04, FR-CONT-05, FR-OPP-06 | Contacts / `/api/contacts` |
| §6.4 Submission | FR-SUB-01…08 | Submit / `POST /api/content` |
| §7 Security | FR-SEC-01…07 | All / `permissions.py` |
| §8 Governance | FR-GOV-01…07 | Governance / `/api/governance` |
| §9 Integrations | FR-INT-01…04, FR-OPP-01…06 | Opportunities / `/api/opportunities` |
| §10 AI | §9 (deferred) | — |
| §11 NFRs | NFR-01…09 | — |
| §12 MVP scope | §3 | — |
| §13 Design principles | FR-SRCH (search first), FR-SEC-02 (confidential by default), §5.4 (metadata) | — |

---

## 11. Success Criteria for the Demo

1. A user finds a relevant project profile for "water treatment in VIC" in under a minute.
2. Switching persona from Transport to Telecommunications visibly changes what content is available.
3. A new case study cannot be submitted without the mandatory metadata, and once submitted appears in the sector admin's approval queue.
4. Every opportunity shows all its populated Salesforce fields with readable labels.
5. The governance page shows owners for every sector and a non-empty overdue review queue.
