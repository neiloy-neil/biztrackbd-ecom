import { Prisma, getBasePrisma } from "@biztrackbd/db";
import { normalizeBdPhone } from "../phone";
import type { CourierFraudStats } from "./assess";

export interface CourierNetworkStats {
  status: boolean;
  message: string;
  data: {
    total: number;
    success: number;
    cancel: number;
    deliveredPercentage: number;
    returnPercentage: number;
    rating?: string;
    response_time?: number;
  };
}

export interface ExternalCourierFraudData {
  phone: string;
  score: number;
  status: "Safe" | "Moderate Risk" | "High Risk";
  source: string;
  total_parcel: number;
  success_parcel: number;
  cancel_parcel: number;
  unresolved_reports: number;
  community_reports: Array<{
    id: number;
    details?: string;
    date?: string;
    merchant?: string;
  }>;
  response: {
    steadfast?: CourierNetworkStats;
    pathao?: CourierNetworkStats;
    redx?: CourierNetworkStats;
    carrybee?: CourierNetworkStats;
    paperfly?: CourierNetworkStats;
  };
  cachedAt?: number;
}

export const DEFAULT_FRAUD_CHECKER_ENDPOINT = "https://fraudchecker.smartposbd.com/api/v1/fraud-check";
const CACHE_TTL_MS = 15 * 24 * 60 * 60 * 1000; // 15 days local cache

// In-memory verification cache for sub-20ms speed on repeated searches
const memoryCache = new Map<string, { data: ExternalCourierFraudData; expiresAt: number }>();

export interface FraudCheckerConfig {
  /** null when nobody has set a key: the checker then answers "no data" instead of calling out. */
  apiKey: string | null;
  endpoint: string;
  source: "DATABASE" | "ENV" | "NONE";
}

const CONFIG_TTL_MS = 60_000;
let configCache: { at: number; value: FraudCheckerConfig } | null = null;

/** One named platform setting, through the function that allows only the fraud checker keys (migration 36). */
async function readPlatformValue(key: string): Promise<string | null> {
  try {
    const rows = await getBasePrisma().$queryRaw<{ v: string | null }[]>(Prisma.sql`SELECT platform_config_value(${key}) AS v`);
    return rows[0]?.v?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * The fraud checker key and address. The platform admin sets them in Platform settings (stored in PlatformConfig); the environment
 * variables FRAUD_CHECKER_API_KEY and FRAUD_CHECKER_API_URL are the fallback. There is no key in the code. Remembered for a minute.
 */
export async function getFraudCheckerConfig(): Promise<FraudCheckerConfig> {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;
  const [dbKey, dbUrl] = await Promise.all([readPlatformValue("fraud_checker_api_key"), readPlatformValue("fraud_checker_api_url")]);
  const envKey = process.env.FRAUD_CHECKER_API_KEY?.trim() || null;
  const value: FraudCheckerConfig = {
    apiKey: dbKey ?? envKey,
    endpoint: dbUrl ?? process.env.FRAUD_CHECKER_API_URL?.trim() ?? DEFAULT_FRAUD_CHECKER_ENDPOINT,
    source: dbKey ? "DATABASE" : envKey ? "ENV" : "NONE",
  };
  configCache = { at: Date.now(), value };
  return value;
}

export async function getFraudCheckerApiKey(): Promise<string | null> {
  return (await getFraudCheckerConfig()).apiKey;
}

export function clearFraudCheckerCache(): void {
  memoryCache.clear();
  configCache = null;
}

/**
 * Queries the external 5-Courier Fraud Verification REST API (Steadfast, Pathao, RedX, CarryBee, Paperfly).
 * Caches results for 15 days for sub-20ms instant responses.
 */
export async function fetchUnifiedCourierFraud(
  phoneInput: string,
  options?: { fetchImpl?: typeof fetch; bypassCache?: boolean }
): Promise<ExternalCourierFraudData | null> {
  let phone: string;
  try {
    phone = normalizeBdPhone(phoneInput);
  } catch {
    return null;
  }

  // Check 15-day local cache
  if (!options?.bypassCache) {
    const cached = memoryCache.get(phone);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.data,
        source: "database_cache",
      };
    }
  }

  const cfg = await getFraudCheckerConfig();
  const endpoint = cfg.endpoint;
  const apiKey = cfg.apiKey;
  const fetcher = options?.fetchImpl ?? globalThis.fetch;

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) {
    reqHeaders["X-API-KEY"] = apiKey;
    reqHeaders["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetcher(endpoint, {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify({ phone }),
      // Default timeout after 8 seconds if external network is slow
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });

    if (!res.ok) {
      // If POST is rate-limited or fails, try GET fallback
      const getUrl = `${endpoint}/${phone}`;
      const getHeaders: Record<string, string> = {
        Accept: "application/json",
      };
      if (apiKey) {
        getHeaders["X-API-KEY"] = apiKey;
        getHeaders["Authorization"] = `Bearer ${apiKey}`;
      }
      const getRes = await fetcher(getUrl, {
        method: "GET",
        headers: getHeaders,
        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
      }).catch(() => null);

      if (!getRes || !getRes.ok) {
        return null;
      }

      const getData = (await getRes.json()) as ExternalCourierFraudData;
      if (getData && typeof getData.score === "number") {
        memoryCache.set(phone, { data: getData, expiresAt: Date.now() + CACHE_TTL_MS });
        return getData;
      }
      return null;
    }

    const data = (await res.json()) as ExternalCourierFraudData;
    if (!data || typeof data.score !== "number") {
      return null;
    }

    // Save to memory cache with 15-day expiration
    memoryCache.set(phone, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return data;
  } catch (err) {
    console.error("[fraud-checker] upstream query failed", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Converts the 5-courier API response into the internal CourierFraudStats format. */
export function toCourierFraudStats(data: ExternalCourierFraudData): CourierFraudStats {
  return {
    provider: "MULTI_COURIER",
    totalParcels: data.total_parcel,
    deliveredParcels: data.success_parcel,
    cancelledParcels: data.cancel_parcel,
    successRatio: data.score,
  };
}
