import fs from "fs";
import path from "path";
import type { CustomerData, PortfolioEntry } from "./types";

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
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}
