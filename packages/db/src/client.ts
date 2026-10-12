import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One pooled client per process. In serverless keep max small, but never below 3: a page runs several tenant transactions at once, and with
// one connection they queue until Prisma gives up (P2028) and the page answers 500.
const globalForDb = globalThis as unknown as { __biztrackBase?: PrismaClient };

export function createBaseClient(connectionString: string, max = Math.max(3, Number(process.env.DB_POOL_MAX ?? 5))): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max }),
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
