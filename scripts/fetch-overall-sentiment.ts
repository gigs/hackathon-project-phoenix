import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import {
  fetchHubSpotData,
  type HubSpotDataForCustomer,
} from "../src/lib/connectors/hubspot";
import {
  fetchLinearInsightContext,
  type LinearInsightContext,
} from "../src/lib/connectors/linear";
import {
  fetchSlackTranscriptsForInsight,
  type SlackInsightChannelTranscript,
} from "../src/lib/connectors/slack";
import { loadAllCustomerConfigs, loadCustomerConfig } from "../src/lib/customer-loader";
import {
  buildFallbackAccountBrief,
  currentArr,
  currentLines,
  customerDailySeries,
} from "../src/lib/customer-intelligence";
import { loadCustomerData } from "../src/lib/data-loader";
import {
  formatLinearRawJsonForPrompt,
  formatTranscriptsForPrompt,
  loadTranscriptSnapshot,
  saveTranscriptSnapshot,
  TRANSCRIPT_SNAPSHOT_VERSION,
  transcriptSnapshotPath,
} from "../src/lib/insight-format";
import type {
  AccountBriefPayload,
  AccountBriefPoint,
  AccountBriefRisk,
  AccountBriefSource,
  CustomerData,
  CustomerConfig,
  OverallSentimentPayload,
  OverallSentimentSignal,
  OverallSentimentSource,
  OverallSentimentSources,
} from "../src/lib/types";
import {
  ACCOUNT_BRIEF_SCHEMA_VERSION,
  OVERALL_SENTIMENT_SCHEMA_VERSION,
} from "../src/lib/types";

const DATA_CUSTOMERS_DIR = path.resolve(process.cwd(), "data", "customers");
const DEFAULT_LOOKBACK_DAYS = 60;
const DEFAULT_MODEL = "claude-opus-4-7";

/**
 * Mirrors `customers/prompts/<slug>.overall-sentiment.md` Output schema —
 * model returns only these keys; pipeline merges metadata.
 */
const SYSTEM_PROMPT = `You are an analyst on a customer success team summarizing the relational texture of an account relationship.

Respond with exactly one JSON object and nothing else: no markdown code fences, no commentary before or after.

Your JSON must include only these root keys (matching the analytical instructions and Output schema in the user message):
- summary: string — one sentence on the current overall sentiment of the relationship
- momentum_signals: array of { "summary": string, "source": "slack" | "linear", "url": string | null } — exactly 3 items
- warning_signs: array of { "summary": string, "source": "slack" | "linear", "url": string | null } — exactly 3 items

Rules:
- Follow the prompt in the user message for what counts as a momentum vs warning signal.
- Base every claim on the Linear and Slack content in the user message only. The Linear section is a complete JSON export (not a summary). Do not invent URLs, quotes, stakeholders, or events.
- Use null for url only when the prompt explicitly allows it (e.g., silence-based warnings).
- Do not include schema_version, generated_at, sources, or lookback_days in your output; the pipeline adds those.`;

const ACCOUNT_BRIEF_SYSTEM_PROMPT = `You are building a compact executive customer brief for a dashboard.

Respond with exactly one JSON object and nothing else.

Your JSON must include only these root keys:
- headline: string
- confidence: number (0-100)
- why_now: array of { "summary": string, "source": "slack" | "linear" | "hubspot" | "arr" | "derived", "url": string | null }
- top_risks: array of { "summary": string, "severity": "high" | "medium" | "low", "source": "slack" | "linear" | "hubspot" | "arr" | "derived", "url": string | null }
- next_milestone: { "label": string, "date": string | null, "owner": string | null, "source": "slack" | "linear" | "hubspot" | "arr" | "derived", "url": string | null } | null
- commercial_state: string
- delivery_state: string
- stakeholder_state: string
- citations: array of { "label": string, "source": "slack" | "linear" | "hubspot" | "arr" | "derived", "url": string | null }

Rules:
- Optimize for first-glance dashboard use. Short, specific, and grounded.
- Use the account summary, Slack transcript context, Linear JSON export, HubSpot/deal context, and ARR context in the user message only.
- Confidence should reflect evidence density, not optimism.
- Prefer concrete milestones, dates, and tracked issues over generic commentary.
- Do not include markdown or explanation outside the JSON object.`;

