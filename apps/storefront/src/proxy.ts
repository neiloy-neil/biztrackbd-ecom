import { NextResponse, type NextRequest } from "next/server";
import { TRUSTED_HEADER_PREFIX, decideRoute, normalizeHost } from "@biztrackbd/core";
import { getDirectory } from "@/lib/directory";

/**
 * Every request starts here (docs/13). Works out which store the hostname belongs to, applies the routing policy
 * (canonical redirects, offline stores, unknown hosts) and hands the store's identity to the app in trusted headers.
 * The decisions themselves live in @biztrackbd/core `decideRoute`, which is tested without a server.
 */
export const config = {
  // Everything except Next internals and static assets. robots.txt and sitemap.xml are included (they are per store).
  // API routes are included on purpose: they need the same
  // header clean-up, and webhook and payment callbacks arrive on store hostnames too.
  matcher: ["/((?!_next/|_static/|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|map|woff2?|ttf)$).*)"],
};

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const hostHeader = req.headers.get("host");
  const host = normalizeHost(hostHeader);

  let entry = null;
  if (host) {
    try {
      entry = await getDirectory().lookup(host);
    } catch (e) {
      // The directory (database) is unreachable and nothing usable is cached. Failing closed beats guessing a store.
      console.error("[proxy] host lookup failed", e instanceof Error ? e.name : "unknown");
      return new NextResponse("Service temporarily unavailable", { status: 503, headers: { "Retry-After": "5" } });
    }
  }

  const forwarded = req.headers.get("x-forwarded-proto");
  const protocol = forwarded === "http" || forwarded === "https" ? forwarded : req.nextUrl.protocol === "http:" ? "http" : "https";
  const decision = decideRoute({ host: hostHeader, path: req.nextUrl.pathname, search: req.nextUrl.search, rootDomain, protocol, entry });

  if (decision.action === "redirect") {
    return NextResponse.redirect(decision.location, decision.status);
  }

  // Anything a client sent under the trusted prefix is thrown away before we add our own.
  const headers = new Headers(req.headers);
  for (const name of [...headers.keys()]) if (name.startsWith(TRUSTED_HEADER_PREFIX)) headers.delete(name);

  switch (decision.action) {
    case "marketing":
      return NextResponse.rewrite(new URL("/marketing", req.url), { request: { headers } });
    case "not_found":
      return NextResponse.rewrite(new URL("/unknown-store", req.url), { request: { headers }, status: 404 });
    case "offline":
      for (const [k, v] of Object.entries(decision.headers)) headers.set(k, v);
      return NextResponse.rewrite(new URL("/offline", req.url), { request: { headers }, status: 503 });
    case "serve":
      for (const [k, v] of Object.entries(decision.headers)) headers.set(k, v);
      return NextResponse.next({ request: { headers } });
  }
}
