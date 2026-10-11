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

/**
 * The stores this account may work in. Only an account whose email Supabase has confirmed is looked up at all: an unconfirmed
 * sign-up for someone else's address must never be tied to their staff row.
 */
export async function staffMemberships(user: Pick<AuthUser, "id" | "email" | "emailConfirmed">): Promise<StaffMembership[]> {
  if (!user.emailConfirmed) return [];
  const rows = await getBasePrisma().$queryRaw<(Omit<StaffMembership, "role"> & { role: string })[]>`SELECT * FROM staff_memberships(${user.id}, ${user.email})`;
  return rows.map((r) => ({ ...r, role: r.role as StaffRole }));
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
