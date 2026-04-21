"use client";

import { useState } from "react";
import type { SlackInsightPayload } from "@/lib/types";

const SENTIMENT_META: Record<string, { label: string; dot: string; text: string }> = {
  positive: { label: "Positive", dot: "bg-central-500", text: "text-central-700" },
  negative: { label: "Negative", dot: "bg-red-500", text: "text-red-700" },
  neutral: { label: "Neutral", dot: "bg-sage-400", text: "text-sage-700" },
  no_signal: { label: "No signal", dot: "bg-sage-200", text: "text-sage-400" },
  mixed: { label: "Mixed", dot: "bg-warning", text: "text-warning" },
};

function sentimentMeta(s: string) {
  return SENTIMENT_META[s] ?? { label: s, dot: "bg-sage-300", text: "text-sage-700" };
}

const SIGNAL_META: Record<string, { label: string; classes: string }> = {
  warning: { label: "Warning", classes: "border-l-warning bg-warning/8" },
  momentum: { label: "Momentum", classes: "border-l-central-500 bg-central-50/50" },
  opportunity: { label: "Opportunity", classes: "border-l-central-600 bg-central-50/50" },
  change: { label: "Change", classes: "border-l-sage-500 bg-sage-50/50" },
};

function signalMeta(t: string) {
  return SIGNAL_META[t] ?? { label: t, classes: "border-l-sage-300 bg-white" };
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-sage-500 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function SlackInsightPanel({ insight }: { insight: SlackInsightPayload }) {
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);

  const updated = new Date(insight.generated_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <section
      className="space-y-4 rounded-xl border border-sage-200 bg-white px-6 py-5 shadow-sm"
      aria-labelledby="slack-insight-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sage-100 pb-3">
        <div>
          <h2 id="slack-insight-heading" className="text-base font-semibold text-sage-950">
            Slack pulse
          </h2>
          <p className="text-xs text-sage-500">From recent conversations with the customer</p>
        </div>
        <p className="text-xs tabular-nums text-sage-400">Updated {updated}</p>
      </div>

      {/* Stakeholders */}
      {insight.stakeholders.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-sage-800">Stakeholders</h3>
          <div className="overflow-x-auto rounded-lg border border-sage-100">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-sage-100 bg-sage-50/60 text-xs font-medium text-sage-600">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Sentiment</th>
                  <th className="px-3 py-2 font-medium">Signal</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {insight.stakeholders.map((row, i) => {
                  const meta = sentimentMeta(row.sentiment);
                  return (
                    <tr key={`${row.name}-${i}`} className="border-b border-sage-50 last:border-0">
                      <td className="px-3 py-2.5 text-sage-950">
                        <div className="font-medium">{row.name}</div>
                        {row.title ? (
                          <div className="mt-0.5 text-xs font-normal text-sage-500">{row.title}</div>
                        ) : null}
                      </td>
                      <td className={`px-3 py-2.5 ${meta.text}`}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-sage-800">{row.signal}</td>
                      <td className="px-3 py-2.5 text-right">
                        {row.url ? (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-central-700 hover:text-central-800 hover:underline"
                          >
                            Open →
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Updates */}
      {insight.updates.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-sage-200">
          <button
            type="button"
            onClick={() => setUpdatesOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 bg-sage-50/60 px-4 py-3 text-left transition-colors hover:bg-sage-50"
            aria-expanded={updatesOpen}
            id="slack-insight-updates-toggle"
          >
            <span className="text-sm font-semibold text-sage-800">
              Recent updates{" "}
              <span className="font-normal text-sage-400">· {insight.updates.length}</span>
            </span>
            <Chevron open={updatesOpen} />
          </button>
          {updatesOpen ? (
            <ul className="space-y-2 border-t border-sage-100 p-3" role="region" aria-labelledby="slack-insight-updates-toggle">
              {insight.updates.map((u, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-sage-100 bg-white px-4 py-3 text-sm text-sage-800"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="tabular-nums text-xs font-medium text-sage-500">{u.timestamp}</span>
                    {u.url ? (
                      <a
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-central-700 hover:text-central-800 hover:underline"
                      >
                        Open in Slack →
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-1">{u.summary}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* Signals */}
      {insight.signals.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-sage-200">
          <button
            type="button"
            onClick={() => setSignalsOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 bg-sage-50/60 px-4 py-3 text-left transition-colors hover:bg-sage-50"
            aria-expanded={signalsOpen}
            id="slack-insight-signals-toggle"
          >
            <span className="text-sm font-semibold text-sage-800">
              Signals <span className="font-normal text-sage-400">· {insight.signals.length}</span>
            </span>
            <Chevron open={signalsOpen} />
          </button>
          {signalsOpen ? (
            <ul className="space-y-2 border-t border-sage-100 p-3" role="region" aria-labelledby="slack-insight-signals-toggle">
              {insight.signals.map((s, i) => {
                const meta = signalMeta(s.type);
                return (
                  <li
                    key={i}
                    className={`rounded-lg border border-l-4 border-sage-100 px-4 py-3 text-sm ${meta.classes}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-sage-700">{meta.label}</span>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-central-700 hover:text-central-800 hover:underline"
                        >
                          View →
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sage-900">{s.summary}</p>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
