import { getPlatformHealthMatrix } from "@biztrackbd/core";

let cachedHealth: { data: any; expiresAt: number } | null = null;
let inflightPromise: Promise<any> | null = null;

const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getCachedPlatformHealthMatrix() {
  const now = Date.now();
  if (cachedHealth && cachedHealth.expiresAt > now) {
    return cachedHealth.data;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const data = await getPlatformHealthMatrix();
      cachedHealth = { data, expiresAt: Date.now() + HEALTH_CACHE_TTL_MS };
      return data;
    } catch (err) {
      console.warn("Failed to refresh platform health matrix:", err);
      return cachedHealth?.data ?? null;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}
