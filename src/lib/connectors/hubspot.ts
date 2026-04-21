import { readCache, writeCache } from "../cache";
import type { ConnectorResult } from "../types";

const BASE_URL = "https://api.hubapi.com";

export interface HubSpotDealData {
  dealId: string;
  dealName: string;
  stage: string;
  stageLabel: string;
  stageIndex: number;
  amount: number | null;
  closeDate: string | null;
  ownerId: string | null;
  ownerName: string | null;
}

export interface HubSpotDataForCustomer {
  deals: Record<string, HubSpotDealData>;
  companyName: string | null;
}

// Stage mapping — will be populated from API or use defaults
// These internal IDs need to be discovered per HubSpot instance
// For now, we map by stage label name
const STAGE_LABELS: Record<string, { label: string; index: number }> = {
  // Common HubSpot stage names — adjusted to match Gigs pipeline
  appointmentscheduled: { label: "Open Leads", index: 0 },
  qualifiedtobuy: { label: "Pursuing", index: 1 },
  presentationscheduled: { label: "Prospects", index: 2 },
  decisionmakerboughtin: { label: "S1 Discovery", index: 3 },
  contractsent: { label: "S2 Proposal", index: 4 },
  closedwon: { label: "S4 Closed Won", index: 6 },
  closedlost: { label: "Closed Lost", index: -1 },
};

async function hubspotFetch<T>(path: string): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN not set");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`HubSpot API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// Fetch and cache the pipeline stages mapping
async function fetchPipelineStages(noCache: boolean): Promise<Record<string, { label: string; index: number }>> {
  if (!noCache) {
    const cached = readCache<Record<string, { label: string; index: number }>>("hubspot", "pipeline-stages");
    if (cached) return cached;
  }

  try {
    const data = await hubspotFetch<{
      results: Array<{
        stages: Array<{
          stageId: string;
          label: string;
          displayOrder: number;
        }>;
      }>;
    }>("/crm/v3/pipelines/deals");

    const stages: Record<string, { label: string; index: number }> = {};
    if (data.results.length > 0) {
      data.results[0].stages.forEach((s) => {
        stages[s.stageId] = { label: s.label, index: s.displayOrder };
      });
    }

    writeCache("hubspot", "pipeline-stages", stages);
    return stages;
  } catch (e) {
    console.warn("  [hubspot] Failed to fetch pipeline stages:", (e as Error).message);
    return STAGE_LABELS;
  }
}

async function fetchOwnerName(ownerId: string, noCache: boolean): Promise<string | null> {
  const cacheKey = `owner-${ownerId}`;
  if (!noCache) {
    const cached = readCache<string>("hubspot", cacheKey);
    if (cached) return cached;
  }

  try {
    const data = await hubspotFetch<{
      firstName?: string;
      lastName?: string;
      email?: string;
    }>(`/crm/v3/owners/${ownerId}`);

    const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.email || null;
    if (name) writeCache("hubspot", cacheKey, name);
    return name;
  } catch {
    return null;
  }
}

async function fetchDeal(
  dealId: string,
  stages: Record<string, { label: string; index: number }>,
  noCache: boolean,
): Promise<HubSpotDealData | null> {
  if (!noCache) {
    const cached = readCache<HubSpotDealData>("hubspot", `deal-${dealId}`);
    if (cached) return cached;
  }

  try {
    const data = await hubspotFetch<{
      properties: {
        dealname?: string;
        dealstage?: string;
        amount?: string;
        closedate?: string;
        hubspot_owner_id?: string;
      };
    }>(`/crm/v3/objects/deals/${dealId}?properties=dealname,dealstage,amount,closedate,hubspot_owner_id`);

    const stageId = data.properties.dealstage ?? "";
    const stageInfo = stages[stageId] ?? { label: stageId, index: -1 };

    const ownerName = data.properties.hubspot_owner_id
      ? await fetchOwnerName(data.properties.hubspot_owner_id, noCache)
      : null;

    const result: HubSpotDealData = {
      dealId,
      dealName: data.properties.dealname ?? "",
      stage: stageId,
      stageLabel: stageInfo.label,
      stageIndex: stageInfo.index,
      amount: data.properties.amount ? parseFloat(data.properties.amount) : null,
      closeDate: data.properties.closedate ?? null,
      ownerId: data.properties.hubspot_owner_id ?? null,
      ownerName,
    };

    writeCache("hubspot", `deal-${dealId}`, result);
    return result;
  } catch (e) {
    console.warn(`  [hubspot] Failed to fetch deal ${dealId}:`, (e as Error).message);
    return null;
  }
}

export async function fetchHubSpotData(
  dealIds: string[],
  companyId: string,
  noCache: boolean,
): Promise<ConnectorResult<HubSpotDataForCustomer>> {
  try {
    const stages = await fetchPipelineStages(noCache);
    const dealResults = await Promise.all(dealIds.map((id) => fetchDeal(id, stages, noCache)));

    const deals: Record<string, HubSpotDealData> = {};
    dealIds.forEach((id, i) => {
      if (dealResults[i]) {
        deals[id] = dealResults[i]!;
      }
    });

    // Optionally fetch company name
    let companyName: string | null = null;
    if (companyId) {
      try {
        const company = await hubspotFetch<{ properties: { name?: string } }>(
          `/crm/v3/objects/companies/${companyId}?properties=name`,
        );
        companyName = company.properties.name ?? null;
      } catch {
        // Non-critical
      }
    }

    return {
      data: { deals, companyName },
      error: null,
      source: "hubspot",
    };
  } catch (e) {
    return {
      data: null,
      error: (e as Error).message,
      source: "hubspot",
    };
  }
}
