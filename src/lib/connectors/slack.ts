import { readCache, writeCache } from "../cache";
import type { ConnectorResult, SlackActivityData, SlackChannelActivity } from "../types";

interface SlackChannel {
  id: string;
  name: string;
}

export interface SlackInsightTranscriptOptions {
  lookbackDays: number;
  /** `0` = no cap (all messages in the lookback window, after thread merge). */
  maxMessagesPerChannel: number;
  /** `0` = no truncation (full Slack text / file placeholder). */
  maxMessageChars: number;
  noCache: boolean;
}

export interface SlackInsightMessage {
  ts: string;
  author: string;
  text: string;
  /** Present when this row is a reply inside a thread (`thread_ts` ≠ this message `ts`). */
  thread_parent_ts?: string;
}

export interface SlackInsightChannelTranscript {
  channelName: string;
  /** Set when the channel was resolved; used for optional permalink lines in prompts. */
  channelId: string | null;
  messages: SlackInsightMessage[];
}

/** Channel meta / system events only — not `bot_message` (many external channels are bot-heavy). */
const INSIGHT_SKIP_SUBTYPES = new Set([
  "channel_join",
  "channel_leave",
  "channel_topic",
  "channel_purpose",
  "channel_name",
  "channel_archive",
  "channel_unarchive",
]);

/** Pause after each Slack Web API response to reduce 429s (set `SLACK_API_MIN_INTERVAL_MS=0` to disable). */
function slackApiMinIntervalMs(): number {
  const raw = process.env.SLACK_API_MIN_INTERVAL_MS;
  if (raw === "0") return 0;
  const n = parseInt(raw ?? "550", 10);
  return Number.isFinite(n) && n >= 0 ? n : 550;
}

async function slackApiPause(): Promise<void> {
  const ms = slackApiMinIntervalMs();
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

/** Upper bound for HTTP 429 wait (Slack often sends Retry-After: 30). Full value still respected up to this cap. */
function slack429MaxWaitMs(): number {
  const raw = process.env.SLACK_429_MAX_WAIT_MS;
  const n = parseInt(raw ?? "12000", 10);
  return Number.isFinite(n) && n >= 1000 ? n : 12000;
}

async function slackFetch<T>(
  method: string,
  params: Record<string, string> = {},
  attempt = 0,
): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");

  const url = new URL(`https://slack.com/api/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  /* HTTP 429 — wait and retry (Tier-based limits); dry-run / production behave the same. */
  const max429 = 8;
  if (res.status === 429 && attempt < max429) {
    await res.text(); // drain body before retrying
    const ra = res.headers.get("retry-after");
    const secs = ra ? parseInt(ra, 10) : Math.min(3 + attempt * 2, 60);
    const requested = Number.isFinite(secs) ? secs * 1000 : 5000;
    const ms = Math.min(requested, slack429MaxWaitMs());
    console.warn(
      `  [slack] HTTP 429 on ${method} — backing off ${Math.round(ms / 1000)}s (attempt ${attempt + 1}/${max429})`,
    );
    await new Promise((r) => setTimeout(r, ms));
    await slackApiPause();
    return slackFetch<T>(method, params, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Slack API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Slack API error: ${json.error}`);
  }

  await slackApiPause();
  return json as T;
}

