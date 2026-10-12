import { NextResponse, type NextRequest } from "next/server";
import { HEADERS, TRUSTED_HEADER_PREFIX, decideRoute, demoTemplate, normalizeHost } from "@biztrackbd/core";
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
  const cleanRoot = rootDomain.toLowerCase().replace(/:\d+$/, "");
  const hostHeader = req.headers.get("host");
  const host = normalizeHost(hostHeader);

  // 1. Path-based demo store access: /demo/<template-or-host>
  const demoPathMatch = req.nextUrl.pathname.match(/^\/demo\/([a-zA-Z0-9_-]+)(\/.*)?$/);
  if (demoPathMatch) {
    const slug = demoPathMatch[1]!.toLowerCase();
    const demo = demoTemplate(slug);
    if (demo) {
      let demoEntry = null;
      try {
        demoEntry = await getDirectory().lookup(`${demo.host}.${cleanRoot}`);
      } catch (e) {
        console.error("[proxy] demo host lookup failed", e instanceof Error ? e.name : "unknown");
      }
      if (demoEntry) {
        const headers = new Headers(req.headers);
        for (const name of [...headers.keys()]) if (name.startsWith(TRUSTED_HEADER_PREFIX)) headers.delete(name);
        headers.set(HEADERS.tenantId, demoEntry.tenantId);
        headers.set(HEADERS.subdomain, demoEntry.subdomain);
        headers.set(HEADERS.theme, demoEntry.themeId);
        headers.set(HEADERS.locale, demoEntry.locale);
        headers.set(HEADERS.status, demoEntry.status);
        headers.set(HEADERS.route, "store");

        const targetSubPath = demoPathMatch[2] || "/";
        const rewriteUrl = new URL(targetSubPath + req.nextUrl.search, req.url);
        const res = NextResponse.rewrite(rewriteUrl, { request: { headers } });
        res.cookies.set("bt_demo_store", demo.host, { path: "/", maxAge: 86400, sameSite: "lax" });
        return res;
      }
    }
  }

  // 2. Standard host lookup
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

  // 3. Demo fallback if entry was not matched directly by host:
  // Check if host corresponds to a known demo store label (e.g. mini-bunny vs minibunny or port differences)
  if (!entry && host) {
    const firstLabel = host.split(".")[0]?.toLowerCase();
    const demo = firstLabel ? demoTemplate(firstLabel) : undefined;
    if (demo) {
      try {
        entry = await getDirectory().lookup(`${demo.host}.${cleanRoot}`);
      } catch {
        // fall through
      }
    }
  }

  // Or check cookie fallback for visitors browsing demo stores without a dedicated store subdomain
  if (!entry && req.cookies.has("bt_demo_store") && !req.nextUrl.pathname.startsWith("/marketing") && !req.nextUrl.pathname.startsWith("/unknown-store")) {
    const cookieDemo = req.cookies.get("bt_demo_store")?.value.toLowerCase();
    const demo = cookieDemo ? demoTemplate(cookieDemo) : undefined;
    if (demo) {
      try {
        entry = await getDirectory().lookup(`${demo.host}.${cleanRoot}`);
      } catch {
        // fall through
      }
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
