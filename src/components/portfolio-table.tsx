"use client";

import { useState } from "react";
import Link from "next/link";
import type { PortfolioEntry, HealthStatus } from "@/lib/types";
import { HealthDot } from "./health-dot";

function formatArr(value: number | null) {
  if (value === null) return "—";
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value}`;
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
    : entries.filter((e) => e.health === healthFilter);

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
      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-sage-100 px-5 py-3">
        <span className="text-xs font-medium text-sage-500">Filter:</span>
        {(["all", "green", "yellow", "red", "gray"] as const).map((h) => (
          <button
            key={h}
            onClick={() => setHealthFilter(h)}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
              healthFilter === h
                ? "bg-central-50 text-central-700"
                : "text-sage-400 hover:text-sage-600"
            }`}
          >
            {h === "all" ? "All" : h[0].toUpperCase() + h.slice(1)}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_80px_100px_1fr] border-b border-sage-100 bg-sage-25 px-5 py-2.5">
        {(
          [
            ["Customer", "name"],
            ["Health", "health"],
            ["Deals", "dealCount"],
            ["Total ARR", "totalArr"],
            ["Stage Distribution", null],
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
            {sortKey === key && (
              <span className="ml-0.5">{sortAsc ? "↑" : "↓"}</span>
            )}
          </button>
        ))}
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <div className="py-8 text-center text-sm text-sage-400">No customers match filter</div>
      ) : (
        sorted.map((entry) => (
          <Link
            key={entry.slug}
            href={`/customers/${entry.slug}`}
            className="grid grid-cols-[1fr_80px_80px_100px_1fr] items-center border-b border-sage-50 px-5 py-3.5 transition hover:bg-sage-75"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-central-200 text-sm font-bold text-central-800">
                {entry.name[0]}
              </div>
              <span className="text-sm font-semibold text-sage-900">{entry.name}</span>
            </div>
            <HealthDot status={entry.health} showLabel />
            <span className="tabular-nums text-sm text-sage-700">{entry.dealCount}</span>
            <span className="tabular-nums text-sm font-semibold text-sage-900">
              {formatArr(entry.totalArr)}
            </span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(entry.stages).map(([stage, count]) => (
                <span
                  key={stage}
                  className="rounded-full bg-sage-75 px-2 py-0.5 text-3xs font-medium text-sage-600"
                >
                  {stage} ({count})
                </span>
              ))}
              {Object.keys(entry.stages).length === 0 && (
                <span className="text-xs text-sage-400">—</span>
              )}
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
