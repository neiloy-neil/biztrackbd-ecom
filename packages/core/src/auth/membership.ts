import { getBasePrisma, getPlatformPrisma, withTenant } from "@biztrackbd/db";
import type { StaffRole } from "@biztrackbd/db";
import type { AuthUser } from "./supabase";

/** Who a confirmed Supabase account is in our own tables: which stores they work in, or which platform role they hold. */

export interface StaffMembership {
  userId: string;
  tenantId: string;
  subdomain: string;
  storeName: string;
  role: StaffRole;
  name: string;
  isActive: boolean;
  tenantStatus: string;
}

export interface BusinessAccountSummary {
  userId: string;
  tenantId: string;
  subdomain: string;
  storeName: string;
  role: StaffRole;
  name: string;
  isActive: boolean;
  tenantStatus: string;
  siteMode: string;
  businessVertical: string | null;
  customDomain: string | null;
  isCurrent?: boolean;
}

/**
 * The stores this account may work in. Only an account whose email Supabase has confirmed is looked up at all: an unconfirmed
 * sign-up for someone else's address must never be tied to their staff row.
 */
export async function staffMemberships(user: Pick<AuthUser, "id" | "email" | "emailConfirmed">): Promise<StaffMembership[]> {
  if (!user.emailConfirmed) return [];
  const rows = await getBasePrisma().$queryRaw<(Omit<StaffMembership, "role"> & { role: string })[]>`SELECT * FROM staff_memberships(${user.id}, ${user.email})`;
  return rows.map((r) => ({ ...r, role: r.role as StaffRole }));
}

/**
 * Enhanced list of all businesses owned by or accessible to this merchant account,
 * enriched with siteMode, vertical, and custom domain for the in-admin business switcher.
 */
export async function getMerchantBusinesses(
  user: Pick<AuthUser, "id" | "email" | "emailConfirmed">,
  currentTenantId?: string
): Promise<BusinessAccountSummary[]> {
  if (!user.emailConfirmed) return [];
  const memberships = await staffMemberships(user);
  const tenantIds = memberships.map((m) => m.tenantId);

  // Also discover any active tenant where user is explicitly recorded as ownerEmail
  const ownedTenants = await getPlatformPrisma().tenant.findMany({
    where: {
      status: { not: "CANCELLED" },
      ownerEmail: { equals: user.email, mode: "insensitive" },
    },
    select: { id: true, name: true, subdomain: true, status: true, siteMode: true, businessVertical: true, customDomain: true, ownerName: true },
  });

  // Query details for all tenant IDs in memberships
  const memberTenants = tenantIds.length > 0
    ? await getPlatformPrisma().tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true, subdomain: true, status: true, siteMode: true, businessVertical: true, customDomain: true, ownerName: true },
      })
    : [];

  const tenantMap = new Map<string, { id: string; name: string; subdomain: string; status: string; siteMode: string; businessVertical: string | null; customDomain: string | null; ownerName: string | null }>();
  for (const t of memberTenants) tenantMap.set(t.id, t);
  for (const t of ownedTenants) tenantMap.set(t.id, t);

  const results: BusinessAccountSummary[] = [];
  const seenTenantIds = new Set<string>();

  for (const m of memberships) {
    const t = tenantMap.get(m.tenantId);
    seenTenantIds.add(m.tenantId);
    results.push({
      ...m,
      storeName: t?.name || m.storeName,
      siteMode: t?.siteMode ?? "ECOMMERCE",
      businessVertical: t?.businessVertical ?? null,
      customDomain: t?.customDomain ?? null,
      isCurrent: m.tenantId === currentTenantId,
    });
  }

  // Include owned tenants not already represented in memberships
  for (const t of ownedTenants) {
    if (!seenTenantIds.has(t.id)) {
      seenTenantIds.add(t.id);
      results.push({
        userId: user.id,
        tenantId: t.id,
        subdomain: t.subdomain,
        storeName: t.name,
        role: "STORE_OWNER" as StaffRole,
        name: t.ownerName || user.email.split("@")[0] || "Store Owner",
        isActive: true,
        tenantStatus: t.status,
        siteMode: t.siteMode,
        businessVertical: t.businessVertical,
        customDomain: t.customDomain,
        isCurrent: t.id === currentTenantId,
      });
    }
  }

  return results;
}

/**
 * Development-only business discovery: strictly scoped to the current merchant's owner account
 * (via owner email / active staff user) so stores belonging to different merchants never cross-pollinate.
 */
