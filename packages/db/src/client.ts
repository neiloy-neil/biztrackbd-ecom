import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One pooled client per process. In serverless keep it small: in the pooler's session mode every open connection counts against a small
// shared limit (15 on the free plan), and idle instances keep theirs. Functions run next to the database (bom1), so even one connection
// serves a page's queries quickly. Set DB_POOL_MAX to change it; Vercel has it at 1.
const globalForDb = globalThis as unknown as { __biztrackBase?: PrismaClient };

export function createBaseClient(connectionString: string, max = Math.max(1, Number(process.env.DB_POOL_MAX ?? 5))): PrismaClient {
  return new PrismaClient({
    // Serverless instances idle between requests. In the pooler's session mode every open connection counts against a small shared limit
    // (15 on the free plan), so an idle one is closed after a few seconds instead of being held for the life of the instance.
    adapter: new PrismaPg({ connectionString, max, idleTimeoutMillis: Number(process.env.DB_IDLE_MS ?? 4000), connectionTimeoutMillis: 10_000 }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * Process-wide client connecting as the RESTRICTED role (DATABASE_URL, biztrack_app, NOBYPASSRLS).
 * Never use this directly for tenant data: go through withTenant or createTenantPrismaClient.
 */
export function getBasePrisma(): PrismaClient {
  if (!globalForDb.__biztrackBase) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__biztrackBase = createBaseClient(url);
  }
  return globalForDb.__biztrackBase;
}

/** Test and tooling hook: replace the cached base client. */
export function setBasePrisma(client: PrismaClient | undefined): void {
  globalForDb.__biztrackBase = client;
}

const globalForPlatform = globalThis as unknown as { __biztrackPlatform?: PrismaClient };

/**
 * Process-wide client for the super admin app only: connects as biztrack_platform (BYPASSRLS, PLATFORM_DATABASE_URL), so it
 * sees every store. Never import this from the storefront or the store admin.
 */
export function getPlatformPrisma(): PrismaClient {
  if (!globalForPlatform.__biztrackPlatform) {
    const url = process.env.PLATFORM_DATABASE_URL;
    if (!url) throw new Error("PLATFORM_DATABASE_URL is not set");
    globalForPlatform.__biztrackPlatform = createBaseClient(url, 3);
  }
  return globalForPlatform.__biztrackPlatform;
}

/** Test and tooling hook: replace the cached platform client. */
export function setPlatformPrisma(client: PrismaClient | undefined): void {
  globalForPlatform.__biztrackPlatform = client;
}
