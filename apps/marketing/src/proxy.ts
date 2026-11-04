import { NextResponse, type NextRequest } from "next/server";
import { createCsp } from "@biztrackbd/core";

/**
 * Gives every page request a fresh script nonce and a Content-Security-Policy that uses it (security audit F5). The nonce reaches the
 * page through the request headers, where Next.js picks it up for its own scripts and for <Script> tags. Report-only unless CSP_MODE=enforce.
 */
export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|map|woff2?|ttf|xml|txt)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

export function proxy(req: NextRequest): NextResponse {
  const csp = createCsp();
  return csp.apply(NextResponse.next({ request: { headers: csp.requestHeaders(req.headers) } }));
}
