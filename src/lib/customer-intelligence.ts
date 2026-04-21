import type {
  AccountBriefMilestone,
  AccountBriefPayload,
  AccountBriefPoint,
  AccountBriefRisk,
  CustomerData,
  OverallSentimentPayload,
  PortfolioEntry,
  SlackInsightPayload,
} from "./types";
import { ACCOUNT_BRIEF_SCHEMA_VERSION } from "./types";

export interface PortfolioDigest {
  headline: string;
  priorities: string[];
}

export function formatCurrencyCompact(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${Math.round(value / 1_000)}K`;
  return `€${Math.round(value)}`;
}

export function formatNumberCompact(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

export function sumArr(data: CustomerData): number | null {
  const total = data.deals.reduce((sum, deal) => sum + (deal.arr ?? 0), 0);
  return total > 0 ? total : null;
}

/** Roll up per-project daily actuals to a customer-level daily series sorted ascending by date. */
export function customerDailySeries(
  data: CustomerData,
): Array<{ date: string; arr: number; lines: number }> {
  const byDate = new Map<string, { arr: number; lines: number }>();
  for (const row of data.arrActuals ?? []) {
    const cur = byDate.get(row.date) ?? { arr: 0, lines: 0 };
    cur.arr += row.arr;
    cur.lines += row.activeLines;
    byDate.set(row.date, cur);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, arr: v.arr, lines: v.lines }));
}

export function currentLines(data: CustomerData): number | null {
  const series = customerDailySeries(data);
  const latest = series[series.length - 1];
  if (latest && latest.lines > 0) return latest.lines;
  const total = data.deals.reduce((sum, deal) => sum + (deal.activations ?? 0), 0);
  return total > 0 ? total : null;
}

export function currentArr(data: CustomerData): number | null {
  const series = customerDailySeries(data);
  const latest = series[series.length - 1];
  if (latest && latest.arr > 0) return latest.arr;
  return sumArr(data);
}

export function seriesChangePercent(
  values: Array<number | null>,
): { value: number | null; direction: "up" | "down" | "flat" } {
  const actuals = values.filter((value): value is number => value != null);
  if (actuals.length < 2 || actuals[0] === 0) {
    return { value: null, direction: "flat" };
  }
  const previous = actuals[actuals.length - 2];
  const current = actuals[actuals.length - 1];
  const delta = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(delta),
    direction: delta > 0.1 ? "up" : delta < -0.1 ? "down" : "flat",
  };
}

function milestoneDateValue(date: string | null): number {
  if (!date) return Number.POSITIVE_INFINITY;
  const value = new Date(date).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

export function deriveNextMilestone(data: CustomerData): AccountBriefMilestone | null {
  const today = Date.now();

  const explicitMilestones = data.milestones
    .map((milestone) => ({
      label: milestone.label,
      date: milestone.date,
      owner: data.driName,
      source: "derived" as const,
      url: null,
    }))
    .filter((milestone) => milestoneDateValue(milestone.date) >= today);

  const goLives = data.deals
    .filter((deal) => deal.goLiveDate)
    .map((deal) => ({
      label: `${deal.label} go-live`,
      date: deal.goLiveDate,
      owner: deal.dri,
      source: "hubspot" as const,
      url: deal.linearProjectSlug ? `https://linear.app/gigs/project/${deal.linearProjectSlug}` : null,
    }));

  const candidates = [...explicitMilestones, ...goLives].sort(
    (a, b) => milestoneDateValue(a.date) - milestoneDateValue(b.date),
  );

  return candidates[0] ?? null;
}

