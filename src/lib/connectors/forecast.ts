import fs from "fs";
import path from "path";
import type { ConnectorResult, ForecastRow } from "../types";

const CSV_DIR = path.resolve(process.cwd(), "src/lib/data/csv");

/**
 * Per-customer forecast CSV at `src/lib/data/csv/{slug}-forecast.csv`.
 *
 * Wide format (one row per Gigs analytics project, one column per month):
 *   Project,06/2025,07/2025,08/2025,...
 *   km-c-us-prod,,,,"$1,000,000","$3,000,000",...
 *   klarna-mobile-uk-prod,,,,,,,,,,,,"$408,000",...
 *
 * - First column header is the project key (any label — we ignore it).
 * - Remaining columns are month headers in `MM/YYYY`.
 * - First column of each data row is the `gigs_project_id` (must match a
 *   `revenue_lines[].gigs_project_ids[]` entry in `customers/{slug}.json`).
 * - Values may be formatted as `$1,234,567` or `1234567`. Empty cells are ignored.
 */

/** Minimal CSV field splitter that understands double-quoted fields containing commas. */
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

function parseCurrency(raw: string): number | null {
  const clean = raw.replace(/[$\s,]/g, "");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/** `MM/YYYY` → `YYYY-MM-DD` (last day of that month, UTC). */
function monthHeaderToEndOfMonth(header: string): string | null {
  const m = /^(\d{1,2})\/(\d{4})$/.exec(header.trim());
  if (!m) return null;
  const month = Number(m[1]);
  const year = Number(m[2]);
  if (month < 1 || month > 12) return null;
  // Day 0 of (month + 1) is the last day of `month`.
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

function parseCSV(content: string, customerSlug: string): ForecastRow[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]);
  // header[0] is the project-column label; header[1..] are month headers.
  const monthEnds: Array<string | null> = header.slice(1).map((h) => monthHeaderToEndOfMonth(h));

  // Warn on duplicate month columns (first occurrence wins).
  const seen = new Map<string, number>();
  monthEnds.forEach((me, i) => {
    if (!me) return;
    if (seen.has(me)) {
      console.warn(
        `  [forecast:${customerSlug}] duplicate month column "${header[i + 1]}" (cols ${seen.get(me)! + 1} and ${i + 1}); using first`,
      );
    } else {
      seen.set(me, i);
    }
  });

  const rows: ForecastRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const raw = lines[r];
    if (!raw.trim()) continue;
    const cells = splitCsvLine(raw);
    const projectId = cells[0];
    if (!projectId) continue;

    for (let c = 1; c < cells.length && c - 1 < monthEnds.length; c++) {
      const monthEnd = monthEnds[c - 1];
      if (!monthEnd) continue; // skip unparseable column headers
      // Skip if we already emitted a row for this project+month (dedup against duplicate month cols).
      const firstColForMonth = seen.get(monthEnd);
      if (firstColForMonth !== undefined && firstColForMonth !== c - 1) continue;
      const value = cells[c];
      if (!value) continue;
      const arr = parseCurrency(value);
      if (arr == null) {
        console.warn(
          `  [forecast:${customerSlug}] row ${r + 1} col ${c + 1} (${projectId} ${header[c]}): unparseable value "${value}"`,
        );
        continue;
      }
      rows.push({ projectId, monthEnd, arr });
    }
  }
  return rows;
}

export async function fetchForecastData(
  customerSlug: string,
  _noCache: boolean,
): Promise<ConnectorResult<ForecastRow[]>> {
  const csvPath = path.join(CSV_DIR, `${customerSlug}-forecast.csv`);

  if (!fs.existsSync(csvPath)) {
    return {
      data: [],
      error: `No CSV file found at ${csvPath}`,
      source: "forecast",
    };
  }

  try {
    const content = fs.readFileSync(csvPath, "utf-8");
    const data = parseCSV(content, customerSlug);
    return { data, error: null, source: "forecast" };
  } catch (e) {
    return {
      data: null,
      error: (e as Error).message,
      source: "forecast",
    };
  }
}
