import { NextResponse, type NextRequest } from "next/server";
import { AuthFailure, decodeClaims, refreshSession } from "@biztrackbd/core";
import { AT, RT, authMode, cookieOptions } from "@/lib/auth";

/** Keeps a signed-in platform person signed in by trading the refresh token for a fresh pair shortly before the access token runs out. */
export const config = {
  matcher: ["/((?!_next/|api/cron/|.*\\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|woff2?|ttf)$).*)"],
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
    req.cookies.set(AT, t.accessToken);
    req.cookies.set(RT, t.refreshToken);
    const res = NextResponse.next({ request: { headers: req.headers } });
    res.cookies.set(AT, t.accessToken, cookieOptions(Math.max(60, decodeClaims(t.accessToken).exp - Math.floor(Date.now() / 1000))));
    res.cookies.set(RT, t.refreshToken, cookieOptions(7 * 86400));
    return res;
  } catch (e) {
    if (e instanceof AuthFailure && e.code === "EXPIRED") {
      req.cookies.delete(AT);
      req.cookies.delete(RT);
      const res = NextResponse.next({ request: { headers: req.headers } });
      for (const n of [AT, RT]) res.cookies.delete(n);
      return res;
    }
    return NextResponse.next();
  }
}
