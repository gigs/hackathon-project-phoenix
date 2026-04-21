import type { ARRDataPoint, CustomerData, HealthHistoryEntry, HealthStatus, PortfolioEntry } from "./types";

// --- Helpers to generate irregular weekly-ish time series ---------------------

function irregularDates(startISO: string, endISO: string, seed: number): string[] {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out: string[] = [];
  let cursor = new Date(startISO + "T00:00:00Z").getTime();
  const end = new Date(endISO + "T00:00:00Z").getTime();
  while (cursor <= end) {
    out.push(new Date(cursor).toISOString().slice(0, 10));
    const days = 3 + Math.floor(rand() * 12); // 3–14 day gaps, ~weekly average
    cursor += days * 86_400_000;
  }
  return out;
}

function interpAt(targetTs: number, anchors: Array<{ ts: number; val: number | null }>): number | null {
  let before: { ts: number; val: number | null } | null = null;
  let after: { ts: number; val: number | null } | null = null;
  for (const a of anchors) {
    if (a.ts <= targetTs) before = a;
    if (a.ts >= targetTs && !after) after = a;
  }
  if (!before || before.val == null) return null;
  if (!after || after.val == null) return before.val;
  if (before.ts === after.ts) return before.val;
  const t = (targetTs - before.ts) / (after.ts - before.ts);
  return Math.round(before.val + (after.val - before.val) * t);
}

interface ArrAnchor {
  date: string;
  actual: number | null;
  forecast: number | null;
  linesActual: number | null;
}

function genARR(
  startISO: string,
  endISO: string,
  todayISO: string,
  seed: number,
  anchors: ArrAnchor[],
): ARRDataPoint[] {
  const todayTs = new Date(todayISO + "T00:00:00Z").getTime();
  const toAnchors = (key: "actual" | "forecast" | "linesActual") =>
    anchors.map((a) => ({ ts: new Date(a.date + "T00:00:00Z").getTime(), val: a[key] }));
  const actualA = toAnchors("actual");
  const forecastA = toAnchors("forecast");
  const linesA = toAnchors("linesActual");
  return irregularDates(startISO, endISO, seed).map((date) => {
    const ts = new Date(date + "T00:00:00Z").getTime();
    return {
      date,
      actual: ts <= todayTs ? interpAt(ts, actualA) : null,
      forecast: interpAt(ts, forecastA),
      linesActual: ts <= todayTs ? interpAt(ts, linesA) : null,
    };
  });
}

function genHealth(
  startISO: string,
  endISO: string,
  seed: number,
  monthlyStatuses: Record<string, HealthStatus>,
): HealthHistoryEntry[] {
  return irregularDates(startISO, endISO, seed).map((date) => ({
    date,
    status: monthlyStatuses[date.slice(0, 7)] ?? "gray",
  }));
}

const TODAY_ISO = "2026-04-21";

