import fs from "fs";
import path from "path";
import type { SlackInsightChannelTranscript } from "./connectors/slack";
import type { LinearInsightContext } from "./connectors/linear";

/**
 * Shared between `fetch-slack-insight` and `fetch-overall-sentiment`.
 *
 * Both scripts need to:
 *   - Save and load the per-customer Slack transcript snapshot.
 *   - Format Slack transcripts into the markdown block the prompts expect.
 *
 * `fetch-overall-sentiment` additionally formats Linear context.
 */

export const TRANSCRIPT_SNAPSHOT_VERSION = 1 as const;

export interface TranscriptSnapshotV1 {
  schema_version: typeof TRANSCRIPT_SNAPSHOT_VERSION;
  generated_at: string;
  customer_slug: string;
  customer_name: string;
  lookback_days: number;
  channels: string[];
  transcripts: SlackInsightChannelTranscript[];
}

const DATA_CUSTOMERS_DIR = path.resolve(process.cwd(), "data", "customers");

export function transcriptSnapshotPath(slug: string): string {
  return path.join(DATA_CUSTOMERS_DIR, `${slug}.slack-transcript.json`);
}

export function saveTranscriptSnapshot(snap: TranscriptSnapshotV1): string {
  if (!fs.existsSync(DATA_CUSTOMERS_DIR)) {
    fs.mkdirSync(DATA_CUSTOMERS_DIR, { recursive: true });
  }
  const out = transcriptSnapshotPath(snap.customer_slug);
  fs.writeFileSync(out, JSON.stringify(snap, null, 2), "utf-8");
  return out;
}

export function loadTranscriptSnapshot(slug: string): TranscriptSnapshotV1 | null {
  const p = transcriptSnapshotPath(slug);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (parsed?.schema_version !== TRANSCRIPT_SNAPSHOT_VERSION) return null;
    return parsed as TranscriptSnapshotV1;
  } catch {
    return null;
  }
}

export function slackPermalink(
  workspaceSubdomain: string | undefined,
  channelId: string | null,
  ts: string,
): string | null {
  if (!workspaceSubdomain || !channelId || !ts) return null;
  const pTs = ts.replace(/\./g, "");
  return `https://${workspaceSubdomain}.slack.com/archives/${channelId}/p${pTs}`;
}

/** Identical format consumed by both prompts; subdomain falls back to env. */
export function formatTranscriptsForPrompt(
  transcripts: SlackInsightChannelTranscript[],
  workspaceSubdomain?: string,
): string {
  const subdomain = workspaceSubdomain ?? process.env.SLACK_WORKSPACE_SUBDOMAIN?.trim();
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
      const threadPrefix = m.thread_parent_ts
        ? `[thread reply → ${m.thread_parent_ts}] `
        : "";
      parts.push(`${threadPrefix}[${iso}] ${m.author}: ${m.text}${linkSuffix}`);
    }
    parts.push("");
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Linear formatting
// ---------------------------------------------------------------------------

function indent(text: string, prefix = "  "): string {
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? line : prefix + line))
    .join("\n");
}

function shortIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

/**
 * Renders the Linear context as a single markdown block grouped by initiative,
 * with an "Unaffiliated projects" section for any configured projects that
 * don't roll up to a configured initiative.
 *
 * Mirrors the prose shape the prompt expects (see customers/prompts/<slug>.overall-sentiment.md).
 */
export function formatLinearInsightForPrompt(context: LinearInsightContext): string {
  const projectBySlug = new Map(context.projects.map((p) => [p.slugId, p]));
  const blocks: string[] = [];

  for (const init of context.initiatives) {
    const head = `# Initiative: ${init.name}${init.status ? ` — status ${init.status}` : ""}`;
    const lines: string[] = [head, `Linear: ${init.url}`, ""];

    if (init.projectSlugIds.length === 0) {
      lines.push("(no configured projects roll up to this initiative)");
      lines.push("");
    } else {
      for (const slug of init.projectSlugIds) {
        const project = projectBySlug.get(slug);
        if (!project) continue;
        lines.push(formatProjectBlock(project));
      }
    }
    blocks.push(lines.join("\n").trimEnd());
  }

  if (context.unaffiliatedProjectSlugIds.length > 0) {
    const lines: string[] = ["# Unaffiliated projects", ""];
    for (const slug of context.unaffiliatedProjectSlugIds) {
      const project = projectBySlug.get(slug);
      if (!project) continue;
      lines.push(formatProjectBlock(project));
    }
    blocks.push(lines.join("\n").trimEnd());
  }

  return blocks.join("\n\n").trim() + "\n";
}

function formatProjectBlock(project: {
  slugId: string;
  name: string;
  url: string;
  state: string;
  health: string | null;
  statusUpdates: { url: string; createdAt: string; health: string | null; author: string | null; body: string }[];
  flaggedIssues: { identifier: string; title: string; state: string; url: string; assignee: string | null }[];
}): string {
  const headerBits = [`state ${project.state}`];
  if (project.health) headerBits.push(`health ${project.health}`);
  const lines: string[] = [
    `## Project: ${project.name} (${project.slugId})`,
    `Linear: ${project.url}`,
    `Status: ${headerBits.join(", ")}`,
    "",
  ];

  if (project.statusUpdates.length === 0) {
    lines.push("Status updates in window: (none)");
  } else {
    lines.push(`Status updates (${project.statusUpdates.length}, newest first):`);
    for (const u of project.statusUpdates) {
      const meta = [shortIso(u.createdAt)];
      if (u.health) meta.push(`health ${u.health}`);
      if (u.author) meta.push(`by ${u.author}`);
      lines.push(`- ${meta.join(" · ")} — ${u.url}`);
      if (u.body.trim().length > 0) {
        lines.push(indent(u.body.trim(), "    "));
      }
    }
  }

  lines.push("");

  if (project.flaggedIssues.length === 0) {
    lines.push("Flagged issues: (none)");
  } else {
    lines.push(`Flagged issues (${project.flaggedIssues.length}):`);
    for (const issue of project.flaggedIssues) {
      const assignee = issue.assignee ? ` · ${issue.assignee}` : "";
      lines.push(
        `- ${issue.identifier} [${issue.state}]${assignee} — ${issue.title} (${issue.url})`,
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}
