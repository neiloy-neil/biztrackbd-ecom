import { classifyHost, normalizeHost } from "./host";

/** What the directory knows about a hostname. Small on purpose: it is copied into Edge Config and caches. */
export interface HostEntry {
  tenantId: string;
  subdomain: string;
  themeId: string;
  locale: string;
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";
  /** How the requested host matched this store. */
  matched: "subdomain" | "custom" | "custom_www" | "previous_subdomain";
  /** The store's primary verified custom domain, or null. Every other hostname redirects here. */
  primaryDomain: string | null;
  redirectWww: boolean;
}

export type RouteDecision =
  | { action: "marketing" }
  | { action: "not_found" }
  | { action: "offline"; headers: Record<string, string> }
  | { action: "redirect"; status: 301 | 308; location: string }
  | { action: "serve"; headers: Record<string, string> };

/** Headers the proxy sets. Anything a client sends under this prefix is deleted first, so the app can trust them. */
export const TRUSTED_HEADER_PREFIX = "x-bt-";

export const HEADERS = {
  tenantId: "x-bt-tenant-id",
  subdomain: "x-bt-subdomain",
  theme: "x-bt-theme",
  locale: "x-bt-locale",
  status: "x-bt-status",
  route: "x-bt-route",
} as const;

export interface DecideInput {
  host: string | null;
  path: string;
  search: string;
  rootDomain: string;
  protocol: "http" | "https";
  /** Looked up by the caller for the normalised host. Null means unknown. */
  entry: HostEntry | null;
}

function headersFor(entry: HostEntry, route: "store" | "offline"): Record<string, string> {
  return {
    [HEADERS.tenantId]: entry.tenantId,
    [HEADERS.subdomain]: entry.subdomain,
    [HEADERS.theme]: entry.themeId,
    [HEADERS.locale]: entry.locale,
    [HEADERS.status]: entry.status,
    [HEADERS.route]: route,
  };
}

/**
 * The whole routing policy, with no framework or network in it so it can be tested exhaustively.
 * Redirect targets come only from the directory (a store's own verified domain), never from the request,
 * so this cannot be turned into an open redirect.
 */
export function decideRoute(input: DecideInput): RouteDecision {
  const cls = classifyHost(input.host, input.rootDomain);
  if (cls.kind === "root") return { action: "marketing" };
  if (cls.kind === "invalid" || cls.kind === "reserved") return { action: "not_found" };

  const entry = input.entry;
  if (!entry) return { action: "not_found" };

  const host = normalizeHost(input.host)!;
  const tail = `${input.path.startsWith("/") ? input.path : `/${input.path}`}${input.search}`;
  const go = (target: string): RouteDecision => ({ action: "redirect", status: 308, location: `${input.protocol}://${target}${tail}` });

  // Legacy subdomain migration: 301 permanent redirect to the new primary address preserving path and query.
  if (entry.matched === "previous_subdomain") {
    const cleanRoot = input.rootDomain.toLowerCase().replace(/:\d+$/, "");
    const target = entry.primaryDomain ?? `${entry.subdomain}.${cleanRoot}`;
    return { action: "redirect", status: 301, location: `${input.protocol}://${target}${tail}` };
  }

  // Canonical host: one address per store so search engines and customers see a single site.
  if (entry.matched === "custom_www") {
    // www.shop.com -> shop.com (or the store's primary domain)
    return go(entry.primaryDomain ?? host.replace(/^www\./, ""));
  }
  if (entry.primaryDomain && entry.primaryDomain !== host) {
    // the subdomain and any secondary domain send visitors to the primary custom domain
    return go(entry.primaryDomain);
  }

  if (entry.status === "SUSPENDED" || entry.status === "CANCELLED") {
    return { action: "offline", headers: headersFor(entry, "offline") };
  }
  return { action: "serve", headers: headersFor(entry, "store") };
}