export const MOCK_KLARNA: CustomerData = {
  slug: "klarna",
  config: {
    name: "Klarna",
    hubspot_company_record_id: "19069457924",
    slack_channels: ["#customer-klarna"],
    revenue_lines: [
      {
        label: "Klarna US",
        hubspot_deal_record_ids: ["20303327145"],
        linear_projects: ["klarna-us-mvno-19069457924-14774e3ed18c"],
        slack_channels: [],
        lightdash_dashboards: [],
      },
      {
        label: "Klarna UK",
        hubspot_deal_record_ids: ["37968818055"],
        linear_projects: ["klarna-uk-mvno-19069457924-010463626266"],
        slack_channels: [],
        lightdash_dashboards: [],
      },
      {
        label: "Klarna SE",
        hubspot_deal_record_ids: [],
        linear_projects: [],
        slack_channels: [],
        lightdash_dashboards: [],
      },
    ],
    linear_initiatives: ["am-klarna-account-cb4fd5a5abb5"],
    linear_projects: ["klarna-requests-eb470d6346eb"],
    google_sheets: [{ label: "Klarna forecast", url: "#" }],
    hex_embeds: [
      { label: "ARR Dashboard", url: "https://app.hex.tech/embed/placeholder-klarna-arr" },
      { label: "Activations", url: "https://app.hex.tech/embed/placeholder-klarna-activations" },
      { label: "Churn", url: "https://app.hex.tech/embed/placeholder-klarna-churn" },
    ],
  },
  health: "green",
  healthHistory: genHealth("2025-07-01", TODAY_ISO, 11, {
    "2025-07": "green",
    "2025-08": "green",
    "2025-09": "green",
    "2025-10": "yellow",
    "2025-11": "yellow",
    "2025-12": "green",
    "2026-01": "green",
    "2026-02": "green",
    "2026-03": "green",
    "2026-04": "green",
  }),
  driName: "Daniel Grant Smith",
  driAvatarUrl: null,
  deals: [
    {
      label: "Klarna US",
      health: "green",
      healthUpdateUrl: null,
      healthUpdate: {
        date: "2026-04-18T10:30:00Z",
        body: "Integration progressing well. F&F testing started with 50 users. API latency within SLA. Pricing v3 approved by procurement — contract signing expected May. No blockers.",
        author: "Max B.",
      },
      hubspotStage: "S3 Negotiation",
      hubspotStageIndex: 2,
      implementationStage: "F&F",
      implementationStageIndex: 1,
      lifecycle: "implementation",
      postLaunchStatus: null,
      dealOwner: "David F.",
      linearProjectOwner: "Max B.",
      linearProjectSlug: "klarna-us-mvno-19069457924-14774e3ed18c",
      dri: "Max B.",
      driSource: "linear",
      roles: {
        bd: { name: "David F." },
        im: { name: "Max B." },
        partnerMarketeer: { name: "Tilly M." },
      },
      arr: 124000,
      activations: 2340,
      goLiveProbability: "High",
      goLiveDate: "Jun 2026",
      nextMarketingEffort: { date: "2026-05-15", description: "US launch webinar with Klarna product team" },
      linearIssueCount: 2,
      miniArrTrend: [
        { date: "2026-01-01", actual: 72000, forecast: 72000 },
        { date: "2026-02-01", actual: 78000, forecast: 76000 },
        { date: "2026-03-01", actual: 84000, forecast: 82000 },
        { date: "2026-04-01", actual: null, forecast: 88000 },
        { date: "2026-05-01", actual: null, forecast: 95000 },
        { date: "2026-06-01", actual: null, forecast: 102000 },
      ],
    },
    {
      label: "Klarna UK",
      health: "yellow",
      healthUpdateUrl: null,
      healthUpdate: {
        date: "2026-04-16T14:15:00Z",
        body: "API clone delay — blocked on connectivity partner confirmation. Doc/presentation assets need review before S2 handoff. Timeline at risk if Orange partnership not confirmed by end of month.",
        author: "Max B.",
      },
      hubspotStage: "S2 Proposal",
      hubspotStageIndex: 1,
      implementationStage: "Implementation Kicked Off",
      implementationStageIndex: 0,
      lifecycle: "implementation",
      postLaunchStatus: null,
      dealOwner: "Tilly M.",
      linearProjectOwner: "Max B.",
      linearProjectSlug: "klarna-uk-mvno-19069457924-010463626266",
      dri: "Max B.",
      driSource: "linear",
      roles: {
        bd: { name: "Tilly M." },
        solutionEng: { name: "Rahil S." },
        im: { name: "Max B." },
      },
      arr: 86000,
      activations: 1120,
      goLiveProbability: "Med",
      goLiveDate: "Q3 2026",
      nextMarketingEffort: null,
      linearIssueCount: 4,
      miniArrTrend: [
        { date: "2026-01-01", actual: 30000, forecast: 32000 },
        { date: "2026-02-01", actual: 35000, forecast: 38000 },
        { date: "2026-03-01", actual: 42000, forecast: 45000 },
        { date: "2026-04-01", actual: null, forecast: 52000 },
        { date: "2026-05-01", actual: null, forecast: 60000 },
        { date: "2026-06-01", actual: null, forecast: 68000 },
      ],
    },
    {
      label: "Klarna SE",
      health: "gray",
      healthUpdateUrl: null,
      healthUpdate: null,
      hubspotStage: "Pursuing",
      hubspotStageIndex: null,
      implementationStage: null,
      implementationStageIndex: null,
      lifecycle: "presales",
      postLaunchStatus: null,
      dealOwner: "Louisa K.",
      linearProjectOwner: null,
      linearProjectSlug: null,
      dri: "Louisa K.",
      driSource: "hubspot",
      roles: {
        bd: { name: "Louisa K." },
      },
      arr: null,
      activations: null,
      goLiveProbability: null,
      goLiveDate: null,
      nextMarketingEffort: null,
      linearIssueCount: 0,
      miniArrTrend: [],
    },
  ],
  linearIssues: [
    {
      id: "KLA-123",
      title: "API clone delay — blocked on connectivity partner",
      status: "In Progress",
      priority: 1,
      labels: ["flagged"],
      url: "#",
      assignee: "Max B.",
      market: "Klarna UK",
    },
    {
      id: "KLA-456",
      title: "Doc/presentation assets need review before S2 handoff",
      status: "Todo",
      priority: 2,
      labels: ["flagged"],
      url: "#",
      assignee: "Tilly M.",
      market: "Klarna UK",
    },
    {
      id: "KLA-789",
      title: "Pricing model v3 approved by Klarna procurement",
      status: "Done",
      priority: 3,
      labels: ["flagged"],
      url: "#",
      assignee: "David F.",
      market: "Klarna US",
    },
  ],
  arrData: genARR("2025-07-01", "2026-06-30", TODAY_ISO, 42, [
    { date: "2025-07-01", actual: 42000, forecast: 40000, linesActual: 1730 },
    { date: "2025-08-01", actual: 48000, forecast: 45000, linesActual: 1980 },
    { date: "2025-09-01", actual: 51000, forecast: 50000, linesActual: 2100 },
    { date: "2025-10-01", actual: 55000, forecast: 56000, linesActual: 2265 },
    { date: "2025-11-01", actual: 61000, forecast: 60000, linesActual: 2510 },
    { date: "2025-12-01", actual: 68000, forecast: 65000, linesActual: 2800 },
    { date: "2026-01-01", actual: 72000, forecast: 72000, linesActual: 2965 },
    { date: "2026-02-01", actual: 78000, forecast: 76000, linesActual: 3210 },
    { date: "2026-03-01", actual: 84000, forecast: 82000, linesActual: 3460 },
    { date: "2026-04-01", actual: null, forecast: 88000, linesActual: null },
    { date: "2026-05-01", actual: null, forecast: 95000, linesActual: null },
    { date: "2026-06-01", actual: null, forecast: 102000, linesActual: null },
  ]),
  milestones: [
    { date: "2025-08-14", label: "US Test Project Created", type: "product", deal: "Klarna US" },
    { date: "2025-10-22", label: "US SOW Signed", type: "legal", deal: "Klarna US" },
    { date: "2025-11-18", label: "UK Figma Received", type: "product", deal: "Klarna UK" },
    { date: "2026-01-12", label: "US Pricing v3 Approved", type: "deal", deal: "Klarna US" },
    { date: "2026-03-05", label: "UK S2 Proposal Sent", type: "deal", deal: "Klarna UK" },
    { date: "2026-05-20", label: "US Contract Signing (est.)", type: "legal", deal: "Klarna US" },
    { date: "2026-06-24", label: "US Go-Live Target", type: "launch", deal: "Klarna US" },
  ],
  slackActivity: {
    channels: [{ name: "#customer-klarna", messagesLast7d: 12, messagesLast30d: 48 }],
  },
  lastUpdated: "2026-04-17T14:00:00Z",
};

