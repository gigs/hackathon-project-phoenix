# Project Phoenix — Channel Summary

*Generated 15 April 2026 from #project-phoenix (created 8 April 2026)*

## The Problem

Gigs has lost customer centricity — not in behavior, but in systems and processes. There is no single view of a customer and their priorities. When ownership shifts between teams (IM, marketing, partner management), the information structure changes with it. This creates poor visibility for founders, product, engineering, and even within the Growth team itself.

Linear is positioned as the source of truth but is rarely used by founders or leadership for status updates — people share in Slack first, making Linear feel like overhead. Ad-hoc meetings exist mainly to repackage information that already lives in Slack or Linear. Multiple teams are trying to solve fragments of this independently (automated account overviews from Louisa, automated Linear updates from Max, GTM trackers from Tilly, etc.).

As Dennis Bauer framed it: Slack has been compensating for a missing operating system — there is no clear ownership tracking, no decision rights framework, no shared definition of "on track," and customer information is scattered across tools and people's heads.

## The Solution: Centralised Customer View

Build a centralised, cross-functional customer view — sourced from existing tools, maintained by humans, heavily AI-assisted — and make it the single lens for reporting on and discussing customers.

### Dashboard Design

The primary view is the **account drill-down** — a single-customer page and the default landing point. It has three zones:

**Header**: Customer name, overall health indicators, and a customer-level ARR chart showing actuals vs. forecast over time.

**Deals table**: Each row is a deal/market (e.g. Klarna US, Klarna France, Klarna SE). One deal per country per product type, following HubSpot pipeline structure. Columns track deal stage progression through the HubSpot deal stages: Open Leads → Pursuing → Prospects → S1 Discovery → S2 Proposal → S3 Negotiation → S4 Closed Won (plus Closed Lost / Paused states). Status dots feed directly from Linear (green = on track, red = at risk, etc.). Every deal row has its own mini ARR/activations chart showing actuals vs. forecast.

**Notes & issues panel**: A right-hand section combining two input paths. Tagged Linear issues appear here automatically and are clickable (linking back to Linear). DRIs can also write or edit free-text notes directly for context that doesn't live in a Linear issue. An ℹ️ icon on specific items flags callouts — important context, risks, or decisions that need attention. These callouts are time-boxed: they persist until the DRI explicitly removes them from the card.

**DRI ownership**: The DRI for a deal row is the owner of the corresponding Linear project or HubSpot deal, depending on lifecycle stage — typically the deal owner in HubSpot during presales, transitioning to the Linear project owner (implementation lead) once the deal gets serious and enters Linear.

From the account drill-down, users can navigate to a **portfolio view**: all accounts in one table, filterable by stage, health, AM model, vertical, product, region, etc. — useful for leadership overviews and cross-cutting analysis.

### Scorecard Model

Each customer gets a **single scorecard** that summarises the different deals associated with that customer. Deals originate in HubSpot; once a deal becomes serious it also gets represented in Linear. Within the scorecard, Gigsters can **tag specific Linear issues** to surface them as noteworthy items (blockers, milestones, risks, etc.).

The **functional scorecard** — an aggregation showing functional health across accounts — is a separate effort that will leverage the same underlying data and infrastructure but is not part of the core V1 build.

### Proposed Architecture & Data Sources

- **Slack** — primary communication tool
- **Grain / Granola** — meeting recording
- **Linear** — source of truth on planned efforts and status (each account = Initiative with workstream projects; BAU project is the canonical record per account)
- **HubSpot** — system of record (Linear syncs into HubSpot)
- **Google Sheets** — source of truth for forecasts and GTM tracking (Tilly's customer-level sheets + the Partner Marketing Campaign Promo Calendar in Notion)
- **Lightdash / BigQuery** — source of truth on actuals (ARR, subscription activations, active subs). Christopher confirmed metrics can be exposed from BigQuery/data warehouse to the dashboard.
- **Zapier or Claude Agent** — integration layer to keep Linear ↔ HubSpot in sync. Rahil owns the Zap build; Cees has explored a Claude Agent approach and is open to engineering solutions.

### AI-Assisted Workflows

1. **Continuous updates (human-in-the-loop)**: People communicate freely in Slack and meetings. Claude detects signals that warrant a Linear update, proposes the change, and a DRI approves or edits before Claude executes.
2. **Periodic scorecards (weekly)**: Claude compiles a scorecard per customer, publishes to a central navigable repository, and pushes a compact "tile" to Slack to drive people to the dashboards.

## Key Design Principles (from Dennis)

- **Decision rights across functions** — clear ownership, appeal paths, tracked handoffs.
- **Learning loops** — state expected outcomes before something goes live so results can be measured. Did the campaign work? Did the product change land?
- **Tight timelines** — calendar weeks, not quarters. Flag changes and log what changed from (weeks matter, days don't).
- **No repackaging** — cut down on restating the same information across meetings, Slack, and Linear.
- **Retrofit tracking** — every implementation is built with the best parts available at the time but needs retrofitting as the platform matures. Newer implementations must inherit accumulated learnings, and learnings from newer implementations need to flow back to older ones.
- **Regional/vertical accountability** — the move to a regional and vertical structure needs to be reflected in this setup (open question raised by Dennis).

## Early Lifecycle Accounts (Presales → S2) — Scorecard Inputs

Based on Cees's sync with David Frenkel, the scorecard for early-stage accounts should include:

- **Probability of going live** (no / low / med / high / confirmed) paired with a **go-live date** (realistic/slightly pessimistic, matching customer granularity — "in Q2" = end of Q2), plus definition of "live" (first 100 lines / first 1,000 lines).
- **Quality indicators / gates**: test project created + product interaction, SOW lifecycle (drafted / finalized / agreed), Figma received, contract signed, Slack external channel activity, deal review components (pricing, product dependencies, connectivity dependencies).

## Open Questions & Flags

1. **Product marketing data gap** — no confirmed single source for product marketing inputs beyond Google Sheets trackers. Tilly's Notion calendar captures confirmed campaigns; speculative items live in Google Sheets.
2. **Multi-project accounts** — the automation must cater to accounts with multiple projects (Santander, BBVA, Revolut, Klarna, etc.), not just the single BAU project.
3. **Regional/vertical structure** — how does the move to regional and vertical accountability get reflected in this setup?
4. **Frontend hosting & access** — needs to be accessible only to Gigs employees behind Google SSO (Ethan leading eng effort).
5. **Live data connection** — initial build uses CSV export; connecting live BigQuery data is next step (backend approach determines BigQuery table access).

## Key Resources

- [Build Spec — Notion](https://www.notion.so/wearegigs/Build-Spec-Data-Inputs-Integration-3419d4d9525a813c9ad3e272be835b21)
- [Project Phoenix — Notion](https://www.notion.so/wearegigs/Project-Phoenix-33c9d4d9525a8069be07eb794d15c38f)
- [Architecture brainstorm — Figma](https://www.figma.com/board/AyIbIVzR6EaNpSqoNrTWbP/Project-Phoenix-arch-brainstorm)
- [Partner Marketing Campaign Promo Calendar — Notion](https://www.notion.so/wearegigs/Partner-Marketing-Campaign-Promo-Calendar-3109d4d9525a805b8002ed726d1ff67a)

---

*Context note: The `message.md` file in this directory contains Cees's original framing message (shared before the channel was created) proposing this initiative, including the observation about lost customer centricity, the proposed approach of a centralised customer view sourced by Linear + Lightdash and maintained by AI-assisted humans, and the initial game plan and timeline leading to this sprint.*
