// --- Customer config (read from customers/*.json) ---

export interface CustomerConfig {
  name: string;
  hubspot_company_record_id: string;
  slack_channels: string[];
  revenue_lines: RevenueLine[];
  linear_initiatives: string[];
  linear_projects: string[];
  google_sheets: GoogleSheet[];
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
  month: string;
  label: string;
  type: "deal" | "product" | "legal" | "launch";
  deal?: string; // which revenue line this belongs to, if any
}

export interface CustomerData {
  config: CustomerConfig;
  slug: string;
  health: HealthStatus;
  deals: DealData[];
  linearIssues: LinearIssue[];
  arrData: ARRDataPoint[];
  milestones: Milestone[];
  slackActivity: SlackActivityData;
  lastUpdated: string;
}

export interface DealData {
  label: string;
  health: HealthStatus;
  hubspotStage: string | null;
  hubspotStageIndex: number | null;
  dealOwner: string | null;
  linearProjectOwner: string | null;
  dri: string | null;
  driSource: "hubspot" | "linear" | null;
  arr: number | null;
  activations: number | null;
  goLiveProbability: string | null;
  goLiveDate: string | null;
  linearIssueCount: number;
  miniArrTrend: ARRDataPoint[];
}

export interface ARRDataPoint {
  month: string;
  actual: number | null;
  forecast: number | null;
}

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
  "Open Leads",
  "Pursuing",
  "Prospects",
  "S1 Discovery",
  "S2 Proposal",
  "S3 Negotiation",
  "S4 Closed Won",
] as const;

export type HubSpotStage = (typeof HUBSPOT_STAGES)[number];
