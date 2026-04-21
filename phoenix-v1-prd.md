# ⏳ TL;DR

Build a centralized, cross-functional customer view for Gigs — a static site generated from `customer.md` files (unstructured, semantic layer) and `customer.json` files (structured data that includes referneces to other data sources) - that is a ble to pull data from Linear, HubSpot, Lightdash, and Slack. The current thinking is that the repository of customer-specific files are embedded in a Claude `customer` skill. A separate script then invokes this skill in order to generate the dashboard in a very predictable way. V1 goal: every moving part exists end-to-end (data ingestion, build pipeline, dashboard UI, auth) at a thin level, so we can iterate from a working system rather than a spec.

# 🐍 Problem

Gigs has lost customer centricity — not in behavior, but in systems and processes. There is no single view of a customer and their priorities.

**Who feels it:**
- **Founders** cannot get a reliable status update without asking in Slack or scheduling a meeting.
- **Product and Engineering** have consistently given feedback that they lack visibility into customer priorities and implementation status.
- **Growth team (IM, Marketing, Partner Management)** — when ownership shifts between these functions, the information structure changes with it. Context is lost at handoffs.

**What's happening today:**
- Linear is positioned as source of truth but rarely used by leadership. People share in Slack first, making Linear feel like overhead.
- Ad-hoc meetings exist mainly to repackage information that already lives in Slack or Linear (State meetings, functional syncs).
- Multiple teams are solving fragments independently: automated account overviews (Louisa), automated Linear updates (Max), GTM trackers (Tilly). No convergence.
- Customer information is scattered across HubSpot, Linear, Slack, Google Sheets, Lightdash, and people's heads.

**Why now:** Gigs is moving to a regional and vertical accountability structure. Without a shared customer view, that transition will fragment visibility further.

# 📜 Background & Context

## Current State

