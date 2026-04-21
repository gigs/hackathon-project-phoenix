# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Phoenix is a **static site generator + dashboard** for Gigs that provides a centralized, cross-functional customer view. It aggregates data from Linear, HubSpot, Lightdash/BigQuery, Slack, and Google Sheets into static HTML + JSON output.

## Build Commands

```bash
npm run fetch-data              # Fetch API data → writes intermediate JSON to data/
npm run fetch-slack-insight    # Slack transcripts → Claude → data/customers/<slug>.slack-insight.json (requires enabled slack_insight in customers/*.json)
npm run fetch-overall-sentiment # Saved Slack transcript + fresh Linear context → Claude → data/customers/<slug>.overall-sentiment.json (requires enabled overall_sentiment + a saved transcript snapshot)
npm run build                   # Next.js static export → writes HTML to out/
npm run build:full              # fetch-data + build in one step
npm run build:full:insight      # fetch-data + fetch-slack-insight + build
npm run build:full:sentiment    # fetch-data + fetch-slack-insight + fetch-overall-sentiment + build
npm run dev                     # Next.js dev server (reads from data/)
npm run serve                   # Serve static output from out/
npm run fetch-data -- --no-cache           # Force fresh API calls (skip 4h cache)
npm run fetch-slack-insight -- --no-cache # Same for Slack transcript cache + channel resolution
npm run fetch-slack-insight -- --dry-run --customer klarna   # Log message counts only (no Anthropic call)
npm run fetch-slack-insight -- --customer klarna --reuse-transcript   # Claude only: reuse data/customers/<slug>.slack-transcript.json (skip Slack fetch)
npm run fetch-overall-sentiment -- --customer klarna           # Reuses saved Slack transcript snapshot, fetches Linear, sends both to Claude
npm run fetch-overall-sentiment -- --customer klarna --fetch-slack  # Escape hatch: fetch a fresh Slack transcript inline if no snapshot exists
npm run fetch-overall-sentiment -- --customer klarna --dry-run      # Log source counts and prompt sizes only (no Anthropic call)
```

## Architecture

**Two-step build pipeline:**
1. `fetch-data` reads `customers/*.json`, calls API connectors (Linear, HubSpot, Slack, Lightdash), writes intermediate JSON to `data/`
2. Optional: `fetch-slack-insight` reads `slack_insight` config, pulls Slack transcripts (**channel history + thread replies** in the lookback window; optional `max_messages_per_channel` / `max_message_chars`; both default to **no cap / no truncation** when omitted), saves a snapshot to **`data/customers/<slug>.slack-transcript.json`**, calls **Anthropic Messages API**, writes `data/customers/<slug>.slack-insight.json` (sidecar — customer pages load it at build time if present). Use **`--reuse-transcript`** to skip Slack and only regenerate the insight from the saved transcript + current prompt.
3. Optional: `fetch-overall-sentiment` reads `overall_sentiment` config, **reuses the saved `<slug>.slack-transcript.json` snapshot** (run `fetch-slack-insight` first; or pass `--fetch-slack` to fetch inline), fetches Linear initiatives + projects + project status updates + flagged issues for the configured `linear_initiatives` / `linear_projects`, formats both into one prompt, calls Anthropic, writes `data/customers/<slug>.overall-sentiment.json` (sidecar — customer pages load it at build time if present and render it as a headline panel above the Slack insight).
4. `next build` reads from `data/`, renders static HTML to `/out`

```
customers/*.json          Customer index files (structured references to external systems)
    ↓
scripts/fetch-data.ts     Reads configs, calls connectors, writes intermediate JSON
    ├→ src/lib/connectors/linear.ts     (GraphQL API)
    ├→ src/lib/connectors/hubspot.ts    (REST API v3)
    ├→ src/lib/connectors/lightdash.ts  (CSV fallback in V1)
    └→ src/lib/connectors/slack.ts      (message counts)
    ↓
scripts/fetch-slack-insight.ts (optional)
    └→ slack.ts transcripts (saved as <slug>.slack-transcript.json) + Anthropic → data/customers/<slug>.slack-insight.json
    ↓
scripts/fetch-overall-sentiment.ts (optional)
    └→ saved <slug>.slack-transcript.json + linear.ts insight context + Anthropic → data/customers/<slug>.overall-sentiment.json
    ↓
data/                     Intermediate JSON (per-customer + portfolio summary + optional insight sidecars)
    ↓
src/app/                  Next.js pages read from data/ at build time
    ↓
out/                      Static HTML + JS + CSS (no server needed)
```

**Privacy:** Slack transcript text, Linear project URLs + status update narratives, and per-customer prompts are sent to Anthropic when you run `fetch-slack-insight` or `fetch-overall-sentiment`. Use `slack_insight.enabled` / `overall_sentiment.enabled` per customer and avoid secrets inside `prompt`.

**Long prompts:** Put main text in `customers/prompts/<slug>.md` (or any repo-relative path) via `slack_insight.prompt_file`; optional short `prompt` string in JSON is appended after the file content. The prompt file defines analysis rules and the **JSON shape** (`health`, `stakeholders`, `updates`, `signals`); the script validates and stores **`schema_version`: 2** plus accurate `sources` and `generated_at`.

**Slack permalinks in transcripts (optional):** Set `SLACK_WORKSPACE_SUBDOMAIN` (e.g. `your-workspace`) so each transcript line can include `Link: https://<subdomain>.slack.com/archives/C…/p…` for the model to cite in `url` fields.

**Slack channel config:** In `customers/*.json` you can list each channel as `#name` or as a **channel ID** (`C…`). IDs are resolved with a single `conversations.info` call instead of paginating `conversations.list`, which reduces rate limits (HTTP 429) on large workspaces.

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
SLACK_API_MIN_INTERVAL_MS=550   # optional; pause after each Slack API response (default 550; set 0 to disable)
SLACK_429_MAX_WAIT_MS=12000     # optional; cap wait when Slack returns HTTP 429 + Retry-After (default 12000 ms)
LIGHTDASH_API_KEY=              # unused in V1

# Slack insight + overall-sentiment jobs (scripts/fetch-slack-insight.ts, scripts/fetch-overall-sentiment.ts)
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=                # optional override (default claude-3-5-sonnet-20241022; shared by both jobs)
SLACK_WORKSPACE_SUBDOMAIN=      # optional; enables permalink suffixes on transcript lines for url fields
# slack_insight JSON (per customer): lookback_days; max_messages_per_channel (0 = unlimited); max_message_chars (0 = full text)
# overall_sentiment JSON (per customer): enabled; prompt_file (and/or prompt); lookback_days (default 60, applies to both Slack snapshot reuse + Linear status updates)
# Linear: `linear_projects` / `linear_initiatives` values must be Linear GraphQL **slugId** strings (short hex ids from the project/initiative URL or API), not long descriptive slugs.
```
