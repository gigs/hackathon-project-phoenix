import crypto from "crypto";
import fs from "fs";
import path from "path";

const CACHE_DIR = path.resolve(process.cwd(), ".cache");
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface CacheEntry<T> {
  fetchedAt: string;
  data: T;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sanitizeKey(key: string): string {
  // Hash long keys to avoid filesystem name length limits
  if (key.length > 100) {
    return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
  }
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getCachePath(source: string, key: string): string {
  return path.join(CACHE_DIR, source, `${sanitizeKey(key)}.json`);
}

export function readCache<T>(source: string, key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const filePath = getCachePath(source, key);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const age = Date.now() - new Date(entry.fetchedAt).getTime();
    if (age > ttlMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(source: string, key: string, data: T): void {
  const filePath = getCachePath(source, key);
  ensureDir(path.dirname(filePath));
  const entry: CacheEntry<T> = {
    fetchedAt: new Date().toISOString(),
    data,
  };
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));
}

export function clearCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }
}
