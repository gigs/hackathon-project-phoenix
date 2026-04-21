"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ARRDataPoint } from "@/lib/types";

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value}`;
}

export function ARRChart({ data }: { data: ARRDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center rounded-lg bg-sage-75 text-xs text-sage-400">
        No ARR data available
      </div>
    );
  }

  const latestActual = [...data].reverse().find((d) => d.actual !== null);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-sage-700">
          Customer ARR — Actuals vs Forecast
        </span>
        {latestActual && (
          <span className="tabular-nums text-xl font-bold text-sage-900">
            {formatCurrency(latestActual.actual!)}
          </span>
        )}
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-central-600)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--color-central-600)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "var(--color-sage-400)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-sage-400)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatCurrency}
              width={50}
            />
            <Tooltip
              formatter={(v) => [formatCurrency(v as number), ""]}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--color-sage-200)" }}
            />
            <Area
              type="monotone"
              dataKey="forecast"
              stroke="var(--color-sage-300)"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              fill="none"
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="var(--color-central-600)"
              strokeWidth={2}
              fill="url(#actualGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex justify-end gap-4">
        <span className="flex items-center gap-1.5 text-xs text-central-600">
          <span className="inline-block h-0.5 w-4 bg-central-600" /> Actual
        </span>
        <span className="flex items-center gap-1.5 text-xs text-sage-400">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-sage-300" />{" "}
          Forecast
        </span>
      </div>
    </div>
  );
}
