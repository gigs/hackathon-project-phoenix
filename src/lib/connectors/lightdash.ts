import fs from "fs";
import path from "path";
import type { ConnectorResult, ARRDataPoint } from "../types";

const CSV_DIR = path.resolve(process.cwd(), "src/lib/data/csv");

function parseCSV(content: string): ARRDataPoint[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  // Skip header row
  return lines.slice(1).map((line) => {
    const [date, actual, forecast] = line.split(",").map((s) => s.trim());
    return {
      date: date ?? "",
      actual: actual && actual !== "" ? parseFloat(actual) : null,
      forecast: forecast && forecast !== "" ? parseFloat(forecast) : null,
    };
  });
}

export async function fetchARRData(
  customerSlug: string,
  _noCache: boolean,
): Promise<ConnectorResult<ARRDataPoint[]>> {
  // V1: Read from CSV files
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
    const data = parseCSV(content);
    return { data, error: null, source: "lightdash" };
  } catch (e) {
    return {
      data: null,
      error: (e as Error).message,
      source: "lightdash",
    };
  }
}