interface ParsedArgs {
  customer?: string;
  noCache: boolean;
  dryRun: boolean;
  fetchSlack: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  let customer: string | undefined;
  let noCache = false;
  let dryRun = false;
  let fetchSlack = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-cache") noCache = true;
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--fetch-slack") fetchSlack = true;
    else if (a === "--customer" && argv[i + 1]) customer = argv[++i];
    else if (a.startsWith("--customer=")) customer = a.slice("--customer=".length);
  }
  return { customer, noCache, dryRun, fetchSlack };
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function allSlackChannels(config: CustomerConfig): string[] {
  return [...config.slack_channels, ...config.revenue_lines.flatMap((rl) => rl.slack_channels)];
}

function resolvePrompt(slug: string, cfg: NonNullable<CustomerConfig["overall_sentiment"]>): string {
  const parts: string[] = [];
  const root = process.cwd();

  if (cfg.prompt_file?.trim()) {
    const raw = cfg.prompt_file.trim();
    const abs = path.isAbsolute(raw) ? raw : path.join(root, raw);
    if (!fs.existsSync(abs)) {
      throw new Error(`[${slug}] overall_sentiment.prompt_file not found: ${abs}`);
    }
    parts.push(fs.readFileSync(abs, "utf-8").trim());
  }

  if (cfg.prompt?.trim()) parts.push(cfg.prompt.trim());

  if (parts.length === 0) {
    throw new Error(
      `[${slug}] overall_sentiment needs at least one of "prompt" or "prompt_file" when enabled`,
    );
  }
  return parts.join("\n\n");
}

function stripJsonFence(text: string): string {
  let t = text.trim();
  const block = /^```(?:json)?\s*\n?([\s\S]*?)```$/m.exec(t);
  if (block) t = block[1].trim();
  return t;
}

function extractAssistantText(message: Anthropic.Message): string {
  return message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

function parseSource(raw: unknown): OverallSentimentSource {
  return raw === "linear" ? "linear" : "slack";
}

function parseAccountBriefSource(raw: unknown): AccountBriefSource {
  return raw === "linear" || raw === "hubspot" || raw === "arr" || raw === "derived"
    ? raw
    : "slack";
}

const SIGNALS_EACH = 3;

function parseSignalArray(raw: unknown): OverallSentimentSignal[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row): OverallSentimentSignal => {
    const x = row as Record<string, unknown>;
    const urlVal = x.url;
    return {
      summary: typeof x.summary === "string" ? x.summary : "",
      source: parseSource(x.source),
      url: urlVal === null || typeof urlVal === "string" ? (urlVal as string | null) : null,
    };
  });
}

/** Exactly three cards per column for the dashboard; trim overflow, pad undershoot with grounded slack rows. */
function ensureExactlyThreeSignals(
  signals: OverallSentimentSignal[],
  kind: "momentum" | "warning",
): OverallSentimentSignal[] {
  const trimmed = signals.slice(0, SIGNALS_EACH);
  const padSummary =
    kind === "momentum"
      ? "No additional distinct positive relational signal is documented in the sources for this window."
      : "No additional distinct caution signal is documented in the sources for this window.";
  while (trimmed.length < SIGNALS_EACH) {
    trimmed.push({ summary: padSummary, source: "slack", url: null });
  }
  return trimmed;
}

function normalizePayload(
  raw: unknown,
  sources: OverallSentimentSources,
  lookbackDays: number,
  generatedAt: string,
): OverallSentimentPayload {
  const o = (raw as Record<string, unknown>) ?? {};
  return {
    schema_version: OVERALL_SENTIMENT_SCHEMA_VERSION,
    generated_at: generatedAt,
    lookback_days: lookbackDays,
    sources,
    summary: typeof o.summary === "string" ? o.summary : "",
    momentum_signals: ensureExactlyThreeSignals(parseSignalArray(o.momentum_signals), "momentum"),
    warning_signs: ensureExactlyThreeSignals(parseSignalArray(o.warning_signs), "warning"),
  };
}

function parseBriefPoints(raw: unknown): AccountBriefPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const x = (row as Record<string, unknown>) ?? {};
    return {
      summary: typeof x.summary === "string" ? x.summary : "",
      source: parseAccountBriefSource(x.source),
      url: x.url === null || typeof x.url === "string" ? (x.url as string | null) : null,
    };
  });
}

function parseBriefRisks(raw: unknown): AccountBriefRisk[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const x = (row as Record<string, unknown>) ?? {};
    const severity = x.severity === "low" || x.severity === "medium" ? x.severity : "high";
    return {
      summary: typeof x.summary === "string" ? x.summary : "",
      severity,
      source: parseAccountBriefSource(x.source),
      url: x.url === null || typeof x.url === "string" ? (x.url as string | null) : null,
    };
  });
}

