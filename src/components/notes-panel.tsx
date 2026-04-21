"use client";

import { useState } from "react";
import type { LinearIssue, DealData } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  "In Progress": "bg-purple-100 text-purple-700",
  Todo: "bg-blue-100 text-blue-700",
  Done: "bg-central-50 text-central-700",
  Backlog: "bg-sage-100 text-sage-600",
};

export function NotesPanel({
  issues,
  deals,
}: {
  issues: LinearIssue[];
  deals: DealData[];
}) {
  const markets = ["All", ...deals.map((d) => d.label)];
  const [activeTab, setActiveTab] = useState("All");

  const filtered =
    activeTab === "All" ? issues : issues.filter((i) => i.market === activeTab);

  return (
    <div className="flex flex-col rounded-xl border border-sage-200 bg-white">
      {/* Header */}
      <div className="border-b border-sage-100 px-4 py-4">
        <h2 className="mb-2 text-sm font-bold text-sage-900">Notes & Issues</h2>
        <div className="flex gap-1">
          {markets.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                activeTab === tab
                  ? "bg-central-50 text-central-700"
                  : "text-sage-400 hover:text-sage-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Issues list */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-sage-400">
            No flagged issues
          </div>
        ) : (
          filtered.map((issue) => (
            <div
              key={issue.id}
              className={`mb-2 rounded-lg border p-3 ${
                issue.priority <= 1
                  ? "border-warning/30 bg-amber-50/50"
                  : "border-sage-100 bg-sage-25"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-3xs font-bold uppercase ${
                    STATUS_COLORS[issue.status] ?? "bg-sage-100 text-sage-600"
                  }`}
                >
                  {issue.status}
                </span>
                {issue.market && (
                  <span className="text-3xs text-sage-400">{issue.market}</span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-sage-700">{issue.title}</p>
              <div className="mt-1.5 flex items-center justify-between">
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
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-3 border-t border-sage-100 px-4 py-2.5 text-3xs text-sage-400">
        <span>Sources:</span>
        <span className="text-central-600">Linear</span>
      </div>
    </div>
  );
}
