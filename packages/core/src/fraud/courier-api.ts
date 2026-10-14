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

const DEFAULT_API_ENDPOINT = "https://fraudchecker.smartposbd.com/api/v1/fraud-check";
const DEFAULT_API_KEY = "fraud_noxKDzJPjwEtWNM6FiWU1gQVF99OtjPc";
const CACHE_TTL_MS = 15 * 24 * 60 * 60 * 1000; // 15 days local cache

// In-memory verification cache for sub-20ms speed on repeated searches
const memoryCache = new Map<string, { data: ExternalCourierFraudData; expiresAt: number }>();

export function getFraudCheckerApiKey(): string {
  return process.env.FRAUD_CHECKER_API_KEY || DEFAULT_API_KEY;
}

export function clearFraudCheckerCache(): void {
  memoryCache.clear();
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

  const endpoint = process.env.FRAUD_CHECKER_API_URL || DEFAULT_API_ENDPOINT;
  const apiKey = getFraudCheckerApiKey();
  const fetcher = options?.fetchImpl ?? globalThis.fetch;

  try {
    const res = await fetcher(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ phone }),
      // Default timeout after 8 seconds if external network is slow
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });

    if (!res.ok) {
      // If POST is rate-limited or fails, try GET fallback
      const getUrl = `${endpoint}/${phone}`;
      const getRes = await fetcher(getUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-KEY": apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
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