function normalizeAccountBrief(
  raw: unknown,
  lookbackDays: number,
  generatedAt: string,
): AccountBriefPayload {
  const o = (raw as Record<string, unknown>) ?? {};
  const milestoneRaw = (o.next_milestone as Record<string, unknown> | null) ?? null;
  const milestone =
    milestoneRaw && typeof milestoneRaw.label === "string"
      ? {
          label: milestoneRaw.label,
          date:
            milestoneRaw.date === null || typeof milestoneRaw.date === "string"
              ? (milestoneRaw.date as string | null)
              : null,
          owner:
            milestoneRaw.owner === null || typeof milestoneRaw.owner === "string"
              ? (milestoneRaw.owner as string | null)
              : null,
          source: parseAccountBriefSource(milestoneRaw.source),
          url:
            milestoneRaw.url === null || typeof milestoneRaw.url === "string"
              ? (milestoneRaw.url as string | null)
              : null,
        }
      : null;

  return {
    schema_version: ACCOUNT_BRIEF_SCHEMA_VERSION,
    generated_at: generatedAt,
    lookback_days: lookbackDays,
    headline: typeof o.headline === "string" ? o.headline : "",
    confidence:
      typeof o.confidence === "number"
        ? Math.max(0, Math.min(100, Math.round(o.confidence)))
        : 65,
    why_now: parseBriefPoints(o.why_now),
    top_risks: parseBriefRisks(o.top_risks),
    next_milestone: milestone,
    commercial_state: typeof o.commercial_state === "string" ? o.commercial_state : "",
    delivery_state: typeof o.delivery_state === "string" ? o.delivery_state : "",
    stakeholder_state: typeof o.stakeholder_state === "string" ? o.stakeholder_state : "",
    citations: parseBriefPoints(o.citations).map((row) => ({
      label: row.summary,
      source: row.source,
      url: row.url,
    })),
  };
}

async function callAnthropicJson(
  anthropic: Anthropic,
  model: string,
  userContent: string,
): Promise<string> {
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });
  return extractAssistantText(msg);
}

async function repairJson(anthropic: Anthropic, model: string, invalid: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 8192,
    system:
      "Fix invalid JSON. Return one valid JSON object only, no markdown fences. Root keys must be: summary, momentum_signals, warning_signs — momentum_signals and warning_signs must each contain exactly 3 objects.",
    messages: [{ role: "user", content: `Repair this JSON:\n\n${invalid}` }],
  });
  return extractAssistantText(msg);
}

function buildAccountDataBlock(
  slug: string,
  config: CustomerConfig,
  customerData: CustomerData | null,
  hubspot: HubSpotDataForCustomer | null,
): string {
  const companyName = hubspot?.companyName ?? config.name;
  const lines = customerData?.deals.map((deal) => {
    const parts = [
      `- ${deal.label}`,
      `health=${deal.health}`,
      `hubspot_stage=${deal.hubspotStage ?? "none"}`,
      `arr=${deal.arr ?? "n/a"}`,
      `activations=${deal.activations ?? "n/a"}`,
      `owner=${deal.dri ?? deal.dealOwner ?? "unknown"}`,
      `go_live=${deal.goLiveDate ?? "n/a"}`,
      `issues=${deal.linearIssueCount}`,
    ];
    return parts.join(" | ");
  }) ?? [];

  const arrPoints = customerData
    ? customerDailySeries(customerData)
        .slice(-4)
        .map((point) => `- ${point.date}: arr=${point.arr} lines=${point.lines}`)
    : [];

  return [
    `Customer slug: ${slug}`,
    `Customer name: ${config.name}`,
    `HubSpot company: ${companyName}`,
    customerData
      ? `Current ARR: ${currentArr(customerData) ?? "n/a"} | Current lines: ${currentLines(customerData) ?? "n/a"} | Overall health: ${customerData.health}`
      : "Customer aggregate data unavailable.",
    "",
    "Tracked deals / markets:",
    lines.length > 0 ? lines.join("\n") : "- none",
    "",
    "Recent ARR points:",
    arrPoints.length > 0 ? arrPoints.join("\n") : "- none",
  ].join("\n");
}

function buildLinearSourceCounts(context: LinearInsightContext): OverallSentimentSources["linear"] {
  let updates = 0;
  let initiativeUpdates = 0;
  let milestones = 0;
  let flagged = 0;
  for (const init of context.initiatives) {
    initiativeUpdates += init.initiativeUpdates.length;
  }
  for (const p of context.projects) {
    updates += p.statusUpdates.length;
    milestones += p.milestones.length;
    flagged += p.flaggedIssues.length;
  }
  return {
    initiatives: context.initiatives.length,
    projects: context.projects.length,
    status_updates: updates,
    initiative_updates: initiativeUpdates,
    milestones,
    flagged_issues: flagged,
  };
}

