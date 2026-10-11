import { cookies } from "next/headers";
import { decodeClaims, type TokenSet } from "@biztrackbd/core";

/**
 * Cookie plumbing for the platform team's sign-in. The names differ from the store admin's on purpose: browsers keep cookies per
 * host, not per port, so on one machine (and on one parent domain) the two apps would otherwise overwrite each other's tokens.
 */
export const AT = "bt_pat";
export const RT = "bt_prt";

/** Real sign-in is the default. The development stand-in only exists when DEV_AUTH=1 and never in production. */
export const authMode = (): "dev" | "supabase" => (process.env.DEV_AUTH === "1" && process.env.NODE_ENV !== "production" ? "dev" : "supabase");

const secure = () => process.env.NODE_ENV === "production";
export const cookieOptions = (maxAgeSeconds: number) => ({ httpOnly: true, sameSite: "strict" as const, secure: secure(), path: "/", maxAge: maxAgeSeconds });

export async function setSessionCookies(t: Pick<TokenSet, "accessToken" | "refreshToken">): Promise<void> {
  const jar = await cookies();
  const exp = decodeClaims(t.accessToken).exp;
  jar.set(AT, t.accessToken, cookieOptions(Math.max(60, exp ? exp - Math.floor(Date.now() / 1000) : 3600)));
  // The platform team is signed out after a week of not using it, not a month.
  jar.set(RT, t.refreshToken, cookieOptions(7 * 86400));
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  for (const n of [AT, RT]) jar.delete(n);
}

export function safeNext(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") && s.length < 300 ? s : "/";
}
