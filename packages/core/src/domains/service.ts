import { assertNotInDemo } from "../demo/guard";
import { Prisma, withTenant, type TenantTx } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError, PlanFeatureError, ValidationError } from "../errors";
import { publishEvent } from "../events";
import { assertCan, type StaffActor } from "../permissions";
import { syncTenantRouting } from "../routing/edge-config";
import { validateCustomDomain } from "../routing/host";

const MAX_DOMAINS_PER_STORE = 5;
const SYSTEM = { userId: "system", email: "system@biztrackbd" } as const;
const TAKEN = "That domain is already connected to a store.";

type RoutingSync = (tenantId: string, removed?: string[]) => Promise<unknown>;
let routingSync: RoutingSync = (tenantId, removed) => syncTenantRouting(tenantId, { removed });

/** Swap how routing changes reach the edge. Tests use a fake. */
export function setRoutingSync(fn: RoutingSync): void {
  routingSync = fn;
}

/** The database is the source of truth, so a failed edge push is logged and queued for retry, never fatal. */
async function pushRouting(tenantId: string, removed: string[] = []): Promise<void> {
  try {
    await routingSync(tenantId, removed);
  } catch (e) {
    console.error("[routing] edge sync failed", e instanceof Error ? e.name : "unknown");
    await publishEvent("routing/sync-failed", { tenantId });
  }
}

const rootDomain = () => process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

async function lockTenant(tx: TenantTx, tenantId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
}

async function customDomainsAllowed(tx: TenantTx): Promise<boolean> {
  const tenant = await tx.tenant.findFirstOrThrow({ select: { planTier: true } });
  const plan = await tx.plan.findUnique({ where: { tier: tenant.planTier } });
  return (plan?.features as Record<string, unknown> | null)?.customDomain === true;
}

/**
 * Starts connecting a domain. It routes nothing until it is verified, so claiming a name you do not own is harmless.
 * Verification (a DNS check) belongs to the platform, not to this call; see confirmDomainVerified.
 */
export async function addDomain(tenantId: string, actor: StaffActor, input: string) {
  await assertNotInDemo(tenantId, "Connecting a domain");
  assertCan(actor, "billing", "edit");
  const check = validateCustomDomain(input, rootDomain());
  if (!check.ok) {
    throw new ValidationError(
      check.reason === "platform_domain" ? "That is a BizTrackBD address. Enter a domain you own." : check.reason === "needs_tld" ? "Enter the full domain, like yourshop.com" : "That does not look like a valid domain",
      { field: "domain" },
    );
  }
  const domain = check.domain;

  const created = await withTenant(tenantId, async (tx) => {
    if (!(await customDomainsAllowed(tx))) throw new PlanFeatureError("customDomain");
    // A store whose name matched a protected brand waits for a person to look at it before it can go on its own domain (docs/12 section 2).
    if ((await tx.tenant.findFirstOrThrow({ select: { quarantined: true } })).quarantined) throw new ValidationError("Your store is being reviewed. Custom domains open once the review is done, usually within a day.");
    if ((await tx.domain.count()) >= MAX_DOMAINS_PER_STORE) throw new ValidationError(`You can connect up to ${MAX_DOMAINS_PER_STORE} domains`);
    // A claim nobody verified for a day does not block the real owner.
    await tx.$queryRaw`SELECT release_stale_domain_claim(${domain})`;
    try {
      const row = await tx.domain.create({ data: { tenantId, domain, dnsNote: "Waiting for your DNS records" } });
      await audit(tx, tenantId, actor, "domain.added", { domain });
      return row;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError(TAKEN, { field: "domain" });
      throw e;
    }
  });
  await publishEvent("domain/registered", { tenantId, domainId: created.id, host: domain });
  return created;
}

/**
 * Marks a domain as verified. For the platform's DNS check (Phase 7 worker) and platform staff only: it is deliberately
 * not reachable from the store admin, because letting a store declare its own domain verified would defeat verification.
 */
export async function confirmDomainVerified(tenantId: string, host: string) {
  const domain = host.trim().toLowerCase();
  await withTenant(tenantId, async (tx) => {
    await lockTenant(tx, tenantId);
    const row = await tx.domain.findFirst({ where: { domain } });
    if (!row) throw new NotFoundError("Domain");
    if (row.verified) return;
    const hasPrimary = (await tx.domain.count({ where: { verified: true, isPrimary: true } })) > 0;
    await tx.domain.update({ where: { id: row.id }, data: { verified: true, dnsStatus: "verified", dnsNote: null, isPrimary: !hasPrimary, lastCheckedAt: new Date() } });
    await audit(tx, tenantId, SYSTEM, "domain.verified", { domain });
  });
  await pushRouting(tenantId);
}

export async function setPrimaryDomain(tenantId: string, actor: StaffActor, domainId: string): Promise<void> {
  await assertNotInDemo(tenantId, "Connecting a domain");
  assertCan(actor, "billing", "edit");
  await withTenant(tenantId, async (tx) => {
    await lockTenant(tx, tenantId);
    const row = await tx.domain.findFirst({ where: { id: domainId } });
    if (!row) throw new NotFoundError("Domain");
    if (!row.verified) throw new ValidationError("Verify the domain before making it primary");
    if (row.isPrimary) return;
    await tx.domain.updateMany({ where: { isPrimary: true }, data: { isPrimary: false } });
    await tx.domain.update({ where: { id: domainId }, data: { isPrimary: true } });
    await audit(tx, tenantId, actor, "domain.primary_changed", { domain: row.domain });
  });
  await pushRouting(tenantId);
}

export async function removeDomain(tenantId: string, actor: StaffActor, domainId: string): Promise<void> {
  await assertNotInDemo(tenantId, "Connecting a domain");
  assertCan(actor, "billing", "edit");
  const removed = await withTenant(tenantId, async (tx) => {
    await lockTenant(tx, tenantId);
    const row = await tx.domain.findFirst({ where: { id: domainId } });
    if (!row) throw new NotFoundError("Domain");
    await tx.domain.delete({ where: { id: domainId } });
    if (row.isPrimary) {
      // Never leave a store with several verified domains and no canonical one.
      const next = await tx.domain.findFirst({ where: { verified: true }, orderBy: { createdAt: "asc" } });
      if (next) await tx.domain.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    await audit(tx, tenantId, actor, "domain.removed", { domain: row.domain });
    return row.domain;
  });
  await pushRouting(tenantId, [removed]);
}

export async function listDomains(tenantId: string, actor: StaffActor) {
  assertCan(actor, "billing", "view");
  return withTenant(tenantId, (tx) => tx.domain.findMany({ orderBy: { createdAt: "asc" } }));
}
