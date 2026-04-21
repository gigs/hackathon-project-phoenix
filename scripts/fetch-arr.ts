import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

/**
 * Pulls daily ARR + active-subscription metrics from BigQuery for a single
 * customer and writes them to `src/lib/data/csv/{slug}-arr.csv`.
 *
 * Auth: piggybacks on the active `gcloud` session (`gcloud auth login` +
 * application-default credentials). The `bq` CLI must be on PATH.
 *
 * Usage:
 *   npm run fetch-arr -- --customer klarna
 *   npm run fetch-arr -- --customer klarna --dry-run   # print SQL, don't run
 */

const BQ_BILLING_PROJECT = "gigs-analytics-dev";
const BQ_TABLE = "`gigs-analytics-dev`.`dbt_cbrandenburg_mobile_app_metrics`.`mobile_dashboard_daily_metrics`";
const LOOKBACK_WEEKS = 39;

const CUSTOMERS_DIR = path.resolve(process.cwd(), "customers");
const CSV_DIR = path.resolve(process.cwd(), "src/lib/data/csv");

function parseArgs() {
  const args = process.argv.slice(2);
  let customer: string | null = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--customer") customer = args[++i] ?? null;
    else if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: npm run fetch-arr -- --customer <slug> [--dry-run]");
      process.exit(0);
    }
  }
  return { customer, dryRun };
}

function collectProjectIds(slug: string): string[] {
  const file = path.join(CUSTOMERS_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) {
    console.error(`❌ No customer config at ${file}`);
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(file, "utf-8"));
  const ids = new Set<string>();
  for (const rl of cfg.revenue_lines ?? []) {
    for (const id of rl.gigs_project_ids ?? []) {
      if (typeof id === "string" && id.trim()) ids.add(id.trim());
    }
  }
  return [...ids];
}

function buildSql(): string {
  return [
    "SELECT",
    "  reporting_date,",
    "  organization_id,",
    "  organization_name,",
    "  project_id,",
    "  gigs_vertical,",
    "  subscription_product_type,",
    "  subscription_product_region,",
    "  activated_subscriptions,",
    "  active_subscriptions,",
    "  daily_arr_usd,",
    "  projected_eom_arr_usd",
    `FROM ${BQ_TABLE}`,
    `WHERE reporting_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${LOOKBACK_WEEKS} WEEK)`,
    "  AND project_id IN UNNEST(@project_ids)",
    "ORDER BY reporting_date, project_id",
  ].join("\n");
}

function runBq(sql: string, projectIds: string[]): string {
  const paramValue = `project_ids:ARRAY<STRING>:${JSON.stringify(projectIds)}`;
  const args = [
    `--project_id=${BQ_BILLING_PROJECT}`,
    "query",
    "--use_legacy_sql=false",
    "--format=csv",
    "--max_rows=1000000",
    `--parameter=${paramValue}`,
    sql,
  ];
  const started = Date.now();
  const result = spawnSync("bq", args, { encoding: "utf-8" });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (result.error) {
    console.error(`❌ Could not invoke bq: ${result.error.message}`);
    console.error("   Make sure the Google Cloud SDK is installed and `bq` is on your PATH.");
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`❌ bq exited with status ${result.status} after ${elapsed}s`);
    if (result.stderr) console.error(result.stderr);
    process.exit(1);
  }
  console.log(`  (bq query completed in ${elapsed}s)`);
  return result.stdout;
}

function main() {
  const { customer, dryRun } = parseArgs();
  if (!customer) {
    console.error("Usage: npm run fetch-arr -- --customer <slug> [--dry-run]");
    process.exit(2);
  }

  const projectIds = collectProjectIds(customer);
  if (projectIds.length === 0) {
    console.error(`❌ No gigs_project_ids found in customers/${customer}.json`);
    process.exit(1);
  }

  const sql = buildSql();
  console.log(`🔥 Phoenix — fetching ARR for ${customer}`);
  console.log(`  ${projectIds.length} project(s): ${projectIds.join(", ")}`);

  if (dryRun) {
    console.log("\n--- SQL ---");
    console.log(sql);
    console.log("\n--- Parameter ---");
    console.log(`project_ids = ${JSON.stringify(projectIds)}`);
    return;
  }

  if (!fs.existsSync(CSV_DIR)) fs.mkdirSync(CSV_DIR, { recursive: true });
  const outPath = path.join(CSV_DIR, `${customer}-arr.csv`);
  const csv = runBq(sql, projectIds);
  fs.writeFileSync(outPath, csv);
  const rowCount = Math.max(0, csv.trim().split("\n").length - 1);
  console.log(`✅ Wrote ${rowCount} rows → ${outPath}`);
}

main();