export async function getDevBusinesses(
  currentSubdomain?: string,
  userEmail?: string | null
): Promise<BusinessAccountSummary[]> {
  const db = getPlatformPrisma();
  if (!currentSubdomain) return [];

  // 1. Identify the current tenant and its registered owner/staff
  const currentTenant = await db.tenant.findFirst({
    where: {
      OR: [
        { subdomain: currentSubdomain },
        { id: currentSubdomain },
      ],
    },
    select: {
      id: true,
      name: true,
      subdomain: true,
      status: true,
      siteMode: true,
      businessVertical: true,
      customDomain: true,
      ownerEmail: true,
      ownerName: true,
      users: {
        where: { role: "STORE_OWNER" },
        select: { id: true, email: true, name: true, role: true },
        take: 1,
      },
    },
  });

  if (!currentTenant) return [];

  // 2. Resolve the effective merchant owner email
  const effectiveEmail =
    userEmail?.trim().toLowerCase() ||
    currentTenant.ownerEmail?.trim().toLowerCase() ||
    currentTenant.users[0]?.email?.trim().toLowerCase();

  // 3. Find only tenants belonging to this specific owner
  const tenants = await db.tenant.findMany({
    where: {
      status: { not: "CANCELLED" },
      NOT: [
        { subdomain: { startsWith: "test" } },
        { subdomain: { startsWith: "sub" } },
      ],
      OR: [
        { id: currentTenant.id },
        ...(effectiveEmail
          ? [
              { ownerEmail: { equals: effectiveEmail, mode: "insensitive" as const } },
              { users: { some: { email: { equals: effectiveEmail, mode: "insensitive" as const } } } },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      name: true,
      subdomain: true,
      status: true,
      siteMode: true,
      businessVertical: true,
      customDomain: true,
      ownerEmail: true,
      ownerName: true,
      users: {
        where: { role: "STORE_OWNER" },
        select: { id: true, email: true, name: true, role: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return tenants.map((t) => {
    const ownerUser = t.users[0];
    return {
      userId: ownerUser?.id ?? "dev_user",
      tenantId: t.id,
      subdomain: t.subdomain,
      storeName: t.name,
      role: "STORE_OWNER" as StaffRole,
      name: ownerUser?.name ?? t.ownerName ?? "Store Owner",
      isActive: true,
      tenantStatus: t.status,
      siteMode: t.siteMode,
      businessVertical: t.businessVertical,
      customDomain: t.customDomain,
      isCurrent: t.subdomain === currentSubdomain || t.id === currentSubdomain,
    };
  });
}

export async function recordStaffLogin(tenantId: string, userId: string): Promise<void> {
  await withTenant(tenantId, (tx) => tx.tenantUser.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })).catch(() => undefined);
}

export interface PlatformMember {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "SUPPORT_LEAD" | "SUPPORT" | "FINANCE";
  isActive: boolean;
}

/** The platform team member for this account, tied on first sign-in by the confirmed email. Null for anyone else. */
export async function platformMemberFor(user: Pick<AuthUser, "id" | "email" | "emailConfirmed">): Promise<PlatformMember | null> {
  if (!user.emailConfirmed) return null;
  const db = getPlatformPrisma();
  let row = await db.platformUser.findFirst({ where: { authUserId: user.id } });
  if (!row) {
    // Tie an unclaimed row to this account. The condition on authUserId makes it a one-time claim.
    const claimed = await db.platformUser.updateMany({ where: { email: { equals: user.email, mode: "insensitive" }, authUserId: null }, data: { authUserId: user.id } });
    if (claimed.count > 0) row = await db.platformUser.findFirst({ where: { authUserId: user.id } });
  }
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role as PlatformMember["role"], isActive: row.isActive };
}

export async function recordPlatformLogin(id: string): Promise<void> {
  await getPlatformPrisma().platformUser.update({ where: { id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);
}

/** Is this address on a store's team? Used only to decide whether to email a sign-in code; the answer never reaches the browser. */
export async function staffEmailKnown(email: string): Promise<boolean> {
  const rows = await getBasePrisma().$queryRaw<{ known: boolean }[]>`SELECT staff_email_known(${email}) AS known`;
  return rows[0]?.known === true;
}

export async function platformEmailKnown(email: string): Promise<boolean> {
  return (await getPlatformPrisma().platformUser.count({ where: { email: { equals: email, mode: "insensitive" }, isActive: true } })) > 0;
}
