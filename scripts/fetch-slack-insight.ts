import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import {
  fetchSlackTranscriptsForInsight,
  type SlackInsightChannelTranscript,
} from "../src/lib/connectors/slack";
import { loadAllCustomerConfigs, loadCustomerConfig } from "../src/lib/customer-loader";
import type {
  CustomerConfig,
  SlackInsightHealthBlock,
  SlackInsightPayload,
  SlackInsightSignalKind,
  SlackInsightSignalRow,
  SlackInsightStakeholderRow,
  SlackInsightStakeholderSentiment,
  SlackInsightUpdateRow,
} from "../src/lib/types";
import { SLACK_INSIGHT_SCHEMA_VERSION } from "../src/lib/types";

const DATA_CUSTOMERS_DIR = path.resolve(process.cwd(), "data", "customers");

const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_MAX_MESSAGES_PER_CHANNEL = 300;
const DEFAULT_MAX_MESSAGE_CHARS = 3500;
const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";

/** Matches `customers/prompts/klarna_prompt.md` — model returns only these keys; pipeline merges metadata. */
const SYSTEM_PROMPT = `You are an analyst for account relationship intelligence.

Respond with exactly one JSON object and nothing else: no markdown code fences, no commentary before or after.

Your JSON must include only these root keys (matching the analytical instructions and Output schema in the user message):
- health: { "status": "green" | "yellow" | "red", "summary": string }
- stakeholders: array of { "name", "sentiment": "positive" | "neutral" | "negative" | "no_signal", "signal", "url": string | null }
- updates: array of { "summary", "url": string, "timestamp": "YYYY-MM-DD" } — max 3 items per user instructions unless user says otherwise
- signals: array of { "type": "warning" | "momentum" | "opportunity" | "change", "summary", "url": string | null } — max 5 items per user instructions unless user says otherwise

Rules:
- Follow counts, stakeholder list, and sentiment rules from the user message.
- Base claims on the Slack transcript in the user message only. If something is unknown, say so in the signal text or use no_signal / null url.
- Use null for url when you cannot form a valid permalink from the transcript lines (permalink hints may appear in the transcript section if configured).
- Do not include schema_version, generated_at, or sources in your output; the pipeline adds those.`;

function parseArgs(argv: string[]): { customer?: string; noCache: boolean; dryRun: boolean } {
  let customer: string | undefined;
  let noCache = false;
  let dryRun = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-cache") noCache = true;
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--customer" && argv[i + 1]) customer = argv[++i];
    else if (a.startsWith("--customer=")) customer = a.slice("--customer=".length);
  }
  return { customer, noCache, dryRun };
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function allSlackChannels(config: CustomerConfig): string[] {
  return [...config.slack_channels, ...config.revenue_lines.flatMap((rl) => rl.slack_channels)];
}

/** Resolves `prompt` and/or `prompt_file` (repo-relative or absolute path). */
function resolveSlackInsightPrompt(slug: string, insightCfg: NonNullable<CustomerConfig["slack_insight"]>): string {
  const parts: string[] = [];
  const root = process.cwd();

  if (insightCfg.prompt_file?.trim()) {
    const raw = insightCfg.prompt_file.trim();
    const abs = path.isAbsolute(raw) ? raw : path.join(root, raw);
    if (!fs.existsSync(abs)) {
      throw new Error(`[${slug}] slack_insight.prompt_file not found: ${abs}`);
    }
    parts.push(fs.readFileSync(abs, "utf-8").trim());
  }

  if (insightCfg.prompt?.trim()) {
    parts.push(insightCfg.prompt.trim());
  }

  if (parts.length === 0) {
    throw new Error(
      `[${slug}] slack_insight needs at least one of "prompt" or "prompt_file" when enabled`,
    );
  }

  return parts.join("\n\n");
}

function slackPermalink(
  workspaceSubdomain: string | undefined,
  channelId: string | null,
  ts: string,
): string | null {
  if (!workspaceSubdomain || !channelId || !ts) return null;
  const pTs = ts.replace(/\./g, "");
  return `https://${workspaceSubdomain}.slack.com/archives/${channelId}/p${pTs}`;
}

function formatTranscriptsForPrompt(transcripts: SlackInsightChannelTranscript[]): string {
  const subdomain = process.env.SLACK_WORKSPACE_SUBDOMAIN?.trim();
  const parts: string[] = [];
  for (const ch of transcripts) {
    parts.push(`## ${ch.channelName}${ch.channelId ? ` (channel_id=${ch.channelId})` : ""}`);
    if (ch.messages.length === 0) {
      parts.push("(no messages in window or channel not found)");
      parts.push("");
      continue;
    }
    for (const m of ch.messages) {
      const iso = new Date(parseFloat(m.ts) * 1000).toISOString();
      const link = slackPermalink(subdomain, ch.channelId, m.ts);
      const linkSuffix = link ? ` Link: ${link}` : "";
      parts.push(`[${iso}] ${m.author}: ${m.text}${linkSuffix}`);
    }
    parts.push("");
  }
  return parts.join("\n");
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

function parseHealth(raw: unknown): SlackInsightHealthBlock {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") {
    return { status: "yellow", summary: "" };
  }
  const s = o.status;
  const status =
    s === "green" || s === "yellow" || s === "red" ? s : "yellow";
  return { status, summary: typeof o.summary === "string" ? o.summary : "" };
}

