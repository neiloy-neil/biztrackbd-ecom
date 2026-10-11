import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ForbiddenError, canPlatform, decodeClaims, getUserFromToken, platformMemberFor, type AuthUser, type PlatformActor, type PlatformArea, type PlatformMember, type PlatformRole } from "@biztrackbd/core";
import { getPlatformPrisma } from "@biztrackbd/db";
import { AT, authMode } from "@/lib/auth";

export interface PlatformSession {
  user: { id: string; name: string; email: string; role: PlatformRole };
  actor: PlatformActor;
}

export const DEV_PLATFORM_COOKIE = "dev_platform_user";

export type PlatformAuthState =
  | { state: "anon" }
  | { state: "mfa"; user: AuthUser }
  | { state: "enroll"; user: AuthUser; member: PlatformMember }
  | { state: "no-access"; user: AuthUser }
  | { state: "ok"; user: AuthUser; member: PlatformMember };

/**
 * The platform team can see and change every store, so its sign-in is stricter than a store's: the account must be on the team,
 * must have two-factor set up (the first sign-in is sent to set it up), and must have completed it for this session (assurance
 * level 2). A person whose team access has been switched off is signed out within 30 seconds.
 */
export async function resolveAuth(): Promise<PlatformAuthState> {
  const token = (await cookies()).get(AT)?.value;
  if (!token) return { state: "anon" };
  const user = await getUserFromToken(token);
  if (!user || !user.emailConfirmed) return { state: "anon" };
  const member = await platformMemberFor(user);
  if (!member || !member.isActive) return { state: "no-access", user };
  const verified = user.factors.some((f) => f.status === "verified");
  if (!verified) return { state: "enroll", user, member };
  if (decodeClaims(token).aal !== "aal2") return { state: "mfa", user };
  return { state: "ok", user, member };
}

export async function getSession(): Promise<PlatformSession> {
  if (authMode() === "dev") return devSession();
  const a = await resolveAuth();
  if (a.state === "anon") redirect("/login");
  if (a.state === "mfa") redirect("/login/mfa");
  if (a.state === "enroll") redirect("/enroll");
  if (a.state === "no-access") redirect("/login?err=no-access");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  return { user: { id: a.member.id, name: a.member.name, email: a.member.email, role: a.member.role }, actor: { id: a.member.id, email: a.member.email, role: a.member.role, ip } };
}

async function devSession(): Promise<PlatformSession> {
  const db = getPlatformPrisma();
  const wanted = (await cookies()).get(DEV_PLATFORM_COOKIE)?.value;
  const user =
    (wanted ? await db.platformUser.findFirst({ where: { email: wanted, isActive: true } }) : null) ??
    (await db.platformUser.findFirst({ where: { role: "OWNER", isActive: true } }));
  if (!user) throw new Error("No active platform user. Run the seed.");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const role = user.role as PlatformRole;
  return { user: { id: user.id, name: user.name, email: user.email, role }, actor: { id: user.id, email: user.email, role, ip } };
}

export async function requireAccess(area: PlatformArea, level: "view" | "edit" = "view"): Promise<PlatformSession> {
  const s = await getSession();
  if (!canPlatform(s.user.role, area, level)) redirect("/no-access");
  return s;
}

/** For server actions: never trust that the button was hidden. */
export async function requireAction(area: PlatformArea, level: "view" | "edit" = "edit"): Promise<PlatformSession> {
  const s = await getSession();
  if (!canPlatform(s.user.role, area, level)) throw new ForbiddenError();
  return s;
}
