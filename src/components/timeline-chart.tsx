"use client";

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
import type { ARRDataPoint, DealData, HealthHistoryEntry, HealthStatus, Milestone, TimelineMetric } from "@/lib/types";

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

const DAY = 86_400_000;

function toTs(isoDate: string): number {
  return new Date(isoDate + "T00:00:00Z").getTime();
}

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value}`;
}

function formatLines(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

function formatLinesFull(value: number) {
  return value.toLocaleString("en-US");
}

function formatMonthTick(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

function formatTooltipDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthTicks(minTs: number, maxTs: number): number[] {
  const ticks: number[] = [];
  const cur = new Date(minTs);
  cur.setUTCDate(1);
  cur.setUTCHours(0, 0, 0, 0);
  if (cur.getTime() < minTs) cur.setUTCMonth(cur.getUTCMonth() + 1);
  while (cur.getTime() <= maxTs) {
    ticks.push(cur.getTime());
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return ticks;
}

interface TimelineChartProps {
  arrData: ARRDataPoint[];
  milestones: Milestone[];
  deals: DealData[];
  activeDeal?: string | null;
  healthHistory?: HealthHistoryEntry[];
  metric?: TimelineMetric;
}

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: "bg-central-500",
  yellow: "bg-warning",
  red: "bg-error",
  gray: "bg-sage-300",
};

const HEALTH_LABELS: Record<HealthStatus, string> = {
  green: "Healthy",
  yellow: "Watch",
  red: "At Risk",
  gray: "Unknown",
};

export function TimelineChart({ arrData, milestones, deals, activeDeal = null, healthHistory = [], metric = "arr" }: TimelineChartProps) {

  const chartData = arrData;
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

  const formatValue = metric === "lines" ? formatLines : formatCurrency;

  // Project to a unified {timestamp, date, actual, forecast} shape.
  // Lines have no forecast — set to null so the forecast series is a no-op.
  const displayData = chartData.map((d) => ({
    date: d.date,
    timestamp: toTs(d.date),
    actual: metric === "lines" ? d.linesActual ?? null : d.actual,
    forecast: metric === "lines" ? null : d.forecast,
  }));

  const minTs = displayData[0].timestamp;
  const maxTs = displayData[displayData.length - 1].timestamp;
  const ticks = monthTicks(minTs, maxTs);

  const latestArrActual = [...chartData].reverse().find((d) => d.actual != null);
  const latestLinesActual = [...chartData].reverse().find((d) => d.linesActual != null);
  const nowTs = latestArrActual ? toTs(latestArrActual.date) : null;

  return (
    <div className="rounded-xl border border-sage-200 bg-white">
      {/* Header row */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-sage-900">Timeline</h2>
          <span className="text-xs text-sage-400">
            {metric === "lines" ? "Lines Actuals" : "ARR Actuals vs Forecast"}
          </span>
        </div>

        {latestArrActual && (
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-sage-500">Current ARR</span>
            <span className="tabular-nums text-2xl font-bold tracking-tight text-sage-950">
              {formatCurrency(latestArrActual.actual!)}
            </span>
            {latestLinesActual && (
              <span className="tabular-nums text-xs text-sage-500">
                · {formatLinesFull(latestLinesActual.linesActual!)} lines
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-[240px] px-2">
          <ResponsiveContainer>
            <ComposedChart data={displayData} margin={{ top: 20, right: 24, bottom: 4, left: 8 }}>
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
                type="number"
                dataKey="timestamp"
                scale="time"
                domain={[minTs, maxTs]}
                ticks={ticks}
                tickFormatter={formatMonthTick}
                tick={{ fontSize: 11, fill: "var(--color-sage-400)" }}
                axisLine={{ stroke: "var(--color-sage-200)" }}
                tickLine={false}
                dy={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-sage-400)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatValue}
                width={54}
              />
              <Tooltip
                content={<CustomTooltip chartMilestones={chartMilestones} metric={metric} />}
              />

              {/* "Now" divider — shade future region */}
              {nowTs !== null && nowTs < maxTs && (
                <ReferenceArea
                  x1={nowTs}
                  x2={maxTs}
                  fill="var(--color-sage-50)"
                  fillOpacity={0.8}
                  strokeOpacity={0}
                />
              )}

              {/* Forecast area — ARR only (no forecast data for lines) */}
              {metric === "arr" && (
                <Area
                  type="monotone"
                  dataKey="forecast"
                  stroke="var(--color-sage-300)"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  fill="url(#arrForecastGrad)"
                />
              )}

              {/* Actual area */}
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
                    key={`${m.date}-${i}`}
                    x={toTs(m.date)}
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
              {nowTs !== null && (
                <ReferenceLine
                  x={nowTs}
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
      {/* Health status track — time-aligned with chart plot area */}
      {healthHistory.length > 0 && (() => {
        const rangeSpan = maxTs - minTs || 1;
        const segments = healthHistory
          .map((entry, i) => {
            const entryTs = toTs(entry.date);
            const nextTs = i + 1 < healthHistory.length ? toTs(healthHistory[i + 1].date) : maxTs;
            const start = Math.max(minTs, entryTs);
            const end = Math.min(maxTs, nextTs);
            return { entry, start, end };
          })
          .filter(({ start, end }) => end > start);

        return (
          <div className="border-t border-sage-100 py-2.5">
            <div className="mb-1.5 flex items-center gap-2 px-6">
              <span className="text-3xs font-semibold uppercase tracking-wider text-sage-400">Account Health</span>
            </div>
            <div className="flex pl-[70px] pr-[32px]">
              {segments.map(({ entry, start, end }, i) => {
                const pct = ((end - start) / rangeSpan) * 100;
                return (
                  <div
                    key={`${entry.date}-${i}`}
                    className="group/h relative shrink-0"
                    style={{ width: `${pct}%` }}
                  >
                    <div
                      className={`h-2.5 ${HEALTH_COLORS[entry.status]} ${
                        i === 0 ? "rounded-l-full" : ""
                      } ${i === segments.length - 1 ? "rounded-r-full" : ""}`}
                    />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-sage-900 px-2 py-1 text-3xs text-white opacity-0 shadow transition-opacity group-hover/h:opacity-100">
                      {formatTooltipDate(start)}: {HEALTH_LABELS[entry.status]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="border-t border-sage-100 px-6 py-2.5">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5 text-xs text-sage-500">
            <span className="inline-block h-0.5 w-4 rounded bg-central-600" />
            {metric === "lines" ? "Actual Lines" : "Actual ARR"}
          </span>
          {metric === "arr" && (
            <span className="flex items-center gap-1.5 text-xs text-sage-400">
              <span className="inline-block h-0.5 w-4 border-t border-dashed border-sage-300" /> Forecast
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  chartMilestones,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: number;
  chartMilestones: Milestone[];
  metric: TimelineMetric;
}) {
  if (!active || !payload || label == null) return null;

  const hoverTs = typeof label === "number" ? label : Number(label);
  const nearby = chartMilestones.filter((m) => Math.abs(toTs(m.date) - hoverTs) <= 4 * DAY);
  const actual = payload.find((p) => p.name === "actual")?.value;
  const forecast = payload.find((p) => p.name === "forecast")?.value;
  const formatValue = metric === "lines" ? formatLinesFull : formatCurrency;

  return (
    <div className="rounded-lg border border-sage-200 bg-white px-3 py-2 shadow-sm">
      <div className="mb-1 text-xs font-semibold text-sage-700">{formatTooltipDate(hoverTs)}</div>
      {actual !== null && actual !== undefined && (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full bg-central-600" />
          <span className="text-sage-500">Actual</span>
          <span className="tabular-nums font-semibold text-sage-900">{formatValue(actual)}</span>
        </div>
      )}
      {forecast !== null && forecast !== undefined && (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full bg-sage-300" />
          <span className="text-sage-500">Forecast</span>
          <span className="tabular-nums font-semibold text-sage-700">{formatValue(forecast)}</span>
        </div>
      )}
      {nearby.length > 0 && (
        <div className="mt-1.5 border-t border-sage-100 pt-1.5">
          {nearby.map((m, i) => (
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