export const MOCK_REVOLUT: CustomerData = {
  slug: "revolut",
  config: {
    name: "Revolut",
    hubspot_company_record_id: "36930979171",
    slack_channels: ["#customer-revolut"],
    revenue_lines: [
      {
        label: "Revolut UK",
        hubspot_deal_record_ids: ["10326868488"],
        linear_projects: ["revolut-mobile-implementation-tracker-36930979171-00f79b1e5e31"],
        slack_channels: ["#ext-gigs-revolut-testing-feedback"],
        lightdash_dashboards: [],
      },
      {
        label: "Revolut Ireland",
        hubspot_deal_record_ids: [],
        linear_projects: [],
        slack_channels: [],
        lightdash_dashboards: [],
      },
    ],
    linear_initiatives: ["am-revolut-account-05769e519aa1"],
    linear_projects: [
      "revolut-bau-a7f49af5899d",
      "revolut-tech-debt-5a54a68c64f3",
      "revolut-launch-changes-ad3d8f5cd378",
    ],
    google_sheets: [],
  },
  health: "yellow",
  healthHistory: genHealth("2025-07-01", TODAY_ISO, 23, {
    "2025-07": "gray",
    "2025-08": "gray",
    "2025-09": "green",
    "2025-10": "green",
    "2025-11": "green",
    "2025-12": "green",
    "2026-01": "yellow",
    "2026-02": "green",
    "2026-03": "yellow",
    "2026-04": "yellow",
  }),
  driName: "Felipe I.",
  driAvatarUrl: null,
  deals: [
    {
      label: "Revolut UK",
      health: "yellow",
      healthUpdateUrl: null,
      healthUpdate: {
        date: "2026-04-17T09:00:00Z",
        body: "Production webhook latency spikes during peak hours — engineering investigating. Limited audience rollout on track but monitoring closely. Support ramp-up process started, dedicated Slack channels active.",
        author: "Felipe I.",
      },
      hubspotStage: "S4 Closed Won",
      hubspotStageIndex: 3,
      implementationStage: "Limited Audience",
      implementationStageIndex: 2,
      lifecycle: "implementation",
      postLaunchStatus: null,
      dealOwner: "David F.",
      linearProjectOwner: "Felipe I.",
      linearProjectSlug: "revolut-mobile-implementation-tracker-36930979171-00f79b1e5e31",
      dri: "Felipe I.",
      driSource: "linear",
      roles: {
        bd: { name: "David F." },
        im: { name: "Felipe I." },
        partnerMarketeer: { name: "Tilly M." },
        partnerManager: { name: "Louisa K." },
      },
      arr: 340000,
      activations: 8500,
      goLiveProbability: "High",
      goLiveDate: "May 2026",
      nextMarketingEffort: { date: "2026-05-01", description: "UK co-branded press release with Revolut" },
      linearIssueCount: 6,
      miniArrTrend: [
        { date: "2026-01-01", actual: 280000, forecast: 290000 },
        { date: "2026-02-01", actual: 300000, forecast: 310000 },
        { date: "2026-03-01", actual: 320000, forecast: 330000 },
        { date: "2026-04-01", actual: null, forecast: 350000 },
        { date: "2026-05-01", actual: null, forecast: 370000 },
        { date: "2026-06-01", actual: null, forecast: 400000 },
      ],
    },
    {
      label: "Revolut Ireland",
      health: "gray",
      healthUpdateUrl: null,
      healthUpdate: null,
      hubspotStage: "Prospects",
      hubspotStageIndex: null,
      implementationStage: null,
      implementationStageIndex: null,
      lifecycle: "presales",
      postLaunchStatus: null,
      dealOwner: null,
      linearProjectOwner: null,
      linearProjectSlug: null,
      dri: null,
      driSource: null,
      roles: {},
      arr: null,
      activations: null,
      goLiveProbability: "Low",
      goLiveDate: null,
      nextMarketingEffort: null,
      linearIssueCount: 0,
      miniArrTrend: [],
    },
  ],
  linearIssues: [
    {
      id: "REV-101",
      title: "Production webhook latency spikes during peak hours",
      status: "In Progress",
      priority: 1,
      labels: ["flagged"],
      url: "#",
      assignee: "Felipe I.",
      market: "Revolut UK",
    },
  ],
  arrData: genARR("2025-07-01", "2026-06-30", TODAY_ISO, 101, [
    { date: "2025-07-01", actual: 180000, forecast: 170000, linesActual: 4500 },
    { date: "2025-08-01", actual: 200000, forecast: 195000, linesActual: 5000 },
    { date: "2025-09-01", actual: 220000, forecast: 220000, linesActual: 5500 },
    { date: "2025-10-01", actual: 240000, forecast: 245000, linesActual: 6000 },
    { date: "2025-11-01", actual: 260000, forecast: 265000, linesActual: 6500 },
    { date: "2025-12-01", actual: 280000, forecast: 280000, linesActual: 7000 },
    { date: "2026-01-01", actual: 300000, forecast: 300000, linesActual: 7500 },
    { date: "2026-02-01", actual: 320000, forecast: 315000, linesActual: 8000 },
    { date: "2026-03-01", actual: 340000, forecast: 335000, linesActual: 8500 },
    { date: "2026-04-01", actual: null, forecast: 360000, linesActual: null },
    { date: "2026-05-01", actual: null, forecast: 380000, linesActual: null },
    { date: "2026-06-01", actual: null, forecast: 400000, linesActual: null },
  ]),
  milestones: [
    { date: "2025-09-11", label: "UK Contract Signed", type: "legal", deal: "Revolut UK" },
    { date: "2025-11-06", label: "UK Integration Started", type: "product", deal: "Revolut UK" },
    { date: "2026-01-21", label: "UK Beta Launch", type: "launch", deal: "Revolut UK" },
    { date: "2026-04-30", label: "UK Full Launch (est.)", type: "launch", deal: "Revolut UK" },
  ],
  slackActivity: {
    channels: [{ name: "#customer-revolut", messagesLast7d: 24, messagesLast30d: 96 }],
  },
  lastUpdated: "2026-04-17T14:00:00Z",
};

