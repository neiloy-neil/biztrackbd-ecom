import { NextResponse, type NextRequest } from "next/server";
import { AuthFailure, decodeClaims, refreshSession } from "@biztrackbd/core";
import { AT, RT, TENANT, authMode, cookieOptions } from "@/lib/auth";

/**
 * Keeps a signed-in person signed in. Supabase access tokens last an hour; when one is about to run out (or already has) this
 * trades the refresh token for a fresh pair, before the page is built, so the page sees the new cookie and the browser gets it
 * too. A refresh token that Supabase no longer accepts (signed out elsewhere, account removed) clears the cookies.
 * Does nothing in development with DEV_AUTH=1.
 */
export const config = {
  matcher: ["/((?!_next/|api/cron/|api/webhooks/|media/|manifest|icons/|sw\\.js|.*\\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|woff2?|ttf)$).*)"],
};

const LEEWAY_SECONDS = 90;

export async function proxy(req: NextRequest): Promise<NextResponse> {
  if (authMode() === "dev") return NextResponse.next();
  const rt = req.cookies.get(RT)?.value;
  if (!rt) return NextResponse.next();
  const at = req.cookies.get(AT)?.value;
  const exp = at ? decodeClaims(at).exp : 0;
  if (exp && exp - Math.floor(Date.now() / 1000) > LEEWAY_SECONDS) return NextResponse.next();

  try {
    const t = await refreshSession(rt);
    // The page being built must see the new tokens, and so must the browser.
    req.cookies.set(AT, t.accessToken);
    req.cookies.set(RT, t.refreshToken);
    const res = NextResponse.next({ request: { headers: req.headers } });
    const claims = decodeClaims(t.accessToken);
    res.cookies.set(AT, t.accessToken, cookieOptions(Math.max(60, claims.exp - Math.floor(Date.now() / 1000))));
    res.cookies.set(RT, t.refreshToken, cookieOptions(30 * 86400));
    return res;
  } catch (e) {
    if (e instanceof AuthFailure && e.code === "EXPIRED") {
      req.cookies.delete(AT);
      req.cookies.delete(RT);
      const res = NextResponse.next({ request: { headers: req.headers } });
      for (const n of [AT, RT, TENANT]) res.cookies.delete(n);
      return res;
    }
    // Supabase is unreachable: carry on, and the page will ask the person to try again rather than signing them out.
    return NextResponse.next();
  }
}
