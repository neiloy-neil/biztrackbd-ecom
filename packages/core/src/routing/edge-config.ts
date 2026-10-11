import { withTenant } from "@biztrackbd/db";
import { edgeKey } from "./directory";
import type { HostEntry } from "./decide";

/**
 * Pushes a store's routing entries to Vercel Edge Config so the proxy can answer from memory (docs/13 section 4).
 * Postgres stays the source of truth: if this is not configured or fails, lookups still work, just through the database.
 * NOT yet exercised against a real Vercel account. The request shape follows Vercel's documented
 * PATCH /v1/edge-config/{id}/items API and is covered by tests against a fake fetch.
 */

/** Reads EDGE_CONFIG_ID, VERCEL_AUTH_TOKEN, VERCEL_TEAM_ID and NEXT_PUBLIC_ROOT_DOMAIN. Accepts process.env as is. */
export type EdgeConfigEnv = Record<string, string | undefined>;

export class EdgeSyncError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "EdgeSyncError";
  }
}

export interface RouteChanges {
  upsert: Record<string, HostEntry>;
  /** Hostnames to delete. */
  remove: string[];
}

export async function pushRoutes(
  changes: RouteChanges,
  env: EdgeConfigEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ skipped: boolean; items: number }> {
  if (!env.EDGE_CONFIG_ID || !env.VERCEL_AUTH_TOKEN) return { skipped: true, items: 0 };
  const items = [
    ...Object.entries(changes.upsert).map(([host, value]) => ({ operation: "upsert", key: edgeKey(host), value })),
    ...changes.remove.map((host) => ({ operation: "delete", key: edgeKey(host) })),
  ];
  if (items.length === 0) return { skipped: false, items: 0 };

  const team = env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}` : "";
  const res = await fetchImpl(`https://api.vercel.com/v1/edge-config/${encodeURIComponent(env.EDGE_CONFIG_ID)}/items${team}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${env.VERCEL_AUTH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    // The body can echo request details, so only the status is surfaced.
    throw new EdgeSyncError(`Edge Config update failed (${res.status})`, res.status);
  }
  return { skipped: false, items: items.length };
}

/** Every hostname this store answers on, as directory entries. Only verified domains appear. */
export async function buildTenantRoutes(tenantId: string, rootDomain: string): Promise<Record<string, HostEntry>> {
  const root = rootDomain.toLowerCase().replace(/:\d+$/, "");
  return withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findFirstOrThrow();
    const domains = await tx.domain.findMany({ where: { verified: true } });
    const primary = domains.find((d) => d.isPrimary)?.domain ?? null;
    const base = {
      tenantId, subdomain: tenant.subdomain, themeId: tenant.themeId, locale: tenant.locale,
      status: tenant.status as HostEntry["status"], primaryDomain: primary,
    };
    const routes: Record<string, HostEntry> = {
      [`${tenant.subdomain}.${root}`]: { ...base, matched: "subdomain", redirectWww: true },
    };
    for (const d of domains) {
      routes[d.domain] = { ...base, matched: "custom", redirectWww: d.redirectWww };
      if (d.redirectWww) routes[`www.${d.domain}`] = { ...base, matched: "custom_www", redirectWww: true };
    }
    return routes;
  });
}

/** Recomputes and pushes all of one store's routes. Call after any change to its status, theme, subdomain or domains. */
export async function syncTenantRouting(
  tenantId: string,
  opts: { removed?: string[]; env?: EdgeConfigEnv; fetchImpl?: typeof fetch } = {},
) {
  const env = opts.env ?? process.env;
  const root = env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const upsert = await buildTenantRoutes(tenantId, root);
  const remove = (opts.removed ?? []).flatMap((d) => [d, `www.${d}`]).filter((h) => !(h in upsert));
  return pushRoutes({ upsert, remove }, env, opts.fetchImpl);
}
