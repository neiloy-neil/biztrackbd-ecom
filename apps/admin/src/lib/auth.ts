import { cookies } from "next/headers";
import { decodeClaims, type TokenSet } from "@biztrackbd/core";

/**
 * Cookie plumbing for real sign-in. The tokens live in httpOnly cookies, so no script on any page can read them.
 *   bt_at     the access token (short lived: Supabase issues one hour)
 *   bt_rt     the refresh token (long lived), exchanged for a new access token by proxy.ts before it expires
 *   bt_tenant which store this person is working in, when they belong to several (checked against their memberships every time)
 */
export const AT = "bt_at";
export const RT = "bt_rt";
export const TENANT = "bt_tenant";
/** A visitor's demo admin (docs/41): a signed value naming their private demo store. Opens nothing else. */
export const DEMO = "bt_demo";

/** Real sign-in is the default. The development stand-in only exists when DEV_AUTH=1 and never in production. */
export const authMode = (): "dev" | "supabase" => (process.env.DEV_AUTH === "1" && process.env.NODE_ENV !== "production" ? "dev" : "supabase");

const REFRESH_DAYS = 30;
const secure = () => process.env.NODE_ENV === "production";

export const cookieOptions = (maxAgeSeconds: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: secure(), path: "/", maxAge: maxAgeSeconds });

export async function setSessionCookies(t: Pick<TokenSet, "accessToken" | "refreshToken">): Promise<void> {
  const jar = await cookies();
  const exp = decodeClaims(t.accessToken).exp;
  jar.set(AT, t.accessToken, cookieOptions(Math.max(60, exp ? exp - Math.floor(Date.now() / 1000) : 3600)));
  jar.set(RT, t.refreshToken, cookieOptions(REFRESH_DAYS * 86400));
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  for (const n of [AT, RT, TENANT]) jar.delete(n);
}

/** Only a path on this site. A sign-in link must never be able to send someone to another address afterwards. */
export function safeNext(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") && s.length < 300 ? s : "/";
}
