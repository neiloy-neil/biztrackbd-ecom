import { Prisma, type PrismaClient } from "@prisma/client";
import { getBasePrisma } from "./client";

/** Interactive transaction client with the tenant context already set. */
export type TenantTx = Prisma.TransactionClient;

// cuid or uuid style identifiers only. Anything else is rejected before it reaches SQL.
const TENANT_ID = /^[A-Za-z0-9_-]{8,64}$/;

export class InvalidTenantError extends Error {
  constructor(message = "Invalid tenantId") {
    super(message);
    this.name = "InvalidTenantError";
  }
}

export function assertTenantId(tenantId: unknown): asserts tenantId is string {
  if (typeof tenantId !== "string" || !TENANT_ID.test(tenantId)) throw new InvalidTenantError();
}

/**
 * Runs fn inside ONE database transaction whose session carries the tenant id.
 * Row-level security (docs/08 section 3) then limits every statement to that tenant, including raw SQL.
 * The id is passed as a bound parameter to set_config, never interpolated into SQL.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: TenantTx) => Promise<T>,
  options?: { client?: PrismaClient; timeoutMs?: number; maxWaitMs?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
): Promise<T> {
  assertTenantId(tenantId);
  const base = options?.client ?? getBasePrisma();
  return base.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return fn(tx);
    },
    {
      timeout: options?.timeoutMs ?? (process.env.NODE_ENV === "development" ? 60_000 : 30_000),
      maxWait: options?.maxWaitMs ?? (process.env.NODE_ENV === "development" ? 30_000 : 10_000),
      ...(options?.isolationLevel ? { isolationLevel: options.isolationLevel } : {}),
    },
  );
}

// Platform-level models: never reachable through a tenant client.
const PLATFORM_MODELS = new Set(["Plan", "Announcement", "PlatformUser", "PlatformAuditLog", "PlatformDailyMetrics", "PhoneTrustStat", "PhoneTrustEvent", "TenantNote", "PlatformConfig", "SubscriptionPromo"]);

const WHERE_OPS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany",
  "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany", "upsert",
]);

/**
 * Convenience client for simple reads and writes. It
 *  1. runs each operation in a transaction with the tenant context set (RLS enforces isolation), and
 *  2. adds tenantId to where filters and create data as a second layer.
 * Use SCALAR foreign keys on create (productId, not nested connect). For multi-step work use withTenant.
 * Raw SQL on this client has no tenant context, so it sees no tenant rows (fails closed).
 */
export function createTenantPrismaClient(tenantId: string, client?: PrismaClient) {
  assertTenantId(tenantId);
  const base = client ?? getBasePrisma();
  return base.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (PLATFORM_MODELS.has(model)) {
            throw new Error(`${model} is a platform-level model and is not available on a tenant client`);
          }
          const a: any = args ?? {};
          if (model !== "Tenant") {
            if (WHERE_OPS.has(operation)) a.where = { ...(a.where ?? {}), tenantId };
            if (operation === "upsert") a.create = { ...(a.create ?? {}), tenantId };
            if (operation === "create") a.data = { ...(a.data ?? {}), tenantId };
            if (operation === "createMany" || operation === "createManyAndReturn") {
              a.data = Array.isArray(a.data) ? a.data.map((d: object) => ({ ...d, tenantId })) : { ...(a.data ?? {}), tenantId };
            }
          } else if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), id: tenantId };
          }
          return withTenant(tenantId, (tx) => (tx as any)[lowerFirst(model)][operation](a), { client: base });
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof createTenantPrismaClient>;

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Resolve a hostname to a tenant through the SECURITY DEFINER function (works before a tenant is known). */
export async function resolveTenantByHost(
  host: string,
  rootDomain: string,
  client?: PrismaClient,
): Promise<{ id: string; status: string; themeId: string; subdomain: string; locale: string } | null> {
  const base = client ?? getBasePrisma();
  const cleanHost = host.toLowerCase().replace(/:\d+$/, "");
  const cleanRoot = rootDomain.toLowerCase().replace(/:\d+$/, "");
  const rows = await base.$queryRaw<{ id: string; status: string; themeId: string; subdomain: string; locale: string }[]>`
    SELECT id, status::text AS status, "themeId", subdomain, locale FROM resolve_tenant_by_host(${cleanHost}, ${cleanRoot})`;
  return rows[0] ?? null;
}

export interface HostEntryRow {
  tenantId: string;
  status: string;
  themeId: string;
  subdomain: string;
  locale: string;
  /** "subdomain", "custom", or "custom_www" (the www. twin of a verified custom domain). */
  matched: string;
  /** The store's primary verified custom domain, if it has one. */
  primaryDomain: string | null;
  redirectWww: boolean;
}

/** Router lookup. Takes an already normalised host. Returns null for hosts that are not a store. */
export async function resolveHostEntry(host: string, rootDomain: string, client?: PrismaClient): Promise<HostEntryRow | null> {
  const base = client ?? getBasePrisma();
  const rows = await base.$queryRaw<HostEntryRow[]>`
    SELECT "tenantId", status::text AS status, "themeId", subdomain, locale, matched, "primaryDomain", "redirectWww"
    FROM resolve_host_entry(${host}, ${rootDomain.toLowerCase().replace(/:\d+$/, "")})`;
  return rows[0] ?? null;
}
