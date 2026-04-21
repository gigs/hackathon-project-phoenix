"use client";

import type {
  AccountBriefPayload,
  CustomerData,
  SlackInsightPayload,
} from "@/lib/types";

interface ActivityItem {
  title: string;
  meta: string;
  tone: "neutral" | "warning" | "momentum";
  url: string | null;
}

function take<T>(items: T[], limit: number): T[] {
  return items.slice(0, limit);
}

function buildItems(
  data: CustomerData,
  brief: AccountBriefPayload,
  slackInsight: SlackInsightPayload | null,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const risk of take(brief.top_risks, 2)) {
    items.push({
      title: risk.summary,
      meta: `${risk.severity} risk · ${risk.source}`,
      tone: "warning",
      url: risk.url,
    });
  }

  for (const update of take(slackInsight?.updates ?? [], 2)) {
    items.push({
      title: update.summary,
      meta: update.timestamp,
      tone: "neutral",
      url: update.url,
    });
  }

  for (const issue of take(data.linearIssues, 2)) {
    items.push({
      title: issue.title,
      meta: `${issue.status}${issue.assignee ? ` · ${issue.assignee}` : ""}`,
      tone: issue.priority <= 1 ? "warning" : "neutral",
      url: issue.url,
    });
  }

  for (const point of take(brief.why_now, 2)) {
    items.push({
      title: point.summary,
      meta: point.source,
      tone: "momentum",
      url: point.url,
    });
  }

  return items.slice(0, 6);
}

function toneClasses(tone: ActivityItem["tone"]) {
  switch (tone) {
    case "warning":
      return "border-warning/30 bg-warning/8 text-warning";
    case "momentum":
      return "border-central-200 bg-central-50 text-central-700";
    default:
      return "border-sage-200 bg-sage-50 text-sage-700";
  }
}

export function CustomerActivityFeed({
  data,
  brief,
  slackInsight,
}: {
  data: CustomerData;
  brief: AccountBriefPayload;
  slackInsight: SlackInsightPayload | null;
}) {
  const items = buildItems(data, brief, slackInsight);

  return (
    <section className="rounded-xl border border-sage-200 bg-white px-5 py-5">
      <div className="flex items-center justify-between border-b border-sage-100 pb-3">
        <div>
          <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-sage-500">
            Unified activity
          </div>
          <h2 className="mt-1 text-lg font-semibold text-sage-950">Watchlist</h2>
        </div>
        <span className="text-xs text-sage-400">{items.length} items</span>
      </div>

      <ul className="mt-4 space-y-2.5">
        {items.map((item, index) => (
          <li key={`${item.title}-${index}`} className="rounded-lg border border-sage-100 bg-sage-25 px-3 py-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide ${toneClasses(item.tone)}`}>
                {item.tone}
              </span>
              <span className="text-3xs text-sage-500">{item.meta}</span>
            </div>
            <p className="mt-1 text-sm leading-5 text-sage-900">{item.title}</p>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-3xs font-medium text-central-700 hover:text-central-800 hover:underline"
              >
                Open →
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
