"use client";

import { useState } from "react";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import type { ARRDataPoint, DealData, Milestone } from "@/lib/types";
import { HealthDot } from "./health-dot";

const MILESTONE_COLORS: Record<string, string> = {
  deal: "var(--color-central-600)",
  product: "var(--color-sage-600)",
  legal: "var(--color-warning)",
  launch: "var(--color-error)",
};

const MILESTONE_LABELS: Record<string, string> = {
  deal: "Deal",
  product: "Product",
  legal: "Legal",
  launch: "Launch",
};

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value}`;
}

function findNowIndex(data: ARRDataPoint[]): number {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].actual !== null) return i;
  }
  return -1;
}

interface TimelineChartProps {
  arrData: ARRDataPoint[];
  milestones: Milestone[];
  deals: DealData[];
}

export function TimelineChart({ arrData, milestones, deals }: TimelineChartProps) {
  const [activeDeal, setActiveDeal] = useState<string | null>(null);

  // Chart always shows the full customer-level data
  const chartData = arrData;
  // Milestones filter by deal selection
  const chartMilestones = activeDeal
    ? milestones.filter((m) => m.deal === activeDeal)
    : milestones;

  if (arrData.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-sage-200 bg-white text-sm text-sage-400">
        No timeline data available
      </div>
    );
  }

  const latestActual = [...chartData].reverse().find((d) => d.actual !== null);
  const nowIdx = findNowIndex(chartData);

  // Build milestone lookup by month
  const milestonesByMonth = new Map<string, Milestone[]>();
  for (const m of chartMilestones) {
    const existing = milestonesByMonth.get(m.month) ?? [];
    existing.push(m);
    milestonesByMonth.set(m.month, existing);
  }


  return (
    <div className="rounded-xl border border-sage-200 bg-white">
      {/* Header row with deal filter buttons */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-sage-900">Timeline</h2>

          {/* Deal filter buttons */}
          {deals.length > 0 && (
            <div className="flex items-center gap-1 rounded-lg bg-sage-50 p-0.5">
              <button
                onClick={() => setActiveDeal(null)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  activeDeal === null
                    ? "bg-white text-sage-900 shadow-sm"
                    : "text-sage-400 hover:text-sage-600"
                }`}
              >
                All
              </button>
              {deals.map((deal) => (
                <button
                  key={deal.label}
                  onClick={() => setActiveDeal(activeDeal === deal.label ? null : deal.label)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    activeDeal === deal.label
                      ? "bg-white text-sage-900 shadow-sm"
                      : "text-sage-400 hover:text-sage-600"
                  }`}
                >
                  <HealthDot status={deal.health} />
                  {deal.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {latestActual && (
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-sage-500">Current ARR</span>
            <span className="tabular-nums text-2xl font-bold tracking-tight text-sage-950">
              {formatCurrency(latestActual.actual!)}
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-[240px] px-2">
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 20, right: 24, bottom: 4, left: 8 }}>
              <defs>
                <linearGradient id="arrActualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-central-600)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--color-central-600)" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="arrForecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-sage-400)" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="var(--color-sage-400)" stopOpacity={0.01} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--color-sage-400)" }}
                axisLine={{ stroke: "var(--color-sage-200)" }}
                tickLine={false}
                dy={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-sage-400)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCurrency}
                width={54}
              />
              <Tooltip
                content={<CustomTooltip milestonesByMonth={milestonesByMonth} />}
              />

              {/* "Now" divider — shade future region */}
              {nowIdx >= 0 && nowIdx < chartData.length - 1 && (
                <ReferenceArea
                  x1={chartData[nowIdx].month}
                  x2={chartData[chartData.length - 1].month}
                  fill="var(--color-sage-50)"
                  fillOpacity={0.8}
                  strokeOpacity={0}
                />
              )}

              {/* Forecast area */}
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="var(--color-sage-300)"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                fill="url(#arrForecastGrad)"
              />

              {/* Actual ARR area */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="var(--color-central-600)"
                strokeWidth={2}
                fill="url(#arrActualGrad)"
                connectNulls={false}
              />

              {/* Milestone reference lines with truncated labels */}
              {chartMilestones.map((m, i) => {
                const truncated = m.label.length > 20 ? m.label.slice(0, 20) + "…" : m.label;
                return (
                  <ReferenceLine
                    key={`${m.month}-${i}`}
                    x={m.month}
                    stroke={MILESTONE_COLORS[m.type] ?? "var(--color-sage-400)"}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    strokeOpacity={0.4}
                    label={{
                      value: truncated,
                      position: "insideTopLeft",
                      fill: "var(--color-sage-500)",
                      fontSize: 9,
                      dx: 4,
                      dy: 2,
                    }}
                  />
                );
              })}

              {/* Now line */}
              {nowIdx >= 0 && (
                <ReferenceLine
                  x={chartData[nowIdx].month}
                  stroke="var(--color-sage-900)"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  label={{
                    value: "Now",
                    position: "insideTopRight",
                    fill: "var(--color-sage-500)",
                    fontSize: 10,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      {/* Legend */}
      <div className="border-t border-sage-100 px-6 py-2.5">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 text-xs text-sage-500">
            <span className="inline-block h-0.5 w-4 rounded bg-central-600" /> Actual ARR
          </span>
          <span className="flex items-center gap-1.5 text-xs text-sage-400">
            <span className="inline-block h-0.5 w-4 border-t border-dashed border-sage-300" /> Forecast
          </span>
        </div>
      </div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  milestonesByMonth,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
  milestonesByMonth: Map<string, Milestone[]>;
}) {
  if (!active || !payload || !label) return null;

  const monthMilestones = milestonesByMonth.get(label) ?? [];
  const actual = payload.find((p) => p.name === "actual")?.value;
  const forecast = payload.find((p) => p.name === "forecast")?.value;

  return (
    <div className="rounded-lg border border-sage-200 bg-white px-3 py-2 shadow-sm">
      <div className="mb-1 text-xs font-semibold text-sage-700">{label}</div>
      {actual !== null && actual !== undefined && (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full bg-central-600" />
          <span className="text-sage-500">Actual</span>
          <span className="tabular-nums font-semibold text-sage-900">{formatCurrency(actual)}</span>
        </div>
      )}
      {forecast !== null && forecast !== undefined && (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full bg-sage-300" />
          <span className="text-sage-500">Forecast</span>
          <span className="tabular-nums font-semibold text-sage-700">{formatCurrency(forecast)}</span>
        </div>
      )}
      {monthMilestones.length > 0 && (
        <div className="mt-1.5 border-t border-sage-100 pt-1.5">
          {monthMilestones.map((m, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: MILESTONE_COLORS[m.type] }}
              />
              <span className="text-sage-600">{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
