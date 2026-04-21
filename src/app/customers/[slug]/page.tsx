import {
  loadAccountBrief,
  loadCustomerData,
  getAvailableCustomerSlugs,
  loadOverallSentiment,
  loadSlackInsight,
} from "@/lib/data-loader";
import { getCustomerSlugs } from "@/lib/customer-loader";
import { buildFallbackAccountBrief } from "@/lib/customer-intelligence";
import { MOCK_KLARNA, MOCK_REVOLUT, MOCK_SANTANDER } from "@/lib/mock-data";
import { CustomerPageClient } from "./client";
import type { CustomerData, DealData } from "@/lib/types";

const MOCK_MAP: Record<string, CustomerData> = {
  klarna: MOCK_KLARNA,
  revolut: MOCK_REVOLUT,
  santander: MOCK_SANTANDER,
};

export function generateStaticParams() {
  const dataSlugs = getAvailableCustomerSlugs();
  const configSlugs = getCustomerSlugs();
  // Union: with `output: export`, every navigable slug must be pre-rendered. If only some
  // accounts have `data/customers/<slug>.json`, we still need pages for all `customers/*.json`.
  const slugSet = new Set([...configSlugs, ...dataSlugs]);
  return [...slugSet].sort().map((slug) => ({ slug }));
}

/**
 * Per-deal merge: fetched.deals is the authoritative list (it's built from
 * customer.json's revenue_lines). For each fetched deal we look up a mock
 * deal with the same label and use it to fill in fields the real connectors
 * couldn't supply (typically when HubSpot/Linear auth is down). Fetched
 * values always win when present.
 */
function mergeDeals(fetched: DealData[], mock: DealData[]): DealData[] {
  return fetched.map((fd) => {
    const m = mock.find((md) => md.label === fd.label);
    if (!m) return fd;
    return {
      ...fd,
      health: fd.health !== "gray" ? fd.health : m.health,
      healthUpdate: fd.healthUpdate ?? m.healthUpdate,
      healthUpdateUrl: fd.healthUpdateUrl ?? m.healthUpdateUrl,
      hubspotStage: fd.hubspotStage ?? m.hubspotStage,
      hubspotStageIndex: fd.hubspotStageIndex ?? m.hubspotStageIndex,
      implementationStage: fd.implementationStage ?? m.implementationStage,
      implementationStageIndex: fd.implementationStageIndex ?? m.implementationStageIndex,
      postLaunchStatus: fd.postLaunchStatus ?? m.postLaunchStatus,
      dealOwner: fd.dealOwner ?? m.dealOwner,
      linearProjectOwner: fd.linearProjectOwner ?? m.linearProjectOwner,
      linearProjectSlug: fd.linearProjectSlug ?? m.linearProjectSlug,
      dri: fd.dri ?? m.dri,
      driSource: fd.driSource ?? m.driSource,
      roles: Object.keys(fd.roles).length > 0 ? fd.roles : m.roles,
      arr: fd.arr ?? m.arr,
      activations: fd.activations ?? m.activations,
      goLiveProbability: fd.goLiveProbability ?? m.goLiveProbability,
      goLiveDate: fd.goLiveDate ?? m.goLiveDate,
      nextMarketingEffort: fd.nextMarketingEffort ?? m.nextMarketingEffort,
      linearIssueCount: fd.linearIssueCount > 0 ? fd.linearIssueCount : m.linearIssueCount,
    };
  });
}

function mergeWithMock(fetched: CustomerData | null, mock: CustomerData | undefined): CustomerData | null {
  if (!fetched && !mock) return null;
  /** No API-backed `data/customers/<slug>.json` — keep mock charts/deals but omit fake flagged Linear rows. */
  if (!fetched) return mock ? { ...mock, linearIssues: [] } : null;
  if (!mock) return fetched;

  return {
    ...fetched,
    deals: fetched.deals.length > 0 ? mergeDeals(fetched.deals, mock.deals) : mock.deals,
    arrActuals: (fetched.arrActuals ?? []).length > 0 ? fetched.arrActuals : mock.arrActuals,
    forecast: (fetched.forecast ?? []).length > 0 ? fetched.forecast : mock.forecast,
    milestones: (fetched.milestones ?? []).length > 0 ? fetched.milestones : mock.milestones,
    // Real fetch-data output only: never substitute mock flagged issues when empty.
    linearIssues: fetched.linearIssues,
    health: fetched.health !== "gray" ? fetched.health : mock.health,
    driName: fetched.driName ?? mock.driName,
    driAvatarUrl: fetched.driAvatarUrl ?? mock.driAvatarUrl,
    healthHistory: (fetched.healthHistory ?? []).length > 0 ? fetched.healthHistory : mock.healthHistory,
  };
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fetched = loadCustomerData(slug);
  const mock = MOCK_MAP[slug];
  const data = mergeWithMock(fetched, mock);

  if (!data) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-sage-900">Customer not found</h1>
        <p className="mt-2 text-sm text-sage-500">
          No data available for &ldquo;{slug}&rdquo;
        </p>
      </div>
    );
  }

  const slackInsight = loadSlackInsight(slug);
  const overallSentiment = loadOverallSentiment(slug);
  const accountBrief = loadAccountBrief(slug) ?? buildFallbackAccountBrief(data, overallSentiment, slackInsight);

  return (
    <CustomerPageClient
      data={data}
      slackInsight={slackInsight}
      overallSentiment={overallSentiment}
      accountBrief={accountBrief}
    />
  );
}
