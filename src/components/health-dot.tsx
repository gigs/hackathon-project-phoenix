"use client";

import { useState } from "react";
import type { HealthStatus, HealthUpdate } from "@/lib/types";

const COLORS: Record<HealthStatus, string> = {
  green: "bg-central-600",
  yellow: "bg-warning",
  red: "bg-error",
  gray: "bg-sage-400",
};

const LABELS: Record<HealthStatus, string> = {
  green: "Healthy",
  yellow: "At Risk",
  red: "Critical",
  gray: "No Data",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HealthDot({
  status,
  showLabel = false,
  href,
  update,
}: {
  status: HealthStatus;
  showLabel?: boolean;
  href?: string | null;
  update?: HealthUpdate | null;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const dot = (
    <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${COLORS[status]}`} />
  );

  const inner = (
    <>
      {dot}
      {showLabel && (
        <span className="text-xs font-medium text-sage-600">{LABELS[status]}</span>
      )}
      {update && (
        <span className="tabular-nums text-3xs text-sage-400">{timeAgo(update.date)}</span>
      )}
    </>
  );

  const wrapper = (
    <span
      className="relative inline-flex items-center gap-1.5"
      onMouseEnter={() => update && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:opacity-80"
        >
          {inner}
        </a>
      ) : (
        inner
      )}

      {/* Large tooltip with update contents */}
      {showTooltip && update && (
        <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-[320px] rounded-lg border border-sage-200 bg-white p-4 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-3xs font-semibold ${
              status === "green" ? "bg-central-50 text-central-700"
                : status === "yellow" ? "bg-amber-50 text-amber-700"
                : status === "red" ? "bg-red-50 text-red-700"
                : "bg-sage-75 text-sage-500"
            }`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${COLORS[status]}`} />
              {LABELS[status]}
            </span>
            <span className="text-3xs text-sage-400">{formatDate(update.date)}</span>
          </div>
          <p className="text-xs leading-relaxed text-sage-700">{update.body}</p>
          {update.author && (
            <div className="mt-2 text-3xs text-sage-400">— {update.author}</div>
          )}
        </div>
      )}
    </span>
  );

  return wrapper;
}
