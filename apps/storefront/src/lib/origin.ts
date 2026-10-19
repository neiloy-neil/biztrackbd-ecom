import { headers } from "next/headers";
import type { NextRequest } from "next/server";

/**
 * Resolves the public base URL/origin for the storefront application.
 * Guaranteed to preserve the port (e.g. :3000) in local development and handle
 * reverse proxies (x-forwarded-host, x-forwarded-port, x-forwarded-proto).
 */
export function resolveStorefrontOrigin(
  headersList: Headers,
  fallbackPort: number = 3000
): string {
  const envUrl = process.env.STOREFRONT_URL || process.env.NEXT_PUBLIC_STOREFRONT_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, "");
  }

  const fwdHost = headersList.get("x-forwarded-host");
  const directHost = headersList.get("host");
  const rawHost = (fwdHost || directHost || `localhost:${fallbackPort}`).split(",")[0]!.trim();
  const fwdProto = headersList.get("x-forwarded-proto");
  const fwdPort = headersList.get("x-forwarded-port");

  const proto = fwdProto || (rawHost.startsWith("localhost") || rawHost.startsWith("127.0.0.1") ? "http" : "https");
  let host = rawHost;

  if (!host.includes(":")) {
    if (fwdPort && fwdPort !== "80" && fwdPort !== "443") {
      host = `${host}:${fwdPort}`;
    } else if (host === "localhost" || host === "127.0.0.1") {
      if (directHost && directHost.includes(":")) {
        host = directHost;
      } else {
        host = `${host}:${fallbackPort}`;
      }
    }
  }

  return `${proto}://${host}`;
}

/**
 * Resolves the origin from an incoming NextRequest in Route Handlers.
 */
export function resolveStorefrontRequestOrigin(
  req: NextRequest,
  fallbackPort: number = 3000
): string {
  return resolveStorefrontOrigin(req.headers, fallbackPort);
}

/** The public origin of this request, for canonical links, Open Graph and the sitemap. */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  return resolveStorefrontOrigin(h, 3000);
}

/** Makes a stored image path absolute so social crawlers can fetch it. */
export function absolute(origin: string, url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
