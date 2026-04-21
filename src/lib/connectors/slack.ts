import { readCache, writeCache } from "../cache";
import type { ConnectorResult, SlackActivityData, SlackChannelActivity } from "../types";

interface SlackChannel {
  id: string;
  name: string;
}

async function slackFetch<T>(method: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");

  const url = new URL(`https://slack.com/api/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Slack API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Slack API error: ${json.error}`);
  }

  return json as T;
}

async function resolveChannelId(channelName: string, noCache: boolean): Promise<string | null> {
  const cleanName = channelName.replace(/^#/, "");
  const cacheKey = `channel-id-${cleanName}`;

  if (!noCache) {
    const cached = readCache<string>("slack", cacheKey);
    if (cached) return cached;
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

    for (const name of channelNames) {
      const id = await resolveChannelId(name, noCache);
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
