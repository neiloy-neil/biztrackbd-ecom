import type { NextRequest } from "next/server";

/**
 * What Meta needs to tie a payment back to the ad click: the visitor's address and browser, and the Pixel's _fbp and _fbc cookies.
 * Only the browser coming back from the payment page carries these; a gateway calling our webhook does not.
 */
export function purchaseContext(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  return {
    ip,
    userAgent: req.headers.get("user-agent"),
    fbp: req.cookies.get("_fbp")?.value ?? null,
    fbc: req.cookies.get("_fbc")?.value ?? null,
    url: req.nextUrl.origin,
  };
}