function parseStakeholders(raw: unknown): SlackInsightStakeholderRow[] {
  if (!Array.isArray(raw)) return [];
  const sentiments: SlackInsightStakeholderSentiment[] = [
    "positive",
    "neutral",
    "negative",
    "no_signal",
  ];
  return raw.map((row): SlackInsightStakeholderRow => {
    const x = row as Record<string, unknown>;
    const sent = x.sentiment;
    const sentiment = sentiments.includes(sent as SlackInsightStakeholderSentiment)
      ? (sent as SlackInsightStakeholderSentiment)
      : "no_signal";
    const urlVal = x.url;
    return {
      name: typeof x.name === "string" ? x.name : "",
      sentiment,
      signal: typeof x.signal === "string" ? x.signal : "",
      url: urlVal === null || typeof urlVal === "string" ? (urlVal as string | null) : null,
    };
  });
}

function parseUpdates(raw: unknown): SlackInsightUpdateRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row): SlackInsightUpdateRow => {
    const x = row as Record<string, unknown>;
    return {
      summary: typeof x.summary === "string" ? x.summary : "",
      url: typeof x.url === "string" ? x.url : "",
      timestamp: typeof x.timestamp === "string" ? x.timestamp : "",
    };
  });
}

const SIGNAL_TYPES: SlackInsightSignalKind[] = ["warning", "momentum", "opportunity", "change"];

function parseSignals(raw: unknown): SlackInsightSignalRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row): SlackInsightSignalRow => {
    const x = row as Record<string, unknown>;
    const t = x.type;
    const type = SIGNAL_TYPES.includes(t as SlackInsightSignalKind)
      ? (t as SlackInsightSignalKind)
      : "warning";
    const urlVal = x.url;
    return {
      type,
      summary: typeof x.summary === "string" ? x.summary : "",
      url: urlVal === null || typeof urlVal === "string" ? (urlVal as string | null) : null,
    };
  });
}

function normalizePayload(
  raw: unknown,
  sources: SlackInsightPayload["sources"],
  generatedAt: string,
): SlackInsightPayload {
  const o = raw as Record<string, unknown>;
  return {
    schema_version: SLACK_INSIGHT_SCHEMA_VERSION,
    generated_at: generatedAt,
    sources,
    health: parseHealth(o.health),
    stakeholders: parseStakeholders(o.stakeholders),
    updates: parseUpdates(o.updates),
    signals: parseSignals(o.signals),
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
      "Fix invalid JSON. Return one valid JSON object only, no markdown fences. Root keys must be: health, stakeholders, updates, signals — as specified in the prior task.",
    messages: [
      {
        role: "user",
        content: `Repair this JSON:\n\n${invalid}`,
      },
    ],
  });
  return extractAssistantText(msg);
}

async function main() {
  const { customer, noCache, dryRun } = parseArgs(process.argv);

  const targets: { slug: string; config: CustomerConfig }[] = [];
  if (customer) {
    try {
      targets.push({ slug: customer, config: loadCustomerConfig(customer) });
    } catch {
      console.error(`Unknown customer slug: ${customer}`);
      process.exit(1);
    }
  } else {
    for (const { slug, config } of loadAllCustomerConfigs()) {
      targets.push({ slug, config });
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  if (!dryRun && !apiKey) {
    console.error("ANTHROPIC_API_KEY is required (unless --dry-run)");
    process.exit(1);
  }

  const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

  ensureDir(DATA_CUSTOMERS_DIR);

  for (const { slug, config } of targets) {
    const insightCfg = config.slack_insight;
    if (!insightCfg?.enabled) {
      console.log(`⏭  ${slug}: slack_insight disabled — skip`);
      continue;
    }

    const channels = allSlackChannels(config);
    if (channels.length === 0) {
      console.warn(`⚠️  ${slug}: no Slack channels configured — skip`);
      continue;
    }

    const lookback = insightCfg.lookback_days ?? DEFAULT_LOOKBACK_DAYS;
    const maxMsg = insightCfg.max_messages_per_channel ?? DEFAULT_MAX_MESSAGES_PER_CHANNEL;

    console.log(`\n📎 ${slug}: fetching transcripts (${channels.length} channel(s), ${lookback}d lookback)...`);

    const transcripts = await fetchSlackTranscriptsForInsight(channels, {
      lookbackDays: lookback,
      maxMessagesPerChannel: maxMsg,
      maxMessageChars: DEFAULT_MAX_MESSAGE_CHARS,
      noCache,
    });

    const sourcesAccurate: SlackInsightPayload["sources"] = transcripts.map((t) => ({
      channel: t.channelName,
      message_count: t.messages.length,
    }));

    if (dryRun) {
      console.log(`   [dry-run] channels: ${sourcesAccurate.map((s) => `${s.channel}=${s.message_count}`).join(", ")}`);
      continue;
    }

    const transcriptBlock = formatTranscriptsForPrompt(transcripts);
    const operatorPrompt = resolveSlackInsightPrompt(slug, insightCfg);
    const userContent = [
      `Customer account name: ${config.name}`,
      "",
      "Instructions from operator (source of truth for analysis and output expectations):",
      operatorPrompt,
      "",
      "--- Slack transcripts (channels match customers/<slug>.json slack configuration) ---",
      transcriptBlock,
    ].join("\n");

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
    const payload = normalizePayload(parsed, sourcesAccurate, generatedAt);

    const outPath = path.join(DATA_CUSTOMERS_DIR, `${slug}.slack-insight.json`);
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
    console.log(`✅ ${slug}: wrote ${outPath}`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
