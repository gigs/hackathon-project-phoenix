import fs from "fs";
import path from "path";
import type { CustomerConfig } from "./types";

const CUSTOMERS_DIR = path.resolve(process.cwd(), "customers");

export function getCustomerSlugs(): string[] {
  const files = fs.readdirSync(CUSTOMERS_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => f.replace(".json", ""));
}

export function loadCustomerConfig(slug: string): CustomerConfig {
  const filePath = path.join(CUSTOMERS_DIR, `${slug}.json`);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as CustomerConfig;
}

export function loadAllCustomerConfigs(): { slug: string; config: CustomerConfig }[] {
  return getCustomerSlugs().map((slug) => ({
    slug,
    config: loadCustomerConfig(slug),
  }));
}
