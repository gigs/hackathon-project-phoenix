import type { SlackInsightPayload, SlackInsightRelationshipHealth } from "@/lib/types";

function healthPill(status: SlackInsightRelationshipHealth) {
  const map: Record<SlackInsightRelationshipHealth, string> = {
    green: "bg-emerald-100 text-emerald-900 border-emerald-200",
    yellow: "bg-amber-100 text-amber-900 border-amber-200",
    red: "bg-red-100 text-red-900 border-red-200",
  };
  return map[status] ?? map.yellow;
}

function sentimentClass(s: string) {
  if (s === "positive") return "text-emerald-700";
  if (s === "negative") return "text-red-700";
  if (s === "no_signal") return "text-sage-400";
  return "text-sage-800";
}

function signalTypeClass(t: string) {
  if (t === "warning") return "border-l-amber-500 bg-amber-50/50";
  if (t === "momentum") return "border-l-emerald-500 bg-emerald-50/50";
  if (t === "opportunity") return "border-l-central-600 bg-central-50/50";
  if (t === "change") return "border-l-sage-500 bg-sage-50/50";
  return "border-l-sage-300 bg-white";
}

export function SlackInsightPanel({ insight }: { insight: SlackInsightPayload }) {
  const updated = new Date(insight.generated_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const sourceLine = insight.sources
    .map((s) => `${s.channel} (${s.message_count} msg)`)
    .join(" · ");

  return (
    <section
      className="space-y-4 rounded-xl border border-sage-200 bg-white px-6 py-4 shadow-sm"
      aria-labelledby="slack-insight-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sage-100 pb-3">
        <h2 id="slack-insight-heading" className="text-sm font-semibold uppercase tracking-wide text-sage-600">
          Relationship insight
        </h2>
        <p className="text-xs tabular-nums text-sage-400">Generated {updated}</p>
      </div>

      {sourceLine ? (
        <p className="text-xs text-sage-600">
          Transcript sources: <span className="text-sage-800">{sourceLine}</span>
        </p>
      ) : null}

      {/* Health */}
      <div className={`rounded-lg border px-4 py-3 ${healthPill(insight.health.status)}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide">Health</span>
          <span className="rounded px-2 py-0.5 text-xs font-semibold capitalize">{insight.health.status}</span>
        </div>
        <p className="mt-2 text-sm leading-snug">{insight.health.summary}</p>
      </div>

      {/* Stakeholders */}
      {insight.stakeholders.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sage-600">Stakeholders</h3>
          <div className="overflow-x-auto rounded-lg border border-sage-100">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-sage-100 bg-sage-50/80 text-xs font-semibold uppercase tracking-wide text-sage-600">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Sentiment</th>
                  <th className="px-3 py-2">Signal</th>
                  <th className="px-3 py-2">Link</th>
                </tr>
              </thead>
              <tbody>
                {insight.stakeholders.map((row, i) => (
                  <tr key={`${row.name}-${i}`} className="border-b border-sage-50 last:border-0">
                    <td className="px-3 py-2 font-medium text-sage-950">{row.name}</td>
                    <td className={`px-3 py-2 tabular-nums ${sentimentClass(row.sentiment)}`}>{row.sentiment}</td>
                    <td className="px-3 py-2 text-sage-800">{row.signal}</td>
                    <td className="px-3 py-2">
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-central-700 underline decoration-central-600/40 hover:decoration-central-700"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-sage-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Updates */}
      {insight.updates.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sage-600">
            Updates <span className="font-normal text-sage-400">(top from window)</span>
          </h3>
          <ul className="space-y-2">
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
                      className="text-xs text-central-700 underline"
                    >
                      Slack link
                    </a>
                  ) : null}
                </div>
                <p className="mt-1">{u.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Signals */}
      {insight.signals.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sage-600">Signals</h3>
          <ul className="space-y-2">
            {insight.signals.map((s, i) => (
              <li
                key={i}
                className={`rounded-lg border border-l-4 border-sage-100 px-4 py-3 text-sm ${signalTypeClass(s.type)}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-sage-600">{s.type}</span>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-central-700 underline"
                    >
                      Evidence
                    </a>
                  ) : (
                    <span className="text-xs text-sage-400">No link</span>
                  )}
                </div>
                <p className="mt-1 text-sage-900">{s.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
