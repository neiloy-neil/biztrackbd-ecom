import type { NextRequest } from "next/server";

/**
 * Resolves the public base URL/origin for the admin application.
 * Guaranteed to preserve the port (e.g. :3001) in local development and handle
 * reverse proxies (x-forwarded-host, x-forwarded-port, x-forwarded-proto).
 */
export function resolveAdminOrigin(
  headersList: Headers,
  fallbackPort: number = 3001
): string {
  // 1. Explicit environment variable override takes precedence if set
  const envUrl = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_ADMIN_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/$/, "");
  }

  // 2. Extract host and proto from headers
  const fwdHost = headersList.get("x-forwarded-host");
  const directHost = headersList.get("host");
  const defaultHost =
    process.env.NODE_ENV === "production" ? "admin.biztrack.bd" : `localhost:${fallbackPort}`;
  const rawHost = (fwdHost || directHost || defaultHost).split(",")[0]!.trim();
  const fwdProto = headersList.get("x-forwarded-proto");
  const fwdPort = headersList.get("x-forwarded-port");

  const proto = fwdProto || (rawHost.startsWith("localhost") || rawHost.startsWith("127.0.0.1") ? "http" : "https");
  let host = rawHost;

  // 3. Port preservation logic
  if (!host.includes(":")) {
    if (fwdPort && fwdPort !== "80" && fwdPort !== "443") {
      host = `${host}:${fwdPort}`;
    } else if (host === "localhost" || host === "127.0.0.1") {
      // If directHost has a port, prefer directHost
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
export function resolveAdminRequestOrigin(
  req: NextRequest,
  fallbackPort: number = 3001
): string {
  return resolveAdminOrigin(req.headers, fallbackPort);
}