function dedupePoints<T extends { summary: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.summary.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildWhyNow(
  data: CustomerData,
  overallSentiment: OverallSentimentPayload | null,
  slackInsight: SlackInsightPayload | null,
): AccountBriefPoint[] {
  const points: AccountBriefPoint[] = [];

  if (overallSentiment) {
    for (const signal of overallSentiment.momentum_signals.slice(0, 2)) {
      points.push({
        summary: signal.summary,
        source: signal.source,
        url: signal.url,
      });
    }
  }

  if (slackInsight) {
    for (const signal of slackInsight.signals.filter((row) => row.type === "opportunity" || row.type === "momentum").slice(0, 2)) {
      points.push({
        summary: signal.summary,
        source: "slack",
        url: signal.url,
      });
    }
  }

  const soonestDeal = data.deals
    .filter((deal) => deal.goLiveDate)
    .sort((a, b) => milestoneDateValue(a.goLiveDate) - milestoneDateValue(b.goLiveDate))[0];
  if (soonestDeal?.goLiveDate) {
    points.push({
      summary: `${soonestDeal.label} is tracking toward ${soonestDeal.goLiveDate}.`,
      source: "hubspot",
      url: soonestDeal.linearProjectSlug
        ? `https://linear.app/gigs/project/${soonestDeal.linearProjectSlug}`
        : null,
    });
  }

  return dedupePoints(points).slice(0, 3);
}

function buildRisks(
  data: CustomerData,
  overallSentiment: OverallSentimentPayload | null,
  slackInsight: SlackInsightPayload | null,
): AccountBriefRisk[] {
  const risks: AccountBriefRisk[] = [];

  if (overallSentiment) {
    for (const signal of overallSentiment.warning_signs.slice(0, 3)) {
      risks.push({
        summary: signal.summary,
        source: signal.source,
        url: signal.url,
        severity: "high",
      });
    }
  }

  if (slackInsight) {
    for (const signal of slackInsight.signals.filter((row) => row.type === "warning" || row.type === "change").slice(0, 2)) {
      risks.push({
        summary: signal.summary,
        source: "slack",
        url: signal.url,
        severity: signal.type === "warning" ? "high" : "medium",
      });
    }
  }

  for (const issue of data.linearIssues.slice(0, 2)) {
    risks.push({
      summary: issue.title,
      source: "linear",
      url: issue.url,
      severity: issue.priority <= 1 ? "high" : "medium",
    });
  }

  return dedupePoints(risks).slice(0, 4);
}

function confidenceScore(
  overallSentiment: OverallSentimentPayload | null,
  slackInsight: SlackInsightPayload | null,
): number {
  const signalCount =
    (overallSentiment?.momentum_signals.length ?? 0) +
    (overallSentiment?.warning_signs.length ?? 0) +
    (slackInsight?.stakeholders.length ?? 0);
  return Math.max(55, Math.min(94, 58 + signalCount * 4));
}

export function buildFallbackAccountBrief(
  data: CustomerData,
  overallSentiment: OverallSentimentPayload | null,
  slackInsight: SlackInsightPayload | null,
): AccountBriefPayload {
  const currentRevenue = currentArr(data);
  const nextMilestone = deriveNextMilestone(data);
  const whyNow = buildWhyNow(data, overallSentiment, slackInsight);
  const topRisks = buildRisks(data, overallSentiment, slackInsight);
  const citations = dedupePoints([
    ...whyNow,
    ...topRisks.map((risk) => ({ summary: risk.summary, source: risk.source, url: risk.url })),
  ])
    .slice(0, 5)
    .map((point) => ({
      label: point.summary,
      source: point.source,
      url: point.url,
    }));

  const commercialState =
    data.deals.filter((deal) => deal.hubspotStageIndex != null).length > 0
      ? `${data.deals.filter((deal) => deal.hubspotStageIndex != null).length} active commercial track${data.deals.length > 1 ? "s" : ""}`
      : "Commercial state is lightly instrumented.";
  const deliveryState =
    data.linearIssues.length > 0
      ? `${data.linearIssues.length} flagged delivery issue${data.linearIssues.length === 1 ? "" : "s"} need attention.`
      : "Delivery execution looks relatively clear from the tracked issues.";
  const stakeholderState =
    slackInsight?.health?.summary ??
    overallSentiment?.summary ??
    `${data.config.name} relationship signal is still being established.`;

  const headline =
    overallSentiment?.summary ??
    `${data.config.name} is ${data.health === "green" ? "moving well" : data.health === "yellow" ? "making progress with visible friction" : data.health === "red" ? "under pressure" : "light on recent signal"}${currentRevenue ? ` at ${formatCurrencyCompact(currentRevenue)} ARR` : ""}.`;

  return {
    schema_version: ACCOUNT_BRIEF_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    lookback_days: overallSentiment?.lookback_days ?? 60,
    headline,
    confidence: confidenceScore(overallSentiment, slackInsight),
    why_now: whyNow,
    top_risks: topRisks,
    next_milestone: nextMilestone,
    commercial_state: commercialState,
    delivery_state: deliveryState,
    stakeholder_state: stakeholderState,
    citations,
  };
}

export function buildPortfolioDigest(
  entries: PortfolioEntry[],
  accountBriefs: Record<string, AccountBriefPayload | null> = {},
): PortfolioDigest {
  const atRisk = entries.filter((entry) => entry.health === "red" || entry.health === "yellow");
  const nextMilestones = entries
    .filter((entry) => entry.nextMilestoneDate)
    .sort((a, b) => milestoneDateValue(a.nextMilestoneDate) - milestoneDateValue(b.nextMilestoneDate))
    .slice(0, 2);

  const headline = atRisk.length > 0
    ? `${atRisk.length} account${atRisk.length === 1 ? "" : "s"} need attention, led by ${atRisk[0].name}${atRisk.length > 1 ? " and the next launch window" : ""}.`
    : "Portfolio looks stable, with the next focus shifting to upcoming launches and expansion milestones.";

  const priorities: string[] = [];

  for (const entry of atRisk.slice(0, 2)) {
    priorities.push(
      accountBriefs[entry.slug]?.headline ??
        `${entry.name}: ${entry.whyNow ?? `${entry.dealCount} deal${entry.dealCount === 1 ? "" : "s"} in motion.`}`,
    );
  }

  for (const entry of nextMilestones) {
    if (priorities.length >= 3) break;
    priorities.push(
      `${entry.name}: next milestone ${entry.nextMilestone ?? "upcoming"}${entry.nextMilestoneDate ? ` (${entry.nextMilestoneDate})` : ""}.`,
    );
  }

  if (priorities.length === 0) {
    priorities.push("No urgent portfolio-wide blockers are surfaced in the current data snapshot.");
  }

  return { headline, priorities: priorities.slice(0, 3) };
}
