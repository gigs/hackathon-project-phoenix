"use client";

import type { AccountBriefPayload } from "@/lib/types";

function SourcePill({ source }: { source: string }) {
  const classes =
    source === "linear"
      ? "border-sage-200 bg-sage-50 text-sage-700"
      : source === "hubspot"
        ? "border-central-200 bg-central-50 text-central-800"
        : source === "arr"
          ? "border-sage-200 bg-white text-sage-700"
          : "border-sage-200 bg-sage-25 text-sage-600";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide ${classes}`}>
      {source}
    </span>
  );
}

export function AccountBriefPanel({ brief }: { brief: AccountBriefPayload }) {
  const momentum = brief.why_now[0];
  const risk = brief.top_risks[0];
  const nextStep = brief.next_milestone;

  return (
    <section className="rounded-xl border border-sage-200 bg-white px-5 py-5">
      <div className="border-b border-sage-100 pb-3">
        <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-sage-500">
          Executive brief
        </div>
        <h2 className="mt-1 text-lg font-semibold text-sage-950">What matters now</h2>
        <p className="mt-2 max-w-[860px] text-sm leading-6 text-sage-900">{brief.headline}</p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <BriefCard
          label="Momentum"
          tone="neutral"
          source={momentum?.source}
          url={momentum?.url ?? null}
          value={momentum?.summary ?? brief.commercial_state}
        />
        <BriefCard
          label="Risk"
          tone="warning"
          source={risk?.source}
          url={risk?.url ?? null}
          value={risk?.summary ?? brief.delivery_state}
        />
        <BriefCard
          label="Next step"
          tone="accent"
          source={nextStep?.source}
          url={nextStep?.url ?? null}
          value={
            nextStep
              ? `${nextStep.label}${nextStep.date ? ` (${nextStep.date})` : ""}`
              : brief.stakeholder_state
          }
        />
      </div>
    </section>
  );
}

function BriefCard({
  label,
  value,
  source,
  url,
  tone,
}: {
  label: string;
  value: string;
  source?: string;
  url: string | null;
  tone: "neutral" | "warning" | "accent";
}) {
  const toneClasses =
    tone === "warning"
      ? "border-warning/30 bg-warning/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
      : tone === "accent"
        ? "border-central-200 bg-central-50/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
        : "border-sage-100 bg-sage-25 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]";
  return (
    <div className={`rounded-xl border px-4 py-3 transition-transform hover:-translate-y-[1px] ${toneClasses}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-3xs font-semibold uppercase tracking-[0.16em] text-sage-500">{label}</div>
        {source ? <SourcePill source={source} /> : null}
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-3xs font-medium text-central-700 hover:text-central-800 hover:underline"
          >
            Open →
          </a>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-5 text-sage-900">{value}</p>
    </div>
  );
}