- **Linear**: Each account maps to an Initiative with workstream projects. BAU project is the canonical record per account. Status dots (green/red/yellow) exist but aren't surfaced anywhere leadership looks.
- **HubSpot**: System of record for deals. Pipeline stages: Open Leads → Pursuing → Prospects → S1 Discovery → S2 Proposal → S3 Negotiation → S4 Closed Won (plus Closed Lost / Paused). Linear syncs into HubSpot via Zapier (Rahil owns the Zap).
- **Lightdash / BigQuery**: Source of truth on actuals — ARR, subscription activations, active subs. Christopher confirmed metrics can be exposed from BigQuery to the dashboard.
- **Google Sheets**: Source of truth for forecasts and GTM tracking (Tilly's customer-level sheets).
- **Slack**: Where real communication happens. External channels per customer (#project-klarna, etc.).
- **Grain / Granola**: Meeting recordings — not in V1 scope but relevant for future AI-assisted updates.

## Architecture Decision: Static Site Generation

The architecture uses a **customer.md file** and **customer.json file** per customer as the glue layer. Each set of files maps the customer to its resources across systems (Linear project IDs, HubSpot company ID, Slack channel name). A build script reads these index files, pulls live data from each source via API, and renders static HTML. No backend server needed. No need to think about deployment just yet, either. 

The static HTML actually uses a JSON file in the backend to populate the individual data fields. And this is relevant because that also allows us to build a separate dashboard that is more of a list view.

This was chosen because:
1. No runtime infrastructure to maintain — pure static generation.
2. customer.md files are human-readable, version-controlled, and easy to update. Where we need predictability we can use the JSON file.
3. Build runs on schedule or on push — always fresh, never stale-serving.

# 💡 Solution

## V1 Scope — End-to-End, Thin Across All Parts

V1 is explicitly **breadth over depth**. Every moving part should exist and work end-to-end, even if the data is incomplete or the UI is rough. This lets us iterate from a working system.

## Requirements

1. **customer.md file** and **customer.json file** — Create the schema and write index files for 3 real customers (Klarna, Revolut, Santander). There are two examples already in the folder.

2. **Build script** — A script that reads all customer.md files, fetches data from each source API, and outputs static HTML + JSON to `/dist`. Must handle: missing data gracefully (show placeholder, not crash), multiple projects per customer, and the full pipeline of sources.

3. **Data connectors (thin)** — One connector per source, each returning structured data:
   - **Linear API**: Project status, health indicator, tagged issues, DRI assignments.
   - **HubSpot API**: Deal stages, deal owners, pipeline progression per deal.
   - **Lightdash/BigQuery**: ARR actuals, subscription activations. V1 can use CSV export if live connection isn't ready — but the connector interface should be the same either way.
   - **Slack API**: Recent messages from the mapped channel (for activity signal, not content display).

4. **Account drill-down page** — The primary view. For a single customer, show:
   - **Header**: Customer name, overall health indicator, ARR chart (actuals vs forecast).
   - **Deals table**: One row per deal/market. Columns: market, health dot, pipeline stage progression, mini ARR trend, ARR value, go-live probability, DRI (with owner source — HubSpot or Linear), Linear issue count.
   - **Notes & issues panel**: Tagged Linear issues (clickable, linking back to Linear) + free-text notes from customer.md. Flagged items (ℹ️ callouts) should be visually distinct.

5. **Portfolio view** — All customers in one table. Columns: customer name, overall health, deal count, total ARR, stage distribution. Filterable by at least: stage and health status. This can be minimal — a sortable table is fine for V1.

## User Stories

- As a **founder**, I want to open Phoenix, see all customers at a glance, click into Klarna, and understand the status of every deal and what's flagged — without asking anyone.
- As an **implementation manager**, I want to see my customer's deals, their pipeline stages, the Linear issues tagged as noteworthy, and any notes — all in one place.
- As a **Growth lead**, I want to filter the portfolio view by stage to see which customers are in S1-S2 and need attention this week.

## Design

Dashboard mockup exists as `phoenix-dashboard-mockup.jsx` in the project directory. Whiteboard sketch from the design session is in `whiteboardoutput.jpg`. The mockup captures the target UI for the account drill-down: header with ARR chart, deals table with pipeline stage dots, and the notes/issues side panel.

As guidance use what's in the design.md file when it comes to design style and system.

## Analytics Requirements

Not in V1 scope. Track page views via a lightweight analytics script (Plausible or similar) if trivial to add, but don't block on it.

# 🎯 Success Criteria

This is largely a binary must-do — the system either exists and people use it, or it doesn't. That said, here's how we know V1 is working:

### Adoption Signals
- **Phoenix is the link people share** when someone asks "what's happening with [customer]?" — instead of a Slack search or a meeting.
- **Founders check Phoenix** instead of asking for status updates in Slack or scheduling ad-hoc syncs.
- **Weekly scorecard tiles in Slack** (V2) drive people to the dashboard, not away from it.

### Technical Bar
- **Build completes in < 2 minutes** for all customers.
- **Data is < 4 hours stale** (matching the rebuild schedule).
- **Zero manual steps** between a customer.md update and the site reflecting it.

# 🚫 Out of Scope

- **AI-assisted updates (V2)** — Claude detecting signals in Slack/Linear and proposing customer.md updates via DM. Architected for but not built in V1.
- **Quality gates / assess skill (V3)** — Cross-referencing sources to check whether a customer meets defined quality gates. Not in V1.
- **Forecast data from Google Sheets** — V1 shows actuals from Lightdash. Forecast overlay is desirable but not blocking.
- **Functional scorecard** — Aggregation showing functional health across accounts. Separate effort, not V1.
- **Meeting recordings integration** — Grain/Granola data. Not V1.
- **Slack content display** — V1 may show channel activity level (messages/week) but does not surface message content in the dashboard.
- **Write-back to Linear/HubSpot** — Dashboard is read-only in V1.
- **Mobile-optimized layout** — Desktop-first is fine.

# ⚖️ Trade-offs

**We're betting on:**
- Static site generation is sufficient — we don't need a backend server or real-time updates. 4-hour staleness is acceptable.
- customer.md as the glue layer will be simple enough that people actually maintain it (and V2's agentic updates will make this even easier).
- Breadth-first V1 (all parts thin) is better than depth-first (one part perfect). Having all moving parts connected reveals integration issues early.

**We're accepting:**
- V1 data will be incomplete for some customers. That's fine — the system should handle gaps gracefully.
- The UI will be rough. Functional beats polished at this stage.
- Manual customer.md maintenance until V2 agentic updates are built. The number of customers is small enough (~20-30) that this is manageable.
- CSV export for Lightdash/BigQuery if the live API connection isn't ready. The connector interface stays the same.

**We'll know this was wrong if:**
- customer.md files become stale and nobody updates them — the glue layer becomes another dead artifact.
- The build script becomes too slow or brittle as we add more customers and sources.
- People still default to Slack/meetings for status because the dashboard doesn't have what they need.

# ❓ Open Questions

- [ ] **BigQuery access**: Can the build script query BigQuery directly, or do we need to go through Lightdash's API? Christopher to confirm.
- [ ] **HubSpot API scope**: Which HubSpot API scopes do we need? Do we have an existing API key/app, or does one need to be created?
- [ ] **Linear API: tagged issues**: How are "noteworthy" issues tagged in Linear today? Is there a label convention, or do we need to define one?
- [ ] **Hosting decision**: Vercel vs Cloudflare Pages vs S3 + CloudFront. Ethan to recommend based on Google SSO integration simplicity.
- [ ] **Multi-project accounts**: Klarna has 4 deals/markets. Santander, BBVA, Revolut likely similar. Does the customer.md schema need to map deals explicitly, or can we derive deal structure from HubSpot?
- [ ] **DRI resolution**: DRI is HubSpot deal owner during presales, Linear project owner during implementation. How do we determine the cutover point programmatically?
- [ ] **Forecast data source**: Tilly's Google Sheets — is there a stable structure we can parse, or is this too manual for V1?

# 🚀 Launch Plan

- **V1 deploy**: Ship to Gigs employees behind Google SSO. No big announcement — share the link in #project-phoenix and let founders + Growth team start using it.
- **Feedback loop**: Collect feedback in #project-phoenix for 1-2 weeks. Focus on: is the data right? Is anything missing that blocks you from using this instead of Slack?
- **Iterate**: Fix data gaps and UI issues based on feedback before expanding to V2 (agentic updates).
- **Documentation**: Brief README in the repo covering: how to add a new customer (create customer.md), how the build works, how to trigger a manual rebuild.

# 📚 Sources

- [Project Phoenix — Notion](https://www.notion.so/wearegigs/Project-Phoenix-33c9d4d9525a8069be07eb794d15c38f)
- [Build Spec — Notion](https://www.notion.so/wearegigs/Build-Spec-Data-Inputs-Integration-3419d4d9525a813c9ad3e272be835b21)
- [Architecture brainstorm — Figma](https://www.figma.com/board/AyIbIVzR6EaNpSqoNrTWbP/Project-Phoenix-arch-brainstorm)
- `project-phoenix-summary.md` — Channel summary (15 April 2026)
- `message.md` — Cees's original framing message
- `phoenix-architecture-simple.html` — Architecture diagram (customer.md → build → static site)
- `phoenix-dashboard-mockup.jsx` — Dashboard UI mockup

## Gaps Acknowledged
