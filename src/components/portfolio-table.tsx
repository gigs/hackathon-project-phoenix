"use client";

import { useState } from "react";
import Link from "next/link";
import type { PortfolioEntry, HealthStatus } from "@/lib/types";
import { HealthDot } from "./health-dot";

function formatArr(value: number | null) {
  if (value === null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

type SortKey = "name" | "health" | "dealCount" | "totalArr";

const HEALTH_ORDER: Record<HealthStatus, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  gray: 3,
};

export function PortfolioTable({ entries }: { entries: PortfolioEntry[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [healthFilter, setHealthFilter] = useState<HealthStatus | "all">("all");

  const filtered = healthFilter === "all"
    ? entries
    : entries.filter((entry) => entry.health === healthFilter);

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "health":
        cmp = HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health];
        break;
      case "dealCount":
        cmp = a.dealCount - b.dealCount;
        break;
      case "totalArr":
        cmp = (a.totalArr ?? 0) - (b.totalArr ?? 0);
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-sage-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-sage-100 px-5 py-3">
        <span className="text-xs font-medium text-sage-500">Focus:</span>
        {(["all", "green", "yellow", "red", "gray"] as const).map((health) => (
          <button
            key={health}
            onClick={() => setHealthFilter(health)}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
              healthFilter === health
                ? "bg-central-50 text-central-700"
                : "text-sage-400 hover:text-sage-600"
            }`}
          >
            {health === "all" ? "All" : health[0].toUpperCase() + health.slice(1)}
          </button>
        ))}
      </div>

      <div className="hidden border-b border-sage-100 bg-sage-25 px-5 py-2.5 lg:grid lg:grid-cols-[1.1fr_120px_1.6fr_120px_1fr_90px]">
        {(
          [
            ["Customer", "name"],
            ["State", "health"],
            ["Why now", null],
            ["ARR", "totalArr"],
            ["Next milestone", null],
            ["Risks", "dealCount"],
          ] as const
        ).map(([label, key]) => (
          <button
            key={label}
            onClick={() => key && toggleSort(key as SortKey)}
            className={`text-left text-3xs font-semibold uppercase tracking-wider ${
              key ? "cursor-pointer text-sage-500 hover:text-sage-700" : "cursor-default text-sage-500"
            }`}
          >
            {label}
            {sortKey === key ? <span className="ml-0.5">{sortAsc ? "↑" : "↓"}</span> : null}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="py-8 text-center text-sm text-sage-400">No customers match the current filter.</div>
      ) : (
        <>
          <div className="lg:hidden">
            {sorted.map((entry) => (
              <Link
                key={entry.slug}
                href={`/customers/${entry.slug}`}
                className="block border-b border-sage-50 px-5 py-4 transition hover:bg-sage-75"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-central-200 text-sm font-bold text-central-800">
                        {entry.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-sage-900">{entry.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-sage-500">
                          <span>{entry.driName ?? "No DRI"}</span>
                          <span>·</span>
                          <span>{entry.dealCount} deal{entry.dealCount === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-5 text-sage-700">
                      {entry.whyNow ?? `${entry.dealCount} deal${entry.dealCount === 1 ? "" : "s"} in motion.`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-sage-200 bg-sage-50 px-2.5 py-1 text-sage-600">
                        ARR {formatArr(entry.totalArr)}
                      </span>
                      <span className="rounded-full border border-sage-200 bg-sage-50 px-2.5 py-1 text-sage-600">
                        Risks {entry.openRiskCount ?? 0}
                      </span>
                    </div>
                  </div>
                  <HealthDot status={entry.health} showLabel />
                </div>
                {entry.nextMilestone ? (
                  <div className="mt-3 rounded-lg border border-sage-100 bg-sage-25 px-3 py-2 text-xs text-sage-600">
                    Next milestone: <span className="font-medium text-sage-800">{entry.nextMilestone}</span>
                    {entry.nextMilestoneDate ? ` · ${entry.nextMilestoneDate}` : ""}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>

          <div className="hidden lg:block">
            {sorted.map((entry) => (
              <Link
                key={entry.slug}
                href={`/customers/${entry.slug}`}
                className="grid grid-cols-[1.1fr_120px_1.6fr_120px_1fr_90px] items-center border-b border-sage-50 px-5 py-3.5 transition hover:bg-sage-75"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-central-200 text-sm font-bold text-central-800">
                      {entry.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-sage-900">{entry.name}</div>
                      <div className="mt-0.5 text-xs text-sage-500">{entry.driName ?? "No DRI assigned"}</div>
                    </div>
                  </div>
                </div>
                <HealthDot status={entry.health} showLabel />
                <div className="pr-4 text-sm leading-5 text-sage-700">
                  {entry.whyNow ?? `${entry.dealCount} deal${entry.dealCount === 1 ? "" : "s"} in motion.`}
                </div>
                <div className="tabular-nums text-sm font-semibold text-sage-900">{formatArr(entry.totalArr)}</div>
                <div className="pr-4">
                  {entry.nextMilestone ? (
                    <div className="text-sm text-sage-800">
                      <div className="font-medium">{entry.nextMilestone}</div>
                      {entry.nextMilestoneDate ? (
                        <div className="text-xs text-sage-500">{entry.nextMilestoneDate}</div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-sage-400">No dated milestone</span>
                  )}
                </div>
                <div>
                  <span className="inline-flex items-center rounded-full bg-sage-75 px-2 py-0.5 text-xs font-semibold text-sage-700">
                    {entry.openRiskCount ?? 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
