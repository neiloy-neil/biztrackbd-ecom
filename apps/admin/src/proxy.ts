import { NextResponse, type NextRequest } from "next/server";
import { AuthFailure, createCsp, decodeClaims, refreshSession, type RequestCsp } from "@biztrackbd/core";
import { AT, DEMO, DEMO_PREV, RT, TENANT, authMode, cookieOptions } from "@/lib/auth";

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

/** The pages of signing in. Reaching one means the person wants their own store, so a demo session (docs/41) ends here. */
const isSignIn = (path: string) => path === "/login" || path.startsWith("/login/") || path === "/choose-store";

/** Every response carries the per-request CSP (nonce policy, report-only unless CSP_MODE=enforce); the nonce also goes to the page via the request headers. */
export async function proxy(req: NextRequest): Promise<NextResponse> {
  const csp = createCsp();
  return csp.apply(await route(req, csp));
}

async function route(req: NextRequest, csp: RequestCsp): Promise<NextResponse> {
  const pass = () => NextResponse.next({ request: { headers: csp.requestHeaders(req.headers) } });
  const demo = req.cookies.get(DEMO)?.value;
  if (demo && isSignIn(req.nextUrl.pathname)) {
    // The page being built must not see the demo cookie either, so it is dropped from the request as well as the browser.
    // A copy is kept for 20 minutes (only on the sign-in page) so it can offer "keep the demo store you were trying".
    req.cookies.delete(DEMO);
    req.cookies.set(DEMO_PREV, demo);
    const res = pass();
    res.cookies.delete(DEMO);
    res.cookies.set(DEMO_PREV, demo, cookieOptions(20 * 60));
    return res;
  }
  if (authMode() === "dev") return pass();
  const rt = req.cookies.get(RT)?.value;
  if (!rt) return pass();
  const at = req.cookies.get(AT)?.value;
  const exp = at ? decodeClaims(at).exp : 0;
  if (exp && exp - Math.floor(Date.now() / 1000) > LEEWAY_SECONDS) return pass();

  try {
    const t = await refreshSession(rt);
    // The page being built must see the new tokens, and so must the browser.
    req.cookies.set(AT, t.accessToken);
    req.cookies.set(RT, t.refreshToken);
    const res = pass();
    const claims = decodeClaims(t.accessToken);
    res.cookies.set(AT, t.accessToken, cookieOptions(Math.max(60, claims.exp - Math.floor(Date.now() / 1000))));
    res.cookies.set(RT, t.refreshToken, cookieOptions(30 * 86400));
    return res;
  } catch (e) {
    if (e instanceof AuthFailure && e.code === "EXPIRED") {
      req.cookies.delete(AT);
      req.cookies.delete(RT);
      const res = pass();
      for (const n of [AT, RT, TENANT]) res.cookies.delete(n);
      return res;
    }
    // Supabase is unreachable: carry on, and the page will ask the person to try again rather than signing them out.
    return pass();
  }
}
