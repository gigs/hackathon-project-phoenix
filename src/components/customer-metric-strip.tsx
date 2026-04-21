"use client";

import type { AccountBriefPayload, CustomerData } from "@/lib/types";
import {
  currentArr,
  currentLines,
  formatCurrencyCompact,
  formatNumberCompact,
  seriesChangePercent,
} from "@/lib/customer-intelligence";

function deltaLabel(change: { value: number | null; direction: "up" | "down" | "flat" }) {
  if (change.value == null) return "Trend still forming";
  const prefix = change.direction === "up" ? "+" : change.direction === "down" ? "−" : "";
  return `${prefix}${change.value.toFixed(1)}% vs prior point`;
}

function MetricCard({
  label,
  value,
  sublabel,
  source,
}: {
  label: string;
  value: string;
  sublabel: string;
  source: string;
}) {
  return (
    <div className="rounded-xl border border-sage-200 bg-white px-5 py-4">
      <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-sage-500">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-sage-950">{value}</div>
      <div className="mt-1 text-xs text-sage-500">{sublabel}</div>
      <div className="mt-2 text-3xs uppercase tracking-[0.14em] text-sage-400">{source}</div>
    </div>
  );
}

export function CustomerMetricStrip({
  data,
  brief,
}: {
  data: CustomerData;
  brief: AccountBriefPayload;
}) {
  const arr = currentArr(data);
  const lines = currentLines(data);
  const arrChange = seriesChangePercent(data.arrData.map((point) => point.actual));
  const linesChange = seriesChangePercent(data.arrData.map((point) => point.linesActual ?? null));
  const riskCount = Math.max(brief.top_risks.length, data.linearIssues.length);

  return (
    <section
      aria-label="Customer summary metrics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <MetricCard
        label="Current ARR"
        value={formatCurrencyCompact(arr)}
        sublabel={deltaLabel(arrChange)}
        source="Source: latest ARR point in customer timeline"
      />
      <MetricCard
        label="Activations"
        value={formatNumberCompact(lines)}
        sublabel={deltaLabel(linesChange)}
        source="Source: latest lines / activations point"
      />
      <MetricCard
        label="Open risks"
        value={`${riskCount}`}
        sublabel={
          brief.next_milestone
            ? `Next milestone: ${brief.next_milestone.label}`
            : "No milestone captured yet"
        }
        source="Source: account-brief risks, with Linear issue fallback"
      />
    </section>
  );
}
