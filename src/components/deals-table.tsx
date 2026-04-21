"use client";

import { useState } from "react";
import type { DealData, LinearIssue } from "@/lib/types";
import { HealthDot } from "./health-dot";
import { StagePipeline } from "./stage-pipeline";
import { MiniChart } from "./mini-chart";

const STATUS_COLORS: Record<string, string> = {
  "In Progress": "bg-purple-100 text-purple-700",
  Todo: "bg-blue-100 text-blue-700",
  Done: "bg-central-50 text-central-700",
  Backlog: "bg-sage-100 text-sage-600",
};

function formatArr(value: number | null) {
  if (value === null) return "—";
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value}`;
}

export function DealsTable({
  deals,
  customerName,
  issues,
}: {
  deals: DealData[];
  customerName: string;
  issues: LinearIssue[];
}) {
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);

  if (deals.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-sage-200 bg-white text-sm text-sage-400">
        No deals found for {customerName}
      </div>
    );
  }

  // Group issues by deal/market label
  const issuesByDeal = new Map<string, LinearIssue[]>();
  const unmatched: LinearIssue[] = [];
  for (const issue of issues) {
    if (issue.market) {
      const existing = issuesByDeal.get(issue.market) ?? [];
      existing.push(issue);
      issuesByDeal.set(issue.market, existing);
    } else {
      unmatched.push(issue);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-sage-200 bg-white">
      <div className="flex items-center justify-between border-b border-sage-100 px-5 py-4">
        <h2 className="text-sm font-bold text-sage-900">Deals by Market</h2>
        <span className="text-xs text-sage-400">
          {deals.length} {deals.length === 1 ? "deal" : "deals"}
          {issues.length > 0 && ` · ${issues.length} flagged issues`}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_60px_140px_120px_80px_90px_100px_70px] border-b border-sage-100 bg-sage-25 px-5 py-2.5">
        {["Market", "Health", "Pipeline Stage", "ARR Trend", "ARR", "Go-Live", "DRI", "Issues"].map(
          (h) => (
            <span
              key={h}
              className="text-3xs font-semibold uppercase tracking-wider text-sage-500"
            >
              {h}
            </span>
          ),
        )}
      </div>

      {/* Deal rows */}
      {deals.map((deal, i) => {
        const dealIssues = issuesByDeal.get(deal.label) ?? [];
        const urgentIssues = dealIssues.filter((issue) => issue.priority <= 1);
        const otherIssues = dealIssues.filter((issue) => issue.priority > 1);
        const isExpanded = expandedDeal === deal.label;
        const hasIssues = dealIssues.length > 0;
        const hasOtherIssues = otherIssues.length > 0;

        return (
          <div key={deal.label}>
            <div
              className={`grid grid-cols-[1fr_60px_140px_120px_80px_90px_100px_70px] items-center border-b px-5 py-3 transition ${
                isExpanded ? "border-sage-200 bg-sage-25" : "border-sage-50 hover:bg-sage-75"
              } ${hasOtherIssues ? "cursor-pointer" : ""}`}
              style={{ "--stagger-index": i } as React.CSSProperties}
              onClick={() => hasOtherIssues && setExpandedDeal(isExpanded ? null : deal.label)}
            >
              {/* Market */}
              <div>
                <div className="text-sm font-semibold text-sage-900">{deal.label}</div>
                {deal.hubspotStage && (
                  <div className="text-xs text-sage-400">{deal.hubspotStage}</div>
                )}
              </div>

              {/* Health */}
              <HealthDot status={deal.health} />

              {/* Pipeline */}
              <StagePipeline currentIndex={deal.hubspotStageIndex} />

              {/* Mini ARR chart */}
              <MiniChart data={deal.miniArrTrend} />

              {/* ARR */}
              <span className="tabular-nums text-sm font-semibold text-sage-900">
                {formatArr(deal.arr)}
              </span>

              {/* Go-live */}
              <span
                className={`text-xs font-medium ${
                  deal.goLiveProbability === "High"
                    ? "text-central-600"
                    : deal.goLiveProbability === "Med"
                      ? "text-warning"
                      : deal.goLiveProbability === "Low"
                        ? "text-error"
                        : "text-sage-400"
                }`}
              >
                {deal.goLiveProbability
                  ? `${deal.goLiveProbability}${deal.goLiveDate ? ` — ${deal.goLiveDate}` : ""}`
                  : "—"}
              </span>

              {/* DRI */}
              <div>
                {deal.dri ? (
                  <>
                    <div className="text-xs font-medium text-sage-700">{deal.dri}</div>
                    <div className="text-3xs text-sage-400">
                      {deal.driSource === "hubspot" ? "HubSpot Owner" : "Linear Owner"}
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-sage-400">—</span>
                )}
              </div>

              {/* Issues count */}
              {hasIssues ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    urgentIssues.length > 0
                      ? "bg-amber-100 text-amber-700"
                      : isExpanded
                        ? "bg-central-100 text-central-700"
                        : "bg-central-50 text-central-700"
                  }`}
                >
                  {dealIssues.length}
                  {hasOtherIssues && (
                    <svg
                      className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-sage-75 px-2 py-0.5 text-xs font-semibold text-sage-400">
                  0
                </span>
              )}
            </div>

            {/* Urgent issues — always visible */}
            {urgentIssues.length > 0 && (
              <div className="border-b border-sage-200 bg-amber-50/30 px-5 py-2.5">
                <div className="space-y-2">
                  {/* {urgentIssues.map((issue) => (
                    // <IssueRow key={issue.id} issue={issue} />
                  ))} */}
                </div>
              </div>
            )}

            {/* Other issues — expanded on click */}
            {isExpanded && otherIssues.length > 0 && (
              <div className="border-b border-sage-200 bg-sage-25 px-5 py-2.5">
                <div className="space-y-2">
                  {/* {otherIssues.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))} */}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Unmatched issues (not tied to a specific deal) */}
      {unmatched.length > 0 && (
        <div className="border-t border-sage-100 bg-sage-25 px-5 py-3">
          <div className="mb-2 text-3xs font-semibold uppercase tracking-wider text-sage-500">
            General Issues
          </div>
          <div className="space-y-2">
            {unmatched.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: LinearIssue }) {
  const isUrgent = issue.priority <= 1;
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        isUrgent ? "border-warning/30 bg-amber-50/50" : "border-sage-100 bg-white"
      }`}
    >
      <span
        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-3xs font-bold uppercase ${
          STATUS_COLORS[issue.status] ?? "bg-sage-100 text-sage-600"
        }`}
      >
        {issue.status}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-sage-700">{issue.title}</p>
        <div className="mt-1 flex items-center gap-3">
          {issue.assignee && (
            <span className="text-3xs text-sage-400">{issue.assignee}</span>
          )}
          <a
            href={issue.url}
            className="text-3xs font-medium text-central-600 hover:text-central-700"
          >
            Open in Linear →
          </a>
        </div>
      </div>
    </div>
  );
}
