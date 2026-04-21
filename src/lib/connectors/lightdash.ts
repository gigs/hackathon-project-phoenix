import fs from "fs";
import path from "path";
import type { ActualsRow, ConnectorResult } from "../types";

const CSV_DIR = path.resolve(process.cwd(), "src/lib/data/csv");

/**
 * Per-customer actuals CSV at `src/lib/data/csv/{slug}-arr.csv`, produced by
 * `scripts/fetch-arr.ts` (BigQuery export).
 *
 * Long format. Header:
 *   reporting_date, organization_id, organization_name, project_id,
 *   gigs_vertical, subscription_product_type, subscription_product_region,
 *   activated_subscriptions, active_subscriptions, daily_arr_usd,
 *   projected_eom_arr_usd
 *
 * A single (project_id, date) can have multiple rows — one per
 * (subscription_product_type, subscription_product_region) combo. We sum
 * within each (project_id, date) pair so downstream consumers see one
 * number per project per day.
 *
 * ARR source per row:
 *   - Prefer `projected_eom_arr_usd` — it's Gigs' headline end-of-month ARR
 *     projection and aligns with the EOM-based forecast CSV.
 *   - Fall back to `daily_arr_usd` when the projection is empty (BQ only
 *     populates `projected_eom_arr_usd` for the current month; historical
 *     days have only daily run-rate). Blending keeps the chart continuous.
 */

/** Minimal CSV field splitter that understands double-quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseNumber(raw: string): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseCSV(content: string, customerSlug: string): ActualsRow[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iDate = idx("reporting_date");
  const iProject = idx("project_id");
  const iArrProjected = idx("projected_eom_arr_usd");
  const iArrDaily = idx("daily_arr_usd");
  const iLines = idx("active_subscriptions");

  if (iDate < 0 || iProject < 0 || iArrProjected < 0 || iArrDaily < 0 || iLines < 0) {
    console.warn(
      `  [actuals:${customerSlug}] unexpected header; expected reporting_date/project_id/projected_eom_arr_usd/daily_arr_usd/active_subscriptions — got "${header.join(",")}"`,
    );
    return [];
  }

  // Key: `projectId|date`. Sum daily_arr_usd and active_subscriptions across
  // product/region rows for the same project+date.
  const agg = new Map<string, { projectId: string; date: string; arr: number; activeLines: number }>();

  for (let r = 1; r < lines.length; r++) {
    const raw = lines[r];
    if (!raw.trim()) continue;
    const cells = splitCsvLine(raw);
    const projectId = cells[iProject];
    const date = (cells[iDate] ?? "").slice(0, 10); // strip "T00:00:00" if present
    if (!projectId || !date) continue;
    const key = `${projectId}|${date}`;
    // Blend: prefer projected EOM ARR; fall back to daily run-rate for days
    // where BQ hasn't populated the projection (historical months).
    const projectedRaw = cells[iArrProjected];
    const arr = parseNumber(projectedRaw && projectedRaw !== "" ? projectedRaw : cells[iArrDaily]);
    const activeLines = parseNumber(cells[iLines]);
    const existing = agg.get(key);
    if (existing) {
      existing.arr += arr;
      existing.activeLines += activeLines;
    } else {
      agg.set(key, { projectId, date, arr, activeLines });
    }
  }

  return [...agg.values()].sort((a, b) =>
    a.date === b.date ? a.projectId.localeCompare(b.projectId) : a.date.localeCompare(b.date),
  );
}

export async function fetchARRData(
  customerSlug: string,
  _noCache: boolean,
): Promise<ConnectorResult<ActualsRow[]>> {
  const csvPath = path.join(CSV_DIR, `${customerSlug}-arr.csv`);

  if (!fs.existsSync(csvPath)) {
    return {
      data: [],
      error: `No CSV file found at ${csvPath}`,
      source: "lightdash",
    };
  }

  try {
    const content = fs.readFileSync(csvPath, "utf-8");
    const data = parseCSV(content, customerSlug);
    return { data, error: null, source: "lightdash" };
  } catch (e) {
    return {
      data: null,
      error: (e as Error).message,
      source: "lightdash",
    };
  }
}
