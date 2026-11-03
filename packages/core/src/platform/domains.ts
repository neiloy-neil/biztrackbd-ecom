import { getPlatformPrisma } from "@biztrackbd/db";
import { checkDomain, type CheckOutcome } from "../domains/verify";
import { NotFoundError } from "../errors";
import { assertPlatformCan, type Deps, type PlatformActor } from "./admin";

/** The platform's view of every store's domains (SaDomains), so a domain stuck connecting can be seen without asking the store. */

export interface PlatformDomainRow {
  id: string;
  tenantId: string;
  storeName: string;
  subdomain: string;
  domain: string;
  verified: boolean;
  dnsStatus: string;
  dnsNote: string | null;
  sslStatus: string;
  isPrimary: boolean;
  lastCheckedAt: Date | null;
  createdAt: Date;
  connected: boolean;
}

export type DomainFilter = "connecting" | "connected" | "all";

export async function listPlatformDomains(actor: PlatformActor, filter: DomainFilter = "connecting", deps?: Deps): Promise<PlatformDomainRow[]> {
  assertPlatformCan(actor, "tenants", "view");
  const db = deps?.db ?? getPlatformPrisma();
  const rows = await db.domain.findMany({ orderBy: { createdAt: "desc" }, take: 500, include: { tenant: { select: { name: true, subdomain: true } } } });
  return rows
    .map((d) => ({
      id: d.id, tenantId: d.tenantId, storeName: d.tenant.name, subdomain: d.tenant.subdomain, domain: d.domain, verified: d.verified, dnsStatus: d.dnsStatus, dnsNote: d.dnsNote,
      sslStatus: d.sslStatus, isPrimary: d.isPrimary, lastCheckedAt: d.lastCheckedAt, createdAt: d.createdAt, connected: d.verified && d.sslStatus === "issued" && d.dnsStatus === "verified",
    }))
    .filter((r) => (filter === "all" ? true : filter === "connected" ? r.connected : !r.connected));
}

export const DOMAINS_PAGE_SIZE = 25;

/**
 * One page of domains, newest first, with the total for the filter. The split between connected and still connecting is made in the
 * query, so every domain is covered; the plain list above filters only the newest rows it fetched.
 */
export async function listPlatformDomainsPage(actor: PlatformActor, filter: DomainFilter = "connecting", page = 1, deps?: Deps): Promise<{ rows: PlatformDomainRow[]; total: number }> {
  assertPlatformCan(actor, "tenants", "view");
  const db = deps?.db ?? getPlatformPrisma();
  const live = { verified: true, sslStatus: "issued", dnsStatus: "verified" };
  const where = filter === "all" ? {} : filter === "connected" ? live : { NOT: live };
  const [rows, total] = await Promise.all([
    db.domain.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (Math.max(1, page) - 1) * DOMAINS_PAGE_SIZE, take: DOMAINS_PAGE_SIZE, include: { tenant: { select: { name: true, subdomain: true } } } }),
    db.domain.count({ where }),
  ]);
  return {
    rows: rows.map((d) => ({
      id: d.id, tenantId: d.tenantId, storeName: d.tenant.name, subdomain: d.tenant.subdomain, domain: d.domain, verified: d.verified, dnsStatus: d.dnsStatus, dnsNote: d.dnsNote,
      sslStatus: d.sslStatus, isPrimary: d.isPrimary, lastCheckedAt: d.lastCheckedAt, createdAt: d.createdAt, connected: d.verified && d.sslStatus === "issued" && d.dnsStatus === "verified",
    })),
    total,
  };
}

/** Looks at a domain right now, on the store's behalf. The same check the store and the sweep run. */
export async function checkPlatformDomain(actor: PlatformActor, domainId: string, deps?: Deps): Promise<CheckOutcome> {
  assertPlatformCan(actor, "tenants", "view");
  const db = deps?.db ?? getPlatformPrisma();
  const d = await db.domain.findUnique({ where: { id: domainId }, select: { tenantId: true, domain: true } });
  if (!d) throw new NotFoundError("Domain");
  return checkDomain(d.tenantId, d.domain);
}
