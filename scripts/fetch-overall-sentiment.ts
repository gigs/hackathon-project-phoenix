import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
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
  formatLinearInsightForPrompt,
  formatTranscriptsForPrompt,
  loadTranscriptSnapshot,
  saveTranscriptSnapshot,
  TRANSCRIPT_SNAPSHOT_VERSION,
  transcriptSnapshotPath,
} from "../src/lib/insight-format";
import type {
  CustomerConfig,
  OverallSentimentPayload,
  OverallSentimentSignal,
  OverallSentimentSource,
  OverallSentimentSources,
} from "../src/lib/types";
import { OVERALL_SENTIMENT_SCHEMA_VERSION } from "../src/lib/types";

const DATA_CUSTOMERS_DIR = path.resolve(process.cwd(), "data", "customers");
const DEFAULT_LOOKBACK_DAYS = 60;
const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";

/**
 * Mirrors `customers/prompts/<slug>.overall-sentiment.md` Output schema —
 * model returns only these keys; pipeline merges metadata.
 */
const SYSTEM_PROMPT = `You are an analyst on a customer success team summarizing the relational texture of an account relationship.

Respond with exactly one JSON object and nothing else: no markdown code fences, no commentary before or after.

Your JSON must include only these root keys (matching the analytical instructions and Output schema in the user message):
- summary: string — one sentence on the current overall sentiment of the relationship
- momentum_signals: array of { "summary": string, "source": "slack" | "linear", "url": string | null } — 0–5 items
- warning_signs: array of { "summary": string, "source": "slack" | "linear", "url": string | null } — 0–5 items

Rules:
- Follow the prompt in the user message for what counts as a momentum vs warning signal.
- Base every claim on the Linear and Slack content in the user message only. Do not invent URLs, quotes, stakeholders, or events.
- Use null for url only when the prompt explicitly allows it (e.g., silence-based warnings).
- Do not include schema_version, generated_at, sources, or lookback_days in your output; the pipeline adds those.`;

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
    momentum_signals: parseSignalArray(o.momentum_signals),
    warning_signs: parseSignalArray(o.warning_signs),
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
      "Fix invalid JSON. Return one valid JSON object only, no markdown fences. Root keys must be: summary, momentum_signals, warning_signs — as specified in the prior task.",
    messages: [{ role: "user", content: `Repair this JSON:\n\n${invalid}` }],
  });
  return extractAssistantText(msg);
}

function buildLinearSourceCounts(context: LinearInsightContext): OverallSentimentSources["linear"] {
  let updates = 0;
  let flagged = 0;
  for (const p of context.projects) {
    updates += p.statusUpdates.length;
    flagged += p.flaggedIssues.length;
  }
  return {
    initiatives: context.initiatives.length,
    projects: context.projects.length,
    status_updates: updates,
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

  const linearBlock = formatLinearInsightForPrompt(linearContext);
  const slackBlock = formatTranscriptsForPrompt(transcripts);
  const operatorPrompt = resolvePrompt(slug, cfg);

  const userContent = [
    `Customer account name: ${config.name}`,
    `Lookback window: ${lookback} days (Slack and Linear)`,
    "",
    "Instructions from operator (source of truth for analysis and output expectations):",
    operatorPrompt,
    "",
    "--- Linear context (initiatives, projects, status updates, flagged issues) ---",
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
      `   [dry-run] Linear: ${sources.linear.initiatives} initiative(s), ${sources.linear.projects} project(s), ${sources.linear.status_updates} status update(s), ${sources.linear.flagged_issues} flagged issue(s)`,
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

  const outPath = path.join(DATA_CUSTOMERS_DIR, `${slug}.overall-sentiment.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`✅ ${slug}: wrote ${outPath}`);
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