/** Slack channel IDs start with C; avoids heavy conversations.list pagination (fewer 429s). */
export function looksLikeSlackChannelId(nameOrId: string): boolean {
  const s = nameOrId.replace(/^#/, "");
  return /^C[A-Z0-9]{8,}$/.test(s);
}

export async function resolveSlackChannelId(channelName: string, noCache: boolean): Promise<string | null> {
  const cleanName = channelName.replace(/^#/, "");
  const cacheKey = `channel-id-${cleanName}`;

  if (!noCache) {
    const cached = readCache<string>("slack", cacheKey);
    if (cached) return cached;
  }

  /* Direct channel ID — validate with conversations.info (one call vs paginated list). */
  if (looksLikeSlackChannelId(cleanName)) {
    try {
      await slackFetch<{ channel?: { id: string } }>("conversations.info", {
        channel: cleanName,
      });
      if (!noCache) writeCache("slack", cacheKey, cleanName);
      return cleanName;
    } catch (e) {
      console.warn(`  [slack] conversations.info failed for ${cleanName}:`, (e as Error).message);
      return null;
    }
  }

  try {
    // Paginate through channels to find the one we need
    let cursor = "";
    do {
      const params: Record<string, string> = { types: "public_channel,private_channel", limit: "200" };
      if (cursor) params.cursor = cursor;

      const data = await slackFetch<{
        channels: SlackChannel[];
        response_metadata?: { next_cursor?: string };
      }>("conversations.list", params);

      const found = data.channels.find((ch) => ch.name === cleanName);
      if (found) {
        writeCache("slack", cacheKey, found.id);
        return found.id;
      }

      cursor = data.response_metadata?.next_cursor ?? "";
    } while (cursor);

    return null;
  } catch (e) {
    console.warn(`  [slack] Failed to resolve channel ${channelName}:`, (e as Error).message);
    return null;
  }
}

async function countMessages(
  channelId: string,
  channelName: string,
  noCache: boolean,
): Promise<SlackChannelActivity> {
  const cacheKey = `activity-${channelId}`;
  if (!noCache) {
    const cached = readCache<SlackChannelActivity>("slack", cacheKey);
    if (cached) return cached;
  }

  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;

  try {
    let total30d = 0;
    let total7d = 0;
    let cursor = "";

    do {
      const params: Record<string, string> = {
        channel: channelId,
        oldest: thirtyDaysAgo.toString(),
        limit: "200",
      };
      if (cursor) params.cursor = cursor;

      const data = await slackFetch<{
        messages: Array<{ ts: string; subtype?: string }>;
        has_more: boolean;
        response_metadata?: { next_cursor?: string };
      }>("conversations.history", params);

      for (const msg of data.messages) {
        if (msg.subtype) continue; // skip bot/system messages
        total30d++;
        if (parseFloat(msg.ts) >= sevenDaysAgo) total7d++;
      }

      cursor = data.response_metadata?.next_cursor ?? "";
    } while (cursor);

    const result: SlackChannelActivity = {
      name: channelName,
      messagesLast7d: total7d,
      messagesLast30d: total30d,
    };

    writeCache("slack", cacheKey, result);
    return result;
  } catch (e) {
    console.warn(`  [slack] Failed to count messages for ${channelName}:`, (e as Error).message);
    return { name: channelName, messagesLast7d: null, messagesLast30d: null };
  }
}

export async function fetchSlackActivity(
  channelNames: string[],
  noCache: boolean,
): Promise<ConnectorResult<SlackActivityData>> {
  if (channelNames.length === 0) {
    return { data: { channels: [] }, error: null, source: "slack" };
  }

  try {
    const channels: SlackChannelActivity[] = [];

    for (let i = 0; i < channelNames.length; i++) {
      const name = channelNames[i];
      if (i > 0) await slackApiPause();
      const id = await resolveSlackChannelId(name, noCache);
      if (!id) {
        channels.push({ name, messagesLast7d: null, messagesLast30d: null });
        continue;
      }
      const activity = await countMessages(id, name, noCache);
      channels.push(activity);
    }

    return { data: { channels }, error: null, source: "slack" };
  } catch (e) {
    return { data: null, error: (e as Error).message, source: "slack" };
  }
}

function truncateText(s: string, maxChars: number): string {
  const t = s.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}…`;
}

function applyInsightMessageBody(raw: string, maxMessageChars: number): string {
  if (!Number.isFinite(maxMessageChars) || maxMessageChars <= 0) return raw;
  return truncateText(raw, maxMessageChars);
}

interface SlackHistoryMessage {
  type: string;
  user?: string;
  username?: string;
  text?: string;
  ts: string;
  subtype?: string;
  thread_ts?: string;
  reply_count?: number;
  files?: Array<{ name?: string; title?: string }>;
}

function slackMessageQualifies(msg: SlackHistoryMessage, oldestTs: number): boolean {
  if (parseFloat(msg.ts) < oldestTs) return false;
  if (msg.subtype && INSIGHT_SKIP_SUBTYPES.has(msg.subtype)) return false;
  const body = msg.text?.trim();
  const hasFiles = Array.isArray(msg.files) && msg.files.length > 0;
  if (!body && !hasFiles) return false;
  return true;
}

function insightMessageText(msg: SlackHistoryMessage): string {
  const body = msg.text?.trim();
  if (body) return body;
  if (msg.files?.length) {
    const names = msg.files.map((f) => f.name || f.title || "file").filter(Boolean);
    return `[file: ${names.join(", ")}]`;
  }
  return "";
}

async function fetchThreadRepliesForParent(
  channelId: string,
  parentTs: string,
  oldestTs: number,
): Promise<SlackHistoryMessage[]> {
  const out: SlackHistoryMessage[] = [];
  let cursor = "";
  try {
    do {
      const params: Record<string, string> = {
        channel: channelId,
        ts: parentTs,
        limit: "200",
      };
      if (cursor) params.cursor = cursor;

      const data = await slackFetch<{
        messages: SlackHistoryMessage[];
        response_metadata?: { next_cursor?: string };
      }>("conversations.replies", params);

      for (const msg of data.messages) {
        if (!slackMessageQualifies(msg, oldestTs)) continue;
        out.push(msg);
      }

      cursor = data.response_metadata?.next_cursor ?? "";
    } while (cursor);
  } catch (e) {
    console.warn(
      `  [slack] conversations.replies failed (parent_ts=${parentTs}):`,
      (e as Error).message,
    );
  }
  return out;
}

async function fetchUserDisplayName(userId: string, noCache: boolean): Promise<string> {
  const cacheKey = `user-display-${userId}`;
  if (!noCache) {
    const cached = readCache<string>("slack", cacheKey);
    if (cached) return cached;
  }
  try {
    const data = await slackFetch<{
      user?: { real_name?: string; name?: string; profile?: { display_name?: string } };
    }>("users.info", { user: userId });
    const u = data.user;
    const name = u?.real_name || u?.profile?.display_name || u?.name || userId;
    writeCache("slack", cacheKey, name);
    return name;
  } catch {
    return userId;
  }
}

async function fetchChannelTranscriptMessages(
  channelId: string,
  channelName: string,
  options: SlackInsightTranscriptOptions,
): Promise<SlackInsightMessage[]> {
  const now = Math.floor(Date.now() / 1000);
  const oldestTs = now - options.lookbackDays * 24 * 60 * 60;
  const raw: SlackHistoryMessage[] = [];
  let cursor = "";

  try {
    do {
      const params: Record<string, string> = {
        channel: channelId,
        oldest: oldestTs.toString(),
        limit: "200",
      };
      if (cursor) params.cursor = cursor;

      const data = await slackFetch<{
        messages: SlackHistoryMessage[];
        response_metadata?: { next_cursor?: string };
      }>("conversations.history", params);

      for (const msg of data.messages) {
        if (!slackMessageQualifies(msg, oldestTs)) continue;
        raw.push(msg);
      }

      cursor = data.response_metadata?.next_cursor ?? "";
    } while (cursor);

    const byTs = new Map<string, SlackHistoryMessage>();
    for (const m of raw) {
      byTs.set(m.ts, m);
    }

    const threadRootsToFetch = new Set<string>();
    for (const m of raw) {
      const rc = m.reply_count;
      if (typeof rc === "number" && rc > 0) {
        threadRootsToFetch.add(m.ts);
      }
    }

    for (const parentTs of threadRootsToFetch) {
      await slackApiPause();
      const threadMsgs = await fetchThreadRepliesForParent(channelId, parentTs, oldestTs);
      for (const tm of threadMsgs) {
        if (!byTs.has(tm.ts)) byTs.set(tm.ts, tm);
      }
    }

    let merged = [...byTs.values()].sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

    const cap = options.maxMessagesPerChannel;
    if (Number.isFinite(cap) && cap > 0 && merged.length > cap) {
      const sortedDesc = [...merged].sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts));
      merged = sortedDesc.slice(0, cap).sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
    }

    const userIds = new Set<string>();
    for (const m of merged) {
      if (m.user) userIds.add(m.user);
    }

    const displayNames = new Map<string, string>();
    for (const uid of userIds) {
      displayNames.set(uid, await fetchUserDisplayName(uid, options.noCache));
    }

    return merged.map((m) => {
      const parent = m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : undefined;
      const author =
        m.username?.trim() ||
        (m.user ? displayNames.get(m.user) ?? m.user : m.subtype === "bot_message" ? "bot" : "unknown");
      return {
        ts: m.ts,
        author,
        text: applyInsightMessageBody(insightMessageText(m), options.maxMessageChars),
        ...(parent ? { thread_parent_ts: parent } : {}),
      };
    });
  } catch (e) {
    console.warn(`  [slack] Failed transcript for ${channelName}:`, (e as Error).message);
    return [];
  }
}

/** Bounded message history for Claude insight — does not reuse activity-count cache. */
export async function fetchSlackTranscriptsForInsight(
  channelNames: string[],
  options: SlackInsightTranscriptOptions,
): Promise<SlackInsightChannelTranscript[]> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");

  const unique = [...new Set(channelNames.map((n) => n.replace(/^#/, "")))];
  const results: SlackInsightChannelTranscript[] = [];

  for (let i = 0; i < unique.length; i++) {
    const clean = unique[i];
    if (i > 0) await slackApiPause();
    const forResolve = looksLikeSlackChannelId(clean)
      ? clean.replace(/^#/, "")
      : clean.startsWith("#")
        ? clean
        : `#${clean}`;
    const channelLabel = looksLikeSlackChannelId(clean) ? clean.replace(/^#/, "") : forResolve;
    const id = await resolveSlackChannelId(forResolve, options.noCache);
    if (!id) {
      results.push({ channelName: channelLabel, channelId: null, messages: [] });
      continue;
    }
    const messages = await fetchChannelTranscriptMessages(id, channelLabel, options);
    results.push({ channelName: channelLabel, channelId: id, messages });
  }

  return results;
}
