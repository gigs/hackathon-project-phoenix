"use client";

import type { DealData, TimelineMetric } from "@/lib/types";
import { labelToFlag } from "@/lib/flags";

export function DealFilter({
  deals,
  activeDeal,
  onSelect,
  metric,
  onMetricChange,
}: {
  deals: DealData[];
  activeDeal: string | null;
  onSelect: (deal: string | null) => void;
  metric: TimelineMetric;
  onMetricChange: (metric: TimelineMetric) => void;
}) {
  if (deals.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-sage-200 bg-white px-5 py-3">
      <span className="text-xs font-semibold text-sage-500">View:</span>
      <div className="flex items-center gap-1 rounded-lg bg-sage-50 p-0.5">
        <button
          onClick={() => onSelect(null)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            activeDeal === null
              ? "bg-white text-sage-900 shadow-sm"
              : "text-sage-400 hover:text-sage-600"
          }`}
        >
          All
        </button>
        {deals.map((deal) => {
          const flag = labelToFlag(deal.label);
          return (
            <button
              key={deal.label}
              onClick={() => onSelect(activeDeal === deal.label ? null : deal.label)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                activeDeal === deal.label
                  ? "bg-white text-sage-900 shadow-sm"
                  : "text-sage-400 hover:text-sage-600"
              }`}
            >
              {flag && <span>{flag}</span>}
              {deal.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs font-semibold text-sage-500">Chart:</span>
        <div className="flex items-center gap-1 rounded-lg bg-sage-50 p-0.5">
          <button
            onClick={() => onMetricChange("arr")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              metric === "arr"
                ? "bg-white text-sage-900 shadow-sm"
                : "text-sage-400 hover:text-sage-600"
            }`}
          >
            ARR
          </button>
          <button
            onClick={() => onMetricChange("lines")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              metric === "lines"
                ? "bg-white text-sage-900 shadow-sm"
                : "text-sage-400 hover:text-sage-600"
            }`}
          >
            Lines
          </button>
        </div>
      </div>
    </div>
  );
}
