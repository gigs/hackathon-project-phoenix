import fs from "fs";
import path from "path";
import type {
  CustomerData,
  OverallSentimentPayload,
  PortfolioEntry,
  SlackInsightPayload,
} from "./types";
import { OVERALL_SENTIMENT_SCHEMA_VERSION, SLACK_INSIGHT_SCHEMA_VERSION } from "./types";

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

export function getAvailableCustomerSlugs(): string[] {
  const dir = path.join(DATA_DIR, "customers");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(
      (f) =>
        f.endsWith(".json") &&
        !f.includes(".slack-insight") &&
        !f.includes(".slack-transcript") &&
        !f.includes(".overall-sentiment"),
    )
    .map((f) => f.replace(/\.json$/, ""));
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
