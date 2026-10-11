import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  AuthFailure, ForbiddenError, ReadOnlyError, can, decodeClaims, getStoreAccess, getUserFromToken, staffMemberships, type Access, type Area, type AuthUser, type StaffActor, type StaffMembership,
} from "@biztrackbd/core";
import { resolveTenantByHost, withTenant, type StaffRole } from "@biztrackbd/db";
import { AT, TENANT, authMode } from "@/lib/auth";

export interface AdminSession {
  tenantId: string;
  tenantSubdomain: string;
  user: { id: string; name: string; email: string; role: StaffRole };
  actor: StaffActor;
  /** What the store may do right now: trial, active, overdue, read-only or locked (docs/07 section 21). */
  access: Access;
}

export const DEV_USER_COOKIE = "dev_user";
/** Development only: which store to act in, so a store made through signup can be tried. Ignored unless DEV_AUTH=1. */
export const DEV_TENANT_COOKIE = "dev_tenant";

/** Where someone who is not fully signed in should go. */
export type AuthState =
  | { state: "anon" }
  | { state: "mfa"; user: AuthUser }
  | { state: "no-store"; user: AuthUser }
  | { state: "choose"; user: AuthUser; stores: StaffMembership[] }
  | { state: "ok"; user: AuthUser; member: StaffMembership; stores: StaffMembership[] };

/**
 * Real sign-in: the access token in the cookie is checked with Supabase (cached 30 seconds), the account's confirmed email
 * decides which stores it may work in, and a person who has set up two-factor must have completed it for this session.
 */
export async function resolveAuth(): Promise<AuthState> {
  const jar = await cookies();
  const token = jar.get(AT)?.value;
  if (!token) return { state: "anon" };
  let user: AuthUser | null;
  try {
    user = await getUserFromToken(token);
  } catch (e) {
    if (e instanceof AuthFailure) throw e;
    throw e;
  }
  if (!user || !user.emailConfirmed) return { state: "anon" };
  if (user.factors.some((f) => f.status === "verified") && decodeClaims(token).aal !== "aal2") return { state: "mfa", user };

  const stores = (await staffMemberships(user)).filter((m) => m.isActive);
  if (stores.length === 0) return { state: "no-store", user };
  const chosen = jar.get(TENANT)?.value;
  const member = stores.find((m) => m.tenantId === chosen) ?? (stores.length === 1 ? stores[0] : undefined);
  if (!member) return { state: "choose", user, stores };
  return { state: "ok", user, member, stores };
}

/** Null for anyone who is not signed in to a store (for route handlers that answer 401 instead of redirecting). */
export async function getSessionOrNull(): Promise<AdminSession | null> {
  if (authMode() === "dev") return devSession();
  const a = await resolveAuth();
  if (a.state !== "ok") return null;
  return buildSession(a.member, a.user.email);
}

async function buildSession(m: StaffMembership, email: string): Promise<AdminSession> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    tenantId: m.tenantId,
    tenantSubdomain: m.subdomain,
    user: { id: m.userId, name: m.name, email, role: m.role },
    actor: { userId: m.userId, email, name: m.name, role: m.role, ip },
    access: await getStoreAccess(m.tenantId),
  };
}

/**
 * For pages: sends people who are not signed in to the right sign-in step. In development with DEV_AUTH=1 it acts as one seeded
 * staff member chosen by a cookie so each role can be tried; that stand-in refuses to run in production.
 */
export async function getSession(): Promise<AdminSession> {
  if (authMode() === "dev") {
    const s = await devSession();
    if (!s) throw new Error("No active staff account for this store. Run the seed.");
    return s;
  }
  const a = await resolveAuth();
  if (a.state === "anon") redirect("/login");
  if (a.state === "mfa") redirect("/login/mfa");
  if (a.state === "no-store") redirect("/login?err=no-store");
  if (a.state === "choose") redirect("/choose-store");
  return buildSession(a.member, a.user.email);
}

async function devSession(): Promise<AdminSession | null> {
  const wantedTenant = (await cookies()).get(DEV_TENANT_COOKIE)?.value;
  const sub = wantedTenant && /^[a-z0-9-]{3,40}$/.test(wantedTenant) ? wantedTenant : process.env.DEV_TENANT_SUBDOMAIN ?? "rongdhonu";
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const t = await resolveTenantByHost(`${sub}.${root}`, root);
  if (!t) notFound();

  const wanted = (await cookies()).get(DEV_USER_COOKIE)?.value;
  const user = await withTenant(t.id, async (tx) =>
    (wanted ? await tx.tenantUser.findFirst({ where: { email: wanted, isActive: true } }) : null) ??
    (await tx.tenantUser.findFirst({ where: { role: "STORE_OWNER", isActive: true } })),
  );
  if (!user) return null;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    tenantId: t.id,
    tenantSubdomain: t.subdomain,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    actor: { userId: user.id, email: user.email, name: user.name, role: user.role, ip },
    access: await getStoreAccess(t.id),
  };
}

/** For pages: people without access are sent to a friendly screen. */
export async function requireAccess(area: Area, level: "view" | "edit" = "view"): Promise<AdminSession> {
  const s = await getSession();
  if (!can(s.user.role, area, level)) redirect("/no-access");
  // A locked store opens only the billing screen, so the owner can pay their way out.
  if (s.access.state === "LOCKED" && area !== "billing") redirect("/locked");
  return s;
}

/** For server actions: never trust that the button was hidden. Checks again and throws. */
export async function requireAction(area: Area, level: "view" | "edit" = "edit", opts: { allowReadOnly?: boolean } = {}): Promise<AdminSession> {
  const s = await getSession();
  if (!can(s.user.role, area, level)) throw new ForbiddenError();
  // Unpaid past the grace days: looking is fine, changing is not. Only paying (billing proofs) is let through.
  if (level === "edit" && !opts.allowReadOnly && (s.access.state === "READ_ONLY" || s.access.state === "LOCKED")) throw new ReadOnlyError(s.access.state === "LOCKED");
  return s;
}
