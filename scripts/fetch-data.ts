import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { loadAllCustomerConfigs } from "../src/lib/customer-loader";
import { fetchLinearData } from "../src/lib/connectors/linear";
import { fetchHubSpotData } from "../src/lib/connectors/hubspot";
import { fetchSlackActivity } from "../src/lib/connectors/slack";
import { fetchARRData } from "../src/lib/connectors/lightdash";
import { fetchForecastData } from "../src/lib/connectors/forecast";
import { clearCache } from "../src/lib/cache";
import type {
  CustomerConfig,
  CustomerData,
  DealData,
  HealthStatus,
  LinearIssue,
  PortfolioEntry,
  HUBSPOT_STAGES,
} from "../src/lib/types";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CUSTOMERS_DATA_DIR = path.join(DATA_DIR, "customers");

const noCache = process.argv.includes("--no-cache");

// HubSpot stages for index lookup
const STAGES = [
  "S1 Discovery",
  "S2 Proposal",
  "S3 Negotiation",
  "S4 Closed Won",
] as const;

function stageIndex(label: string): number {
  const idx = STAGES.findIndex((s) => s === label);
  return idx >= 0 ? idx : -1;
}

function deriveHealth(healths: HealthStatus[]): HealthStatus {
  if (healths.includes("red")) return "red";
  if (healths.includes("yellow")) return "yellow";
  if (healths.includes("green")) return "green";
  return "gray";
}

function resolveStageIndex(stageLabel: string | null): number | null {
  if (!stageLabel) return null;
  const idx = stageIndex(stageLabel);
  return idx >= 0 ? idx : null;
}

async function fetchCustomerData(slug: string, config: CustomerConfig): Promise<CustomerData> {
  console.log(`\n📦 Fetching data for ${config.name}...`);

  // Collect all project slugs (account-level + revenue-line-level)
  const allProjectSlugs = [
    ...config.linear_projects,
    ...config.revenue_lines.flatMap((rl) => rl.linear_projects),
  ];

  // Collect all deal IDs
  const allDealIds = config.revenue_lines.flatMap((rl) => rl.hubspot_deal_record_ids);

  // Collect all Slack channels
  const allSlackChannels = [
    ...config.slack_channels,
    ...config.revenue_lines.flatMap((rl) => rl.slack_channels),
  ];

  // Fetch from all sources in parallel
  const [linearResult, hubspotResult, slackResult, arrResult, forecastResult] = await Promise.allSettled([
    fetchLinearData(allProjectSlugs, noCache),
    fetchHubSpotData(allDealIds, config.hubspot_company_record_id, noCache),
    fetchSlackActivity(allSlackChannels, noCache),
    fetchARRData(slug, noCache),
    fetchForecastData(slug, noCache),
  ]);

  const linear = linearResult.status === "fulfilled" ? linearResult.value.data : null;
  const hubspot = hubspotResult.status === "fulfilled" ? hubspotResult.value.data : null;
  const slack = slackResult.status === "fulfilled" ? slackResult.value.data : null;
  const arrActuals = arrResult.status === "fulfilled" ? (arrResult.value.data ?? []) : [];
  const forecast = forecastResult.status === "fulfilled" ? (forecastResult.value.data ?? []) : [];

  // Log any errors
  if (linearResult.status === "rejected") console.warn("  [linear] Error:", linearResult.reason);
  if (hubspotResult.status === "rejected") console.warn("  [hubspot] Error:", hubspotResult.reason);
  if (slackResult.status === "rejected") console.warn("  [slack] Error:", slackResult.reason);
  if (arrResult.status === "rejected") console.warn("  [lightdash] Error:", arrResult.reason);
  if (forecastResult.status === "rejected") console.warn("  [forecast] Error:", forecastResult.reason);

  // Build deal rows from revenue lines
  const deals: DealData[] = config.revenue_lines.map((rl) => {
    // Get Linear project data for this revenue line
    const linearProject = rl.linear_projects.length > 0 && linear
      ? linear.projects[rl.linear_projects[0]]
      : null;

    // Get HubSpot deal data
    const hubspotDeal = rl.hubspot_deal_record_ids.length > 0 && hubspot
      ? hubspot.deals[rl.hubspot_deal_record_ids[0]]
      : null;

    const hubspotStageLabel = hubspotDeal?.stageLabel ?? null;
    const hubspotStageIdx = hubspotStageLabel ? resolveStageIndex(hubspotStageLabel) : (hubspotDeal?.stageIndex ?? null);

    // Lifecycle: presales if no linear project, otherwise implementation
    const hasLinearProject = rl.linear_projects.length > 0 && linearProject !== null;
    const lifecycle = hasLinearProject ? "implementation" as const : "presales" as const;

    // DRI resolution: Linear owner for implementation, HubSpot owner for presales
    const linearOwner = linearProject?.lead ?? null;
    const hubspotOwner = hubspotDeal?.ownerName ?? null;
    const dri = lifecycle === "implementation" && linearOwner ? linearOwner : hubspotOwner ?? linearOwner;
    const driSource = dri === linearOwner && linearOwner ? "linear" as const
      : dri === hubspotOwner && hubspotOwner ? "hubspot" as const
      : null;

    return {
      label: rl.label,
      health: linearProject?.health ?? "gray",
      healthUpdateUrl: null, // TODO: fetch from Linear project updates
      healthUpdate: null, // TODO: fetch latest Linear project update
      hubspotStage: hubspotStageLabel,
      hubspotStageIndex: hubspotStageIdx,
      implementationStage: null, // TODO: derive from Linear project milestones
      implementationStageIndex: null,
      lifecycle,
      postLaunchStatus: null,
      dealOwner: hubspotOwner,
      linearProjectOwner: linearOwner,
      linearProjectSlug: rl.linear_projects[0] ?? null,
      dri,
      driSource,
      roles: {
        bd: hubspotOwner ? { name: hubspotOwner } : undefined,
        im: linearOwner ? { name: linearOwner } : undefined,
      },
      arr: hubspotDeal?.amount ?? null,
      activations: null,
      goLiveProbability: null,
      goLiveDate: hubspotDeal?.closeDate ?? null,
      nextMarketingEffort: null,
      linearIssueCount: linearProject?.issueCount ?? 0,
    };
  });

  // Resolve market labels on flagged issues
  const flaggedIssues: LinearIssue[] = (linear?.flaggedIssues ?? []).map((issue) => {
    // Try to match issue to a revenue line by checking which project it belongs to
    const matchedDeal = config.revenue_lines.find((rl) =>
      rl.linear_projects.some((slug) =>
        linear?.projects[slug] !== undefined
      )
    );
    return {
      ...issue,
      market: issue.market ?? matchedDeal?.label ?? null,
    };
  });

  const dealHealths = deals.map((d) => d.health);
  const overallHealth = deriveHealth(dealHealths);

  // DRI: first Linear project lead found, or first HubSpot deal owner
  const driName = deals.find((d) => d.linearProjectOwner)?.linearProjectOwner
    ?? deals.find((d) => d.dealOwner)?.dealOwner
    ?? null;

  return {
    slug,
    config,
    health: overallHealth,
    driName,
    driAvatarUrl: null, // TODO: fetch from Linear user avatar
    healthHistory: [], // TODO: derive from Linear initiative update history
    deals,
    linearIssues: flaggedIssues,
    arrActuals,
    forecast,
    milestones: [],
    slackActivity: slack ?? { channels: [] },
    lastUpdated: new Date().toISOString(),
  };
}

