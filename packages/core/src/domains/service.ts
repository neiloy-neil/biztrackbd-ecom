import { assertNotInDemo } from "../demo/guard";
import { getBasePrisma, Prisma, withTenant, type TenantTx } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError, PlanFeatureError, ValidationError } from "../errors";
import { publishEvent } from "../events";
import { assertCan, type StaffActor } from "../permissions";
import { syncTenantRouting } from "../routing/edge-config";
import { validateCustomDomain, validateSubdomain } from "../routing/host";
import { SUBDOMAIN_MESSAGES } from "../platform/signup";

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

const rootDomain = () =>
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ??
  (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000");

async function lockTenant(tx: TenantTx, tenantId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
}

async function customDomainsAllowed(tx: TenantTx): Promise<boolean> {
  const tenant = await tx.tenant.findFirstOrThrow({ select: { planTier: true, siteMode: true } });
  // All Business & Portfolio Website plans (including Business Starter ৳399) include custom domain with free SSL
  if (tenant.siteMode === "PORTFOLIO") return true;
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


export const SUBDOMAIN_COOLDOWN_DAYS = 14;
export const SUBDOMAIN_REDIRECT_DAYS = 30;

export interface SubdomainAvailabilityResult {
  ok: boolean;
  reason?: "too_short" | "too_long" | "invalid" | "reserved" | "taken" | "cooldown";
  message: string;
  isCurrent?: boolean;
  label?: string;
  cooldown?: {
    inCooldown: boolean;
    daysLeft: number;
    nextAllowedAt: Date;
  };
  previousRedirect?: {
    subdomain: string;
    expiresAt: Date;
  } | null;
}

/**
 * Returns a store's full subdomain state including current subdomain,
 * any active 30-day forwarding redirect, and 14-day cooldown status.
 */
export async function getTenantSubdomainState(tenantId: string): Promise<{
  currentSubdomain: string;
  subdomainChangedAt: Date | null;
  previousSubdomain: string | null;
  previousSubdomainExpiresAt: Date | null;
  inCooldown: boolean;
  cooldownDaysLeft: number;
  nextAllowedAt: Date | null;
}> {
  return withTenant(tenantId, async (tx) => {
    const t = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subdomain: true,
        subdomainChangedAt: true,
        previousSubdomain: true,
        previousSubdomainExpiresAt: true,
      },
    });
    if (!t) throw new NotFoundError("Store");

    const now = new Date();
    let inCooldown = false;
    let cooldownDaysLeft = 0;
    let nextAllowedAt: Date | null = null;

    if (t.subdomainChangedAt) {
      const elapsedMs = now.getTime() - t.subdomainChangedAt.getTime();
      const cooldownMs = SUBDOMAIN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      if (elapsedMs < cooldownMs) {
        inCooldown = true;
        cooldownDaysLeft = Math.ceil((cooldownMs - elapsedMs) / (24 * 60 * 60 * 1000));
        nextAllowedAt = new Date(t.subdomainChangedAt.getTime() + cooldownMs);
      }
    }

    const previousRedirectActive = Boolean(
      t.previousSubdomain && t.previousSubdomainExpiresAt && t.previousSubdomainExpiresAt > now,
    );

    return {
      currentSubdomain: t.subdomain,
      subdomainChangedAt: t.subdomainChangedAt,
      previousSubdomain: previousRedirectActive ? t.previousSubdomain : null,
      previousSubdomainExpiresAt: previousRedirectActive ? t.previousSubdomainExpiresAt : null,
      inCooldown,
      cooldownDaysLeft,
      nextAllowedAt,
    };
  });
}

/**
 * Checks if a candidate subdomain is valid and available for a tenant.
 * Recognizes if the candidate is already the tenant's own current subdomain.
 */
