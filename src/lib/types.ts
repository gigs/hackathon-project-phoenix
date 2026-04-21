// --- Customer config (read from customers/*.json) ---

export interface CustomerConfig {
  name: string;
  hubspot_company_record_id: string;
  slack_channels: string[];
  revenue_lines: RevenueLine[];
  linear_initiatives: string[];
  linear_projects: string[];
  google_sheets: GoogleSheet[];
  hex_embeds?: HexEmbed[];
}

export interface RevenueLine {
  label: string;
  hubspot_deal_record_ids: string[];
  linear_projects: string[];
  slack_channels: string[];
  lightdash_dashboards: string[];
}

export interface GoogleSheet {
  label: string;
  url: string;
}

// --- Intermediate JSON (written by fetch script, read by UI) ---

export type HealthStatus = "green" | "yellow" | "red" | "gray";

export interface Milestone {
  date: string; // ISO "YYYY-MM-DD"
  label: string;
  type: "deal" | "product" | "legal" | "launch";
  deal?: string; // which revenue line this belongs to, if any
}

export interface HealthHistoryEntry {
  date: string; // ISO "YYYY-MM-DD"
  status: HealthStatus;
}

export interface CustomerData {
  config: CustomerConfig;
  slug: string;
  health: HealthStatus;
  healthHistory: HealthHistoryEntry[];
  driName: string | null;
  driAvatarUrl: string | null;
  deals: DealData[];
  linearIssues: LinearIssue[];
  arrData: ARRDataPoint[];
  milestones: Milestone[];
  slackActivity: SlackActivityData;
  lastUpdated: string;
}

export interface PersonRef {
  name: string;
  avatarUrl?: string;
}

export interface DealRoles {
  bd?: PersonRef;
  solutionEng?: PersonRef;
  im?: PersonRef;
  partnerMarketeer?: PersonRef;
  partnerManager?: PersonRef;
}

export type DealLifecycle = "presales" | "implementation" | "post-launch";

export interface HealthUpdate {
  date: string;
  body: string;
  author: string | null;
}

export interface DealData {
  label: string;
  health: HealthStatus;
  healthUpdateUrl: string | null;
  healthUpdate: HealthUpdate | null;
  hubspotStage: string | null;
  hubspotStageIndex: number | null;
  implementationStage: string | null;
  implementationStageIndex: number | null;
  lifecycle: DealLifecycle;
  postLaunchStatus: string | null;
  dealOwner: string | null;
  linearProjectOwner: string | null;
  linearProjectSlug: string | null;
  dri: string | null;
  driSource: "hubspot" | "linear" | null;
  roles: DealRoles;
  arr: number | null;
  activations: number | null;
  goLiveProbability: string | null;
  goLiveDate: string | null;
  nextMarketingEffort: { date: string; description: string } | null;
  linearIssueCount: number;
  miniArrTrend: ARRDataPoint[];
}

export const IMPLEMENTATION_STAGES = [
  "Implementation Kicked Off",
  "F&F",
  "Limited Audience",
  "General Availability",
] as const;

export interface HexEmbed {
  label: string;
  url: string;
}

export interface ARRDataPoint {
  date: string; // ISO "YYYY-MM-DD"
  actual: number | null;
  forecast: number | null;
  linesActual?: number | null;
}

export type TimelineMetric = "arr" | "lines";

export interface LinearIssue {
  id: string;
  title: string;
  status: string;
  priority: number;
  labels: string[];
  url: string;
  assignee: string | null;
  market: string | null;
}

export interface SlackActivityData {
  channels: SlackChannelActivity[];
}

export interface SlackChannelActivity {
  name: string;
  messagesLast7d: number | null;
  messagesLast30d: number | null;
}

// --- Portfolio summary (written by fetch script) ---

export interface PortfolioEntry {
  slug: string;
  name: string;
  health: HealthStatus;
  dealCount: number;
  totalArr: number | null;
  stages: Record<string, number>;
  topLineHealth: HealthStatus[];
  lastUpdated: string;
}

// --- Connector result wrapper ---

export interface ConnectorResult<T> {
  data: T | null;
  error: string | null;
  source: string;
}

// --- Constants ---

export const HUBSPOT_STAGES = [
  "S1 Discovery",
  "S2 Proposal",
  "S3 Negotiation",
  "S4 Closed Won",
] as const;

export type HubSpotStage = (typeof HUBSPOT_STAGES)[number];