function buildPortfolio(customers: CustomerData[]): PortfolioEntry[] {
  return customers.map((c) => {
    const stages: Record<string, number> = {};
    for (const deal of c.deals) {
      if (deal.hubspotStage) {
        stages[deal.hubspotStage] = (stages[deal.hubspotStage] ?? 0) + 1;
      }
    }

    const totalArr = c.deals.reduce((sum, d) => sum + (d.arr ?? 0), 0) || null;

    return {
      slug: c.slug,
      name: c.config.name,
      health: c.health,
      dealCount: c.deals.length,
      totalArr,
      stages,
      topLineHealth: c.deals.map((d) => d.health),
      lastUpdated: c.lastUpdated,
    };
  });
}

async function main() {
  console.log("🔥 Phoenix — Fetching data...");
  if (noCache) {
    console.log("  (cache disabled, forcing fresh API calls)");
    clearCache();
  }

  // Ensure output directories exist
  if (!fs.existsSync(CUSTOMERS_DATA_DIR)) {
    fs.mkdirSync(CUSTOMERS_DATA_DIR, { recursive: true });
  }

  const configs = loadAllCustomerConfigs();
  console.log(`  Found ${configs.length} customers: ${configs.map((c) => c.config.name).join(", ")}`);

  const allCustomerData: CustomerData[] = [];

  for (const { slug, config } of configs) {
    const data = await fetchCustomerData(slug, config);
    allCustomerData.push(data);

    // Write per-customer JSON
    const outPath = path.join(CUSTOMERS_DATA_DIR, `${slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`  ✅ ${config.name} → ${outPath}`);
  }

  // Write portfolio summary
  const portfolio = buildPortfolio(allCustomerData);
  const portfolioPath = path.join(DATA_DIR, "portfolio.json");
  fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
  console.log(`\n✅ Portfolio summary → ${portfolioPath}`);

  console.log(`\n🏁 Done! ${allCustomerData.length} customers processed.`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