export const MOCK_SANTANDER: CustomerData = {
  slug: "santander",
  config: {
    name: "Santander",
    hubspot_company_record_id: "",
    slack_channels: [],
    revenue_lines: [],
    linear_initiatives: [],
    linear_projects: [],
    google_sheets: [],
  },
  health: "gray",
  healthHistory: [],
  driName: null,
  driAvatarUrl: null,
  deals: [],
  linearIssues: [],
  arrData: [],
  milestones: [],
  slackActivity: { channels: [] },
  lastUpdated: "2026-04-17T14:00:00Z",
};

export const MOCK_PORTFOLIO: PortfolioEntry[] = [
  {
    slug: "klarna",
    name: "Klarna",
    health: "green",
    dealCount: 3,
    totalArr: 210000,
    stages: { "S3 Negotiation": 1, "S2 Proposal": 1, Pursuing: 1 },
    topLineHealth: ["green", "yellow", "gray"],
    lastUpdated: "2026-04-17T14:00:00Z",
  },
  {
    slug: "revolut",
    name: "Revolut",
    health: "yellow",
    dealCount: 2,
    totalArr: 340000,
    stages: { "S4 Closed Won": 1, Prospects: 1 },
    topLineHealth: ["yellow", "gray"],
    lastUpdated: "2026-04-17T14:00:00Z",
  },
  {
    slug: "santander",
    name: "Santander",
    health: "gray",
    dealCount: 0,
    totalArr: null,
    stages: {},
    topLineHealth: [],
    lastUpdated: "2026-04-17T14:00:00Z",
  },
];
