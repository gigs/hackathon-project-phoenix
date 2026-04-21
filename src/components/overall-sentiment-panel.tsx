import type { OverallSentimentPayload, OverallSentimentSignal } from "@/lib/types";

function sourceLabel(source: OverallSentimentSignal["source"]) {
  return source === "linear" ? "Linear" : "Slack";
}

function sourceBadge(source: OverallSentimentSignal["source"]) {
  if (source === "linear") {
    return "border-central-200 bg-central-50 text-central-800";
  }
  return "border-sage-200 bg-sage-50 text-sage-700";
}

function SignalRow({ signal, accent }: { signal: OverallSentimentSignal; accent: "momentum" | "warning" }) {
  const accentClass =
    accent === "momentum"
      ? "border-l-central-500 bg-central-50/40"
      : "border-l-warning bg-warning/8";
  const linkLabel = signal.source === "linear" ? "View in Linear" : "View in Slack";
  return (
    <li
      className={`rounded-md border border-sage-100 border-l-4 px-3 py-2.5 text-sm text-sage-900 ${accentClass}`}
    >
      <p className="leading-snug">{signal.summary}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`rounded-full border px-2 py-0.5 font-medium ${sourceBadge(signal.source)}`}>
          {sourceLabel(signal.source)}
        </span>
        {signal.url ? (
          <a
            href={signal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-central-700 hover:text-central-800 hover:underline"
          >
            {linkLabel} →
          </a>
        ) : null}
      </div>
    </li>
  );
}

function Column({
  label,
  signals,
  accent,
  emptyText,
}: {
  label: string;
  signals: OverallSentimentSignal[];
  accent: "momentum" | "warning";
  emptyText: string;
}) {
  const dotColor = accent === "momentum" ? "bg-central-500" : "bg-warning";
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-sage-800">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden />
        {label}
        <span className="font-normal text-sage-400">· {signals.length}</span>
      </h3>
      {signals.length === 0 ? (
        <p className="rounded-md border border-dashed border-sage-200 bg-white px-3 py-2 text-xs text-sage-500">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-2">
          {signals.map((s, i) => (
            <SignalRow key={i} signal={s} accent={accent} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function OverallSentimentPanel({ sentiment }: { sentiment: OverallSentimentPayload }) {
  const updated = new Date(sentiment.generated_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <section
      className="space-y-4 rounded-xl border border-sage-200 bg-white px-6 py-5 shadow-sm"
      aria-labelledby="overall-sentiment-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sage-100 pb-3">
        <div>
          <h2 id="overall-sentiment-heading" className="text-base font-semibold text-sage-950">
            Overall sentiment
          </h2>
          <p className="text-xs text-sage-500">Past {sentiment.lookback_days} days</p>
        </div>
        <p className="text-xs tabular-nums text-sage-400">Updated {updated}</p>
      </div>

      <p className="text-base leading-relaxed text-sage-950">{sentiment.summary}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Column
          label="What's going well"
          signals={sentiment.momentum_signals}
          accent="momentum"
          emptyText="Nothing notable to celebrate this window."
        />
        <Column
          label="Pay attention"
          signals={sentiment.warning_signs}
          accent="warning"
          emptyText="No warning signs in this window."
        />
      </div>
    </section>
  );
}
