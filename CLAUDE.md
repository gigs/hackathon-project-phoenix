# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Phoenix is a **static site generator + dashboard** for Gigs that provides a centralized, cross-functional customer view. It aggregates data from Linear, HubSpot, Lightdash/BigQuery, Slack, and Google Sheets into static HTML + JSON output.

## Build Commands

```bash
npm run fetch-data          # Fetch API data → writes intermediate JSON to data/
npm run build               # Next.js static export → writes HTML to out/
npm run build:full          # fetch-data + build in one step
npm run dev                 # Next.js dev server (reads from data/)
npm run serve               # Serve static output from out/
npm run fetch-data -- --no-cache   # Force fresh API calls (skip 4h cache)
```

## Architecture

**Two-step build pipeline:**
1. `fetch-data` reads `customers/*.json`, calls API connectors (Linear, HubSpot, Slack, Lightdash), writes intermediate JSON to `data/`
2. `next build` reads from `data/`, renders static HTML to `/out`

```
customers/*.json          Customer index files (structured references to external systems)
    ↓
scripts/fetch-data.ts     Reads configs, calls connectors, writes intermediate JSON
    ├→ src/lib/connectors/linear.ts     (GraphQL API)
    ├→ src/lib/connectors/hubspot.ts    (REST API v3)
    ├→ src/lib/connectors/lightdash.ts  (CSV fallback in V1)
    └→ src/lib/connectors/slack.ts      (message counts)
    ↓
data/                     Intermediate JSON (per-customer + portfolio summary)
    ↓
src/app/                  Next.js pages read from data/ at build time
    ↓
out/                      Static HTML + JS + CSS (no server needed)
```

### Caching
Raw API responses cached to `.cache/` with 4h TTL. Use `--no-cache` flag to force fresh fetches.

### Data Model

- **Customer** is the root entity (`customers/<name>.json`)
- Each customer has **revenue lines** (deals/markets) as sub-entities
- Revenue lines reference HubSpot deal IDs, Linear project slugs, Slack channels, and Lightdash dashboards
- Linear projects follow naming: `{project-name}-{hubspot-id}-{uuid}`
- Linear initiatives follow naming: `am-{customer-name}-{uuid}`
- HubSpot pipeline stages: Open Leads → Pursuing → Prospects → S1 Discovery → S2 Proposal → S3 Negotiation → S4 Closed Won
- Issues with the `flagged` label in Linear surface on the dashboard

### Key Views

1. **Account drill-down page** (`/customers/[slug]`) — header with ARR chart, deals table with pipeline stage dots, notes/issues panel
2. **Portfolio view** (`/`) — all customers in one sortable/filterable table

## Design System

Defined in `DESIGN.md`. Key points:

- **Aesthetic:** Industrial/utilitarian, function-first, data-dense
- **Stack:** Next.js 15, React, Tailwind CSS v4, Recharts
- **Font:** Inter via `next/font/google`
- **Colors:** OKLCH color space — sage neutrals + central green accent
- **Primary action color:** `central-600` (#1b9a4a)
- **All numeric data** must use `tabular-nums`
- **Anti-patterns:** No decorative blobs, no emoji as design elements, no centered-everything layouts

## Environment Variables

```
LINEAR_API_KEY=lin_api_...
HUBSPOT_ACCESS_TOKEN=pat-...
SLACK_BOT_TOKEN=xoxb-...
LIGHTDASH_API_KEY=              # unused in V1
```
