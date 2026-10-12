/**
 * Hostnames are attacker-controlled input (the Host header). Everything that decides which store a request belongs to
 * starts here: one strict normaliser, one classifier, no clever parsing elsewhere.
 */

/** Labels a store may never use as its subdomain. They are platform surfaces or look like one. */
export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "admin", "api", "platform", "super", "superadmin", "dashboard", "login", "signin", "signup", "register",
  "auth", "account", "accounts", "billing", "pay", "payments", "checkout", "static", "assets", "cdn", "img", "images",
  "media", "files", "mail", "email", "smtp", "imap", "pop", "ftp", "ns1", "ns2", "dns", "cname", "status", "help",
  "support", "docs", "blog", "shop", "store", "stores", "demo", "test", "staging", "dev", "preview", "internal", "root",
  "biztrack", "biztrackbd", "webhook", "webhooks", "hooks", "edge", "vercel", "supabase",
]);

/** Addresses of the template demo stores (docs/38). Not in RESERVED_SUBDOMAINS, because those stores must still resolve; only signup may not claim them. */
export const DEMO_SUBDOMAINS = new Set(["kapor", "gadgetstudio", "minibunny", "mini-bunny", "axionwear", "bindu", "berber"]);

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Lowercases, strips one port and one trailing dot, and rejects anything that is not a plain DNS name.
 * Returns null for the empty string, IP addresses, IPv6 literals, underscores, spaces, non-ASCII, empty labels,
 * over-long labels or names. Callers treat null as "not a store".
 */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let h = raw.trim().toLowerCase();
  if (h.startsWith("[")) return null; // IPv6 literal
  h = h.replace(/:\d{1,5}$/, "");
  if (h.endsWith(".")) h = h.slice(0, -1);
  if (h.length === 0 || h.length > 253) return null;
  if (IPV4.test(h)) return null;
  for (const label of h.split(".")) if (!LABEL.test(label)) return null;
  return h;
}

export type HostClass =
  | { kind: "invalid" }
  | { kind: "root" } // the platform's own site, with or without www
  | { kind: "reserved"; label: string }
  | { kind: "subdomain"; label: string }
  | { kind: "custom"; host: string };

export function classifyHost(rawHost: string | null | undefined, rootDomain: string): HostClass {
  const host = normalizeHost(rawHost);
  const root = normalizeHost(rootDomain);
  if (!host || !root) return { kind: "invalid" };
  if (host === root || host === `www.${root}`) return { kind: "root" };
  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, -(root.length + 1));
    // One label only. "a.b.root" is not a store, so a store's cookies and scripts cannot be framed by a nested name.
    if (label.includes(".")) return { kind: "invalid" };
    if (RESERVED_SUBDOMAINS.has(label)) return { kind: "reserved", label };
    return { kind: "subdomain", label };
  }
  return { kind: "custom", host };
}

export type SubdomainCheck = { ok: true; label: string } | { ok: false; reason: "too_short" | "too_long" | "invalid" | "reserved" };

/** For onboarding and settings: is this a subdomain a store may claim? */
export function validateSubdomain(input: string): SubdomainCheck {
  const label = input.trim().toLowerCase();
  if (label.length < 3) return { ok: false, reason: "too_short" };
  if (label.length > 40) return { ok: false, reason: "too_long" };
  if (!LABEL.test(label) || label.includes("--")) return { ok: false, reason: "invalid" };
  if (RESERVED_SUBDOMAINS.has(label) || DEMO_SUBDOMAINS.has(label)) return { ok: false, reason: "reserved" };
  return { ok: true, label };
}

export type DomainCheck = { ok: true; domain: string } | { ok: false; reason: "invalid" | "platform_domain" | "needs_tld" };

/**
 * For a store connecting its own domain. A leading "www." is dropped, because the apex is canonical and the www twin
 * is provisioned alongside it (docs/13 section 6).
 */
export function validateCustomDomain(input: string, rootDomain: string): DomainCheck {
  const stripped = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const host = normalizeHost(stripped);
  if (!host) return { ok: false, reason: "invalid" };
  const root = normalizeHost(rootDomain);
  const apex = host.startsWith("www.") ? host.slice(4) : host;
  if (root && (apex === root || apex.endsWith(`.${root}`))) return { ok: false, reason: "platform_domain" };
  const labels = apex.split(".");
  if (labels.length < 2) return { ok: false, reason: "needs_tld" };
  const tld = labels[labels.length - 1]!;
  if (!/^[a-z]{2,24}$/.test(tld) && !/^xn--[a-z0-9-]+$/.test(tld)) return { ok: false, reason: "invalid" };
  return { ok: true, domain: apex };
}
