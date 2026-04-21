"use client";

import type { AccountBriefPayload, PortfolioEntry } from "@/lib/types";
import { buildPortfolioDigest, formatCurrencyCompact } from "@/lib/customer-intelligence";

function Metric({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="rounded-xl border border-sage-200 bg-white px-5 py-4">
      <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-sage-500">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-sage-950">{value}</div>
      <div className="mt-1 text-xs text-sage-500">{sublabel}</div>
    </div>
  );
}

export function PortfolioSummaryStrip({
  entries,
  accountBriefs,
}: {
  entries: PortfolioEntry[];
  accountBriefs: Record<string, AccountBriefPayload | null>;
}) {
  const totalArr = entries.reduce((sum, entry) => sum + (entry.totalArr ?? 0), 0) || null;
  const atRiskCount = entries.filter((entry) => entry.health === "yellow" || entry.health === "red").length;
  const riskCount = entries.reduce((sum, entry) => sum + (entry.openRiskCount ?? 0), 0);
  const nextMilestone = entries
    .filter((entry) => entry.nextMilestoneDate)
    .sort((a, b) => new Date(a.nextMilestoneDate ?? "").getTime() - new Date(b.nextMilestoneDate ?? "").getTime())[0];
  const digest = buildPortfolioDigest(entries, accountBriefs);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Portfolio ARR" value={formatCurrencyCompact(totalArr)} sublabel={`${entries.length} customers tracked`} />
        <Metric label="Accounts at risk" value={`${atRiskCount}`} sublabel="Yellow or red health today" />
        <Metric label="Open risks" value={`${riskCount}`} sublabel="Tracked from issues and deal health" />
        <Metric
          label="Next milestone"
          value={nextMilestone?.name ?? "—"}
          sublabel={
            nextMilestone?.nextMilestone
              ? `${nextMilestone.nextMilestone}${nextMilestone.nextMilestoneDate ? ` · ${nextMilestone.nextMilestoneDate}` : ""}`
              : "No dated milestone captured"
          }
        />
      </div>

      <div className="rounded-xl border border-sage-200 bg-white px-5 py-5">
        <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-sage-500">
          Weekly portfolio digest
        </div>
        <p className="mt-2 text-sm leading-6 text-sage-900">{digest.headline}</p>
        <ul className="mt-3 space-y-2">
          {digest.priorities.map((priority, index) => (
            <li key={`${priority}-${index}`} className="rounded-lg border border-sage-100 bg-sage-25 px-3 py-2.5 text-sm text-sage-800">
              {priority}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
