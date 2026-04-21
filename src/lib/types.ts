// --- Customer config (read from customers/*.json) ---

/** Per-customer Slack → Claude insight job (`npm run fetch-slack-insight`). Optional. */
export interface SlackInsightConfig {
  enabled: boolean;
  /**
   * Inline instructions (short). Optional if `prompt_file` is set.
   * If both are set, the file is included first and this string is appended after a blank line.
   */
  prompt?: string;
  /**
   * Repo-relative path to a `.md` or `.txt` file with the main instructions (easier to edit than JSON).
   * Example: `customers/prompts/klarna.slack-insight.md`
   */
  prompt_file?: string;
  /** Slack history window; default applied in script if omitted. */
  lookback_days?: number;
  /**
   * Max rows per channel after merging threads. `0` or omit = no cap (all messages in window).
   */
  max_messages_per_channel?: number;
  /** Max characters per message body in transcript. `0` or omit = full text (no truncation). */
  max_message_chars?: number;
}

export interface CustomerConfig {
  name: string;
  hubspot_company_record_id: string;
  slack_channels: string[];
  revenue_lines: RevenueLine[];
  linear_initiatives: string[];
  linear_projects: string[];
  google_sheets: GoogleSheet[];
  hex_embeds?: HexEmbed[];
  slack_insight?: SlackInsightConfig;
  overall_sentiment?: OverallSentimentConfig;
}

/**
 * Per-customer overall-sentiment job (`npm run fetch-overall-sentiment`).
 * Combines the saved Slack transcript snapshot with freshly-fetched Linear
 * project/initiative status updates and sends both to Claude using the
 * configured prompt. Optional.
 */
export interface OverallSentimentConfig {
  enabled: boolean;
  /** Repo-relative path to a `.md` or `.txt` file with the prompt. */
  prompt_file?: string;
  /** Inline prompt; appended after `prompt_file` content if both set. */
  prompt?: string;
  /** Window for both Slack messages and Linear project updates; default 60. */
  lookback_days?: number;
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

/**
 * Slack insight sidecar (`data/customers/<slug>.slack-insight.json`).
 * Schema aligns with `customers/prompts/klarna_prompt.md` Output section;
 * pipeline adds `schema_version`, `generated_at`, and `sources`.
 */
export const SLACK_INSIGHT_SCHEMA_VERSION = 2 as const;

export type SlackInsightRelationshipHealth = "green" | "yellow" | "red";

export interface SlackInsightHealthBlock {
  status: SlackInsightRelationshipHealth;
  summary: string;
}

export type SlackInsightStakeholderSentiment =
  | "positive"
  | "neutral"
  | "negative"
  | "no_signal";

export interface SlackInsightStakeholderRow {
  name: string;
  /** Role or org title (when the prompt includes it in model output). */
  title?: string;
  sentiment: SlackInsightStakeholderSentiment;
  signal: string;
  url: string | null;
}

export interface SlackInsightUpdateRow {
  summary: string;
  url: string;
  timestamp: string;
}

export type SlackInsightSignalKind = "warning" | "momentum" | "opportunity" | "change";

export interface SlackInsightSignalRow {
  type: SlackInsightSignalKind;
  summary: string;
  url: string | null;
}

export interface SlackInsightPayload {
  schema_version: typeof SLACK_INSIGHT_SCHEMA_VERSION;
  generated_at: string;
  sources: { channel: string; message_count: number }[];
  health: SlackInsightHealthBlock;
  stakeholders: SlackInsightStakeholderRow[];
  updates: SlackInsightUpdateRow[];
  signals: SlackInsightSignalRow[];
}

/**
 * Overall-sentiment sidecar (`data/customers/<slug>.overall-sentiment.json`).
 * Schema mirrors the `customers/prompts/<slug>.overall-sentiment.md` Output
 * section; pipeline adds `schema_version`, `generated_at`, and `sources`.
 */
export const OVERALL_SENTIMENT_SCHEMA_VERSION = 1 as const;

export type OverallSentimentSource = "slack" | "linear";

export interface OverallSentimentSignal {
  summary: string;
  source: OverallSentimentSource;
  url: string | null;
}

export interface OverallSentimentSources {
  slack: { channel: string; message_count: number }[];
  linear: {
    initiatives: number;
    projects: number;
    status_updates: number;
    flagged_issues: number;
  };
}

export interface OverallSentimentPayload {
  schema_version: typeof OVERALL_SENTIMENT_SCHEMA_VERSION;
  generated_at: string;
  lookback_days: number;
  sources: OverallSentimentSources;
  summary: string;
  momentum_signals: OverallSentimentSignal[];
  warning_signs: OverallSentimentSignal[];
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