export async function checkSubdomainAvailabilityForTenant(
  tenantId: string,
  candidate: string,
): Promise<SubdomainAvailabilityResult> {
  const v = validateSubdomain(candidate);
  if (!v.ok) {
    return {
      ok: false,
      reason: v.reason,
      message: SUBDOMAIN_MESSAGES[v.reason] ?? "Invalid subdomain",
    };
  }

  // 1. Is it the tenant's own current subdomain or active previous subdomain?
  const current = await withTenant(tenantId, (tx) =>
    tx.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subdomain: true,
        subdomainChangedAt: true,
        previousSubdomain: true,
        previousSubdomainExpiresAt: true,
      },
    }),
  );

  const now = new Date();
  let cooldown: SubdomainAvailabilityResult["cooldown"];
  if (current?.subdomainChangedAt) {
    const elapsedMs = now.getTime() - current.subdomainChangedAt.getTime();
    const cooldownMs = SUBDOMAIN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    if (elapsedMs < cooldownMs) {
      cooldown = {
        inCooldown: true,
        daysLeft: Math.ceil((cooldownMs - elapsedMs) / (24 * 60 * 60 * 1000)),
        nextAllowedAt: new Date(current.subdomainChangedAt.getTime() + cooldownMs),
      };
    }
  }

  const previousRedirect =
    current?.previousSubdomain && current?.previousSubdomainExpiresAt && current.previousSubdomainExpiresAt > now
      ? { subdomain: current.previousSubdomain, expiresAt: current.previousSubdomainExpiresAt }
      : null;

  if (current && current.subdomain.toLowerCase() === v.label) {
    return {
      ok: true,
      isCurrent: true,
      label: v.label,
      message: "This is your store's current subdomain.",
      cooldown,
      previousRedirect,
    };
  }

  // 2. Is it taken across the platform (in Tenant or Domain tables, or active previousSubdomain)?
  const [r] = await getBasePrisma().$queryRaw<{ taken: boolean }[]>`
    SELECT signup_subdomain_taken(${v.label}) AS taken
  `;
  if (r?.taken) {
    return {
      ok: false,
      reason: "taken",
      message: SUBDOMAIN_MESSAGES.taken ?? "That address is already taken. Try another.",
      cooldown,
      previousRedirect,
    };
  }

  return {
    ok: true,
    isCurrent: false,
    label: v.label,
    message: `✓ ${v.label} is available!`,
    cooldown,
    previousRedirect,
  };
}

/**
 * Changes a store's default *.biztrack.bd subdomain.
 * Validates availability and 14-day cooldown, establishes 30-day transitional forwarding,
 * updates the database, re-syncs Edge Config routing, and records an audit log event.
 */
export async function changeTenantSubdomain(
  tenantId: string,
  actor: StaffActor,
  newSubdomainInput: string,
): Promise<{ oldSubdomain: string; newSubdomain: string; redirectExpiresAt: Date }> {
  await assertNotInDemo(tenantId, "Changing store subdomain");
  assertCan(actor, "billing", "edit");

  const check = await checkSubdomainAvailabilityForTenant(tenantId, newSubdomainInput);
  if (!check.ok) {
    throw new ValidationError(check.message, { field: "subdomain" });
  }
  if (check.isCurrent) {
    const currentSub = check.label!;
    return { oldSubdomain: currentSub, newSubdomain: currentSub, redirectExpiresAt: new Date() };
  }

  const newSubdomain = check.label!;
  const root = rootDomain();
  const now = new Date();
  const redirectExpiresAt = new Date(now.getTime() + SUBDOMAIN_REDIRECT_DAYS * 24 * 60 * 60 * 1000);

  const { oldSubdomain, olderAliasToRemove } = await withTenant(tenantId, async (tx) => {
    await lockTenant(tx, tenantId);
    const t = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subdomain: true,
        subdomainChangedAt: true,
        previousSubdomain: true,
      },
    });
    if (!t) throw new NotFoundError("Store");

    // Enforce 14-day cooldown
    if (t.subdomainChangedAt) {
      const elapsedMs = now.getTime() - t.subdomainChangedAt.getTime();
      const cooldownMs = SUBDOMAIN_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      if (elapsedMs < cooldownMs) {
        const daysLeft = Math.ceil((cooldownMs - elapsedMs) / (24 * 60 * 60 * 1000));
        throw new ValidationError(`Subdomain was changed recently. You can change it again in ${daysLeft} days.`, {
          field: "subdomain",
        });
      }
    }

    const oldSub = t.subdomain;
    if (oldSub === newSubdomain) {
      return { oldSubdomain: oldSub, olderAliasToRemove: null };
    }

    // If there was an older alias before this change, that older alias will be replaced by oldSub
    const olderAlias = t.previousSubdomain && t.previousSubdomain !== oldSub ? t.previousSubdomain : null;

    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        subdomain: newSubdomain,
        subdomainChangedAt: now,
        previousSubdomain: oldSub,
        previousSubdomainExpiresAt: redirectExpiresAt,
      },
    });

    await audit(tx, tenantId, actor, "settings.subdomain_changed", {
      from: oldSub,
      to: newSubdomain,
      redirectUntil: redirectExpiresAt.toISOString(),
    });

    return { oldSubdomain: oldSub, olderAliasToRemove: olderAlias };
  });

  // Re-sync routing. If there was an older alias to remove from edge config, pass it.
  const removedHosts = olderAliasToRemove ? [`${olderAliasToRemove}.${root}`] : [];
  await pushRouting(tenantId, removedHosts);

  await publishEvent("tenant/subdomain-changed", {
    tenantId,
    from: oldSubdomain,
    to: newSubdomain,
  });

  return { oldSubdomain, newSubdomain, redirectExpiresAt };
}