async function loadOrFetchTranscripts(
  slug: string,
  config: CustomerConfig,
  lookbackDays: number,
  fetchSlack: boolean,
  noCache: boolean,
): Promise<{ transcripts: SlackInsightChannelTranscript[]; channels: string[]; from: "snapshot" | "live" }> {
  const channels = allSlackChannels(config);
  const snap = loadTranscriptSnapshot(slug);
  if (snap && !fetchSlack) {
    return { transcripts: snap.transcripts, channels: snap.channels, from: "snapshot" };
  }

  if (!fetchSlack) {
    throw new Error(
      `[${slug}] no Slack transcript snapshot at ${transcriptSnapshotPath(slug)}. Run \`npm run fetch-slack-insight -- --customer ${slug}\` first, or pass --fetch-slack to this script.`,
    );
  }

  if (channels.length === 0) {
    throw new Error(`[${slug}] --fetch-slack passed but no Slack channels configured`);
  }

  console.log(
    `   📎 fetching Slack transcripts inline (${channels.length} channel(s), ${lookbackDays}d lookback)...`,
  );
  const transcripts = await fetchSlackTranscriptsForInsight(channels, {
    lookbackDays,
    maxMessagesPerChannel: 0,
    maxMessageChars: 0,
    noCache,
  });
  saveTranscriptSnapshot({
    schema_version: TRANSCRIPT_SNAPSHOT_VERSION,
    generated_at: new Date().toISOString(),
    customer_slug: slug,
    customer_name: config.name,
    lookback_days: lookbackDays,
    channels,
    transcripts,
  });
  return { transcripts, channels, from: "live" };
}

