"use client";

import { useState } from "react";
import type { DealData, LinearIssue, PersonRef, DealLifecycle } from "@/lib/types";
import { HealthDot } from "./health-dot";
import { StagePipeline } from "./stage-pipeline";

const LINEAR_ORG = process.env.NEXT_PUBLIC_LINEAR_ORG_SLUG ?? "gigs";

const STATUS_COLORS: Record<string, string> = {
  "In Progress": "bg-purple-100 text-purple-700",
  Todo: "bg-blue-100 text-blue-700",
  Done: "bg-central-50 text-central-700",
  Backlog: "bg-sage-100 text-sage-600",
};

function linearProjectUrl(slug: string) {
  return `https://linear.app/${LINEAR_ORG}/project/${slug}`;
}

function rolesByLifecycle(roles: DealData["roles"], lifecycle: DealLifecycle): { role: string; person: PersonRef }[] {
  const result: { role: string; person: PersonRef }[] = [];
  if (lifecycle === "presales") {
    if (roles.bd) result.push({ role: "BD", person: roles.bd });
    if (roles.solutionEng) result.push({ role: "SE", person: roles.solutionEng });
  } else if (lifecycle === "implementation") {
    if (roles.im) result.push({ role: "IM", person: roles.im });
    if (roles.partnerMarketeer) result.push({ role: "PM", person: roles.partnerMarketeer });
    if (roles.bd) result.push({ role: "BD", person: roles.bd });
  } else {
    if (roles.partnerManager) result.push({ role: "Mgr", person: roles.partnerManager });
    if (roles.partnerMarketeer) result.push({ role: "PM", person: roles.partnerMarketeer });
  }
  return result;
}

function Avatar({ person, role }: { person: PersonRef; role: string }) {
  const initials = person.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="group relative" title={`${role}: ${person.name}`}>
      {person.avatarUrl ? (
        <img
          src={person.avatarUrl}
          alt={person.name}
          className="h-6 w-6 rounded-full border border-sage-200 object-cover"
        />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-central-100 text-3xs font-semibold text-central-700">
          {initials}
        </div>
      )}
      <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-sage-900 px-2 py-1 text-3xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {role}: {person.name}
      </div>
    </div>
  );
}

export function DealsTable({
  deals,
  customerName,
  issues,
  activeDeal,
}: {
  deals: DealData[];
  customerName: string;
  issues: LinearIssue[];
  activeDeal?: string | null;
}) {
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);

  const filteredDeals = activeDeal ? deals.filter((d) => d.label === activeDeal) : deals;

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
          {filteredDeals.length} {filteredDeals.length === 1 ? "deal" : "deals"}
          {issues.length > 0 && ` · ${issues.length} flagged issues`}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[140px_100px_90px_1fr_140px_90px_70px] border-b border-sage-100 bg-sage-25 px-5 py-2.5">
        {["Market", "Team", "Health", "Pipeline", "Next Marketing", "Go-Live", "Issues"].map(
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
      {filteredDeals.map((deal, i) => {
        const dealIssues = issuesByDeal.get(deal.label) ?? [];
        const urgentIssues = dealIssues.filter((issue) => issue.priority <= 1);
        const otherIssues = dealIssues.filter((issue) => issue.priority > 1);
        const isExpanded = expandedDeal === deal.label;
        const hasOtherIssues = otherIssues.length > 0;
        const visibleRoles = rolesByLifecycle(deal.roles, deal.lifecycle);

        return (
          <div key={deal.label}>
            <div
              className={`grid grid-cols-[140px_100px_90px_1fr_140px_90px_70px] items-center border-b px-5 py-3 transition ${
                isExpanded ? "border-sage-200 bg-sage-25" : "border-sage-50 hover:bg-sage-75"
              } ${hasOtherIssues ? "cursor-pointer" : ""}`}
              style={{ "--stagger-index": i } as React.CSSProperties}
              onClick={() => hasOtherIssues && setExpandedDeal(isExpanded ? null : deal.label)}
            >
              {/* Market + Linear link */}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-sage-900">{deal.label}</span>
                  {deal.linearProjectSlug && (
                    <a
                      href={linearProjectUrl(deal.linearProjectSlug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-3xs text-central-600 hover:text-central-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Linear →
                    </a>
                  )}
                </div>
                {deal.postLaunchStatus && (
                  <span className="mt-0.5 inline-block rounded-full bg-central-50 px-2 py-0.5 text-3xs font-medium text-central-700">
                    {deal.postLaunchStatus}
                  </span>
                )}
              </div>

              {/* Team — role avatars */}
              <div className="flex items-center -space-x-1">
                {visibleRoles.length > 0 ? (
                  visibleRoles.map(({ role, person }) => (
                    <Avatar key={role} person={person} role={role} />
                  ))
                ) : (
                  <span className="text-xs text-sage-400">—</span>
                )}
              </div>

              {/* Health */}
              <HealthDot status={deal.health} href={deal.healthUpdateUrl} update={deal.healthUpdate} />

              {/* Pipeline — full unified stepper */}
              <div className="py-1 pr-4">
                <StagePipeline
                  lifecycle={deal.lifecycle}
                  hubspotStageIndex={deal.hubspotStageIndex}
                  implementationStageIndex={deal.implementationStageIndex}
                />
              </div>

              {/* Next marketing effort */}
              {deal.nextMarketingEffort ? (
                <div className="group/mkt relative cursor-default">
                  <div className="text-xs font-medium text-sage-700">
                    {new Date(deal.nextMarketingEffort.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </div>
                  <div className="truncate text-3xs text-sage-400 max-w-[130px]">
                    {deal.nextMarketingEffort.description}
                  </div>
                  <div className="pointer-events-none absolute left-0 top-full z-50 mt-1 w-[260px] rounded-lg border border-sage-200 bg-white p-3 opacity-0 shadow-lg transition-opacity group-hover/mkt:opacity-100">
                    <div className="mb-1 text-3xs font-semibold uppercase tracking-wider text-sage-400">Next Marketing Effort</div>
                    <div className="text-xs font-medium text-sage-700">
                      {new Date(deal.nextMarketingEffort.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-sage-600">{deal.nextMarketingEffort.description}</p>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-sage-400">—</span>
              )}

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

              {/* Issues count */}
              {dealIssues.length > 0 ? (
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
                  {urgentIssues.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))}
                </div>
              </div>
            )}

            {/* Other issues — expanded on click */}
            {isExpanded && otherIssues.length > 0 && (
              <div className="border-b border-sage-200 bg-sage-25 px-5 py-2.5">
                <div className="space-y-2">
                  {otherIssues.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Unmatched issues */}
      {unmatched.length > 0 && !activeDeal && (
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
