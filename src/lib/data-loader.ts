import fs from "fs";
import path from "path";
import type {
  AccountBriefPayload,
  CustomerData,
  OverallSentimentPayload,
  PortfolioEntry,
  SlackInsightPayload,
} from "./types";
import {
  ACCOUNT_BRIEF_SCHEMA_VERSION,
  OVERALL_SENTIMENT_SCHEMA_VERSION,
  SLACK_INSIGHT_SCHEMA_VERSION,
} from "./types";

const DATA_DIR = path.resolve(process.cwd(), "data");

export function loadCustomerData(slug: string): CustomerData | null {
  const filePath = path.join(DATA_DIR, "customers", `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as CustomerData;
}

export function loadPortfolio(): PortfolioEntry[] {
  const filePath = path.join(DATA_DIR, "portfolio.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as PortfolioEntry[];
}

/** Main account file only: `<slug>.json`, not sidecars like `<slug>.slack-insight.json`. */
const MAIN_CUSTOMER_JSON = /^[a-z0-9-]+\.json$/i;

export function getAvailableCustomerSlugs(): string[] {
  const dir = path.join(DATA_DIR, "customers");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => MAIN_CUSTOMER_JSON.test(f))
    .map((f) => f.replace(/\.json$/i, ""));
}

/** Sidecar produced by `npm run fetch-slack-insight` — optional. */
export function loadSlackInsight(slug: string): SlackInsightPayload | null {
  const filePath = path.join(DATA_DIR, "customers", `${slug}.slack-insight.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as SlackInsightPayload;
    if (data.schema_version !== SLACK_INSIGHT_SCHEMA_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

/** Sidecar produced by `npm run fetch-overall-sentiment` — optional. */
export function loadOverallSentiment(slug: string): OverallSentimentPayload | null {
  const filePath = path.join(DATA_DIR, "customers", `${slug}.overall-sentiment.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as OverallSentimentPayload;
    if (data.schema_version !== OVERALL_SENTIMENT_SCHEMA_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

/** Sidecar produced by `npm run fetch-overall-sentiment` — optional dashboard brief. */
export function loadAccountBrief(slug: string): AccountBriefPayload | null {
  const filePath = path.join(DATA_DIR, "customers", `${slug}.account-brief.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as AccountBriefPayload;
    if (data.schema_version !== ACCOUNT_BRIEF_SCHEMA_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}