async function processCustomer(
  slug: string,
  config: CustomerConfig,
  args: ParsedArgs,
  anthropic: Anthropic | null,
  model: string,
) {
  const cfg = config.overall_sentiment;
  if (!cfg?.enabled) {
    console.log(`⏭  ${slug}: overall_sentiment disabled — skip`);
    return;
  }

  const lookback = cfg.lookback_days ?? DEFAULT_LOOKBACK_DAYS;

  const { transcripts, from } = await loadOrFetchTranscripts(
    slug,
    config,
    lookback,
    args.fetchSlack,
    args.noCache,
  );
  console.log(
    `\n🧭 ${slug}: building overall sentiment (Slack ${from}, ${transcripts.length} channel(s); ${lookback}d lookback)...`,
  );

  const linearResult = await fetchLinearInsightContext({
    projectSlugs: config.linear_projects,
    initiativeSlugs: config.linear_initiatives,
    lookbackDays: lookback,
    noCache: args.noCache,
  });

  if (linearResult.error) {
    console.warn(`   ⚠️ Linear context fetch had errors: ${linearResult.error}`);
  }
  const linearContext: LinearInsightContext = linearResult.data ?? {
    initiatives: [],
    projects: [],
    unaffiliatedProjectSlugIds: [],
  };

  const sources: OverallSentimentSources = {
    slack: transcripts.map((t) => ({ channel: t.channelName, message_count: t.messages.length })),
    linear: buildLinearSourceCounts(linearContext),
  };

  const linearBlock = formatLinearRawJsonForPrompt(linearContext);
  const slackBlock = formatTranscriptsForPrompt(transcripts);
  const operatorPrompt = resolvePrompt(slug, cfg);
  const customerData = loadCustomerData(slug);
  const hubspotSummary = customerData
    ? null
    : (await fetchHubSpotData(
        config.revenue_lines.flatMap((line) => line.hubspot_deal_record_ids),
        config.hubspot_company_record_id,
        args.noCache,
      )).data;
  const accountDataBlock = buildAccountDataBlock(slug, config, customerData, hubspotSummary);

  const userContent = [
    `Customer account name: ${config.name}`,
    `Slack transcript lookback: ${lookback} days. Linear below is a full API export as JSON (not trimmed to that window).`,
    "",
    "Instructions from operator (source of truth for analysis and output expectations):",
    operatorPrompt,
    "",
    "--- Linear (complete JSON export for configured initiatives + projects) ---",
    linearBlock,
    "--- Slack transcripts (channels match customers/<slug>.json slack configuration) ---",
    slackBlock,
  ].join("\n");

  if (args.dryRun) {
    const slackChars = slackBlock.length;
    const linearChars = linearBlock.length;
    console.log(
      `   [dry-run] Slack: ${sources.slack.map((s) => `${s.channel}=${s.message_count}`).join(", ") || "(none)"}`,
    );
    console.log(
      `   [dry-run] Linear: ${sources.linear.initiatives} initiative(s), ${sources.linear.projects} project(s), ${sources.linear.initiative_updates} initiative update(s), ${sources.linear.status_updates} project update(s), ${sources.linear.milestones} milestone(s), ${sources.linear.flagged_issues} flagged issue(s)`,
    );
    console.log(`   [dry-run] prompt blocks: linear=${linearChars} chars, slack=${slackChars} chars`);
    return;
  }

  if (!anthropic) throw new Error("Anthropic client missing");

  let rawText = await callAnthropicJson(anthropic, model, userContent);
  let jsonStr = stripJsonFence(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.warn(`  ${slug}: JSON parse failed — attempting repair`);
    rawText = await repairJson(anthropic, model, jsonStr);
    jsonStr = stripJsonFence(rawText);
    parsed = JSON.parse(jsonStr);
  }

  const generatedAt = new Date().toISOString();
  const payload = normalizePayload(parsed, sources, lookback, generatedAt);
  const fallbackBrief = customerData
    ? buildFallbackAccountBrief(customerData, payload, null)
    : null;
  const accountBriefContent = [
    `Customer account name: ${config.name}`,
    `Lookback window: ${lookback} days`,
    "",
    "--- Account summary (aggregated customer JSON + HubSpot + ARR) ---",
    accountDataBlock,
    "",
    "--- Existing relationship summary ---",
    `Headline: ${payload.summary}`,
    `Momentum: ${payload.momentum_signals.map((signal) => signal.summary).join(" | ") || "none"}`,
    `Risks: ${payload.warning_signs.map((signal) => signal.summary).join(" | ") || "none"}`,
    "",
    "--- Linear (complete JSON export) ---",
    linearBlock,
    "--- Slack transcripts ---",
    slackBlock,
  ].join("\n");

  let accountBriefPayload: AccountBriefPayload | null = null;
  try {
    let rawBriefText = await anthropic.messages
      .create({
        model,
        max_tokens: 8192,
        system: ACCOUNT_BRIEF_SYSTEM_PROMPT,
        messages: [{ role: "user", content: accountBriefContent }],
      })
      .then(extractAssistantText);
    let briefJson = stripJsonFence(rawBriefText);
    let briefParsed: unknown;
    try {
      briefParsed = JSON.parse(briefJson);
    } catch {
      rawBriefText = await repairJson(anthropic, model, briefJson);
      briefJson = stripJsonFence(rawBriefText);
      briefParsed = JSON.parse(briefJson);
    }
    accountBriefPayload = normalizeAccountBrief(briefParsed, lookback, generatedAt);
  } catch (error) {
    if (fallbackBrief) {
      console.warn(`  ${slug}: account brief generation failed — using deterministic fallback`);
      accountBriefPayload = fallbackBrief;
    } else {
      throw error;
    }
  }

  const outPath = path.join(DATA_CUSTOMERS_DIR, `${slug}.overall-sentiment.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`✅ ${slug}: wrote ${outPath}`);
  if (accountBriefPayload) {
    const briefPath = path.join(DATA_CUSTOMERS_DIR, `${slug}.account-brief.json`);
    fs.writeFileSync(briefPath, JSON.stringify(accountBriefPayload, null, 2), "utf-8");
    console.log(`✅ ${slug}: wrote ${briefPath}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);

  const targets: { slug: string; config: CustomerConfig }[] = [];
  if (args.customer) {
    try {
      targets.push({ slug: args.customer, config: loadCustomerConfig(args.customer) });
    } catch {
      console.error(`Unknown customer slug: ${args.customer}`);
      process.exit(1);
    }
  } else {
    for (const { slug, config } of loadAllCustomerConfigs()) targets.push({ slug, config });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  if (!args.dryRun && !apiKey) {
    console.error("ANTHROPIC_API_KEY is required (unless --dry-run)");
    process.exit(1);
  }

  const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
  ensureDir(DATA_CUSTOMERS_DIR);

  let hadError = false;
  for (const { slug, config } of targets) {
    try {
      await processCustomer(slug, config, args, anthropic, model);
    } catch (e) {
      hadError = true;
      console.error(`❌ ${slug}: ${(e as Error).message}`);
    }
  }

  console.log("\nDone.");
  if (hadError) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
