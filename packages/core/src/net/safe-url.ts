import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ValidationError } from "../errors";

/**
 * Guards against server-side request forgery for URLs a merchant types in (webhook targets, WhatsApp gateway address).
 * Without it a store admin could point the server at localhost, the cloud metadata service or the private network.
 *
 * Outside production, loopback and private addresses are allowed so local development and tests keep working.
 */

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".lan", ".home.arpa"];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
}

function inV4(ip: string, base: string, bits: number): boolean {
  const size = 2 ** (32 - bits);
  const start = Math.floor(ipv4ToInt(base) / size) * size;
  const n = ipv4ToInt(ip);
  return n >= start && n < start + size;
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** True for loopback, private, link-local, multicast and other non-public addresses (IPv4 and IPv6). */
export function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();
  const family = isIP(ip);
  if (family === 4) return PRIVATE_V4.some(([base, bits]) => inV4(ip, base, bits));
  if (family === 6) {
    if (ip === "::" || ip === "::1") return true;
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) ?? ip.match(/^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    const hextets = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hextets) {
      const hi = parseInt(hextets[1]!, 16);
      const lo = parseInt(hextets[2]!, 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(ip.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    return false;
  }
  return false;
}

function allowPrivateByDefault(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Synchronous check on the address itself: http(s) only, no credentials in the URL, and no hostname that is obviously internal.
 * Does not resolve DNS; use assertPublicHttpUrl before actually connecting.
 */
export function checkPublicHttpUrl(
  urlStr: string,
  opts: { allowPrivate?: boolean; field?: string; requireHttps?: boolean } = {},
): URL {
  const field = opts.field ?? "url";
  const allowPrivate = opts.allowPrivate ?? allowPrivateByDefault();
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new ValidationError("Please enter a valid URL", { field });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ValidationError("The URL must use HTTP or HTTPS", { field });
  }
  if (allowPrivate) return url;
  if (url.protocol !== "https:" && opts.requireHttps) {
    throw new ValidationError("The URL must use HTTPS", { field });
  }
  if (url.username || url.password) {
    throw new ValidationError("The URL must not contain a username or password", { field });
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (
    !host ||
    host === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s)) ||
    (isIP(host) !== 0 && isPrivateAddress(host)) ||
    (isIP(host) === 0 && !host.includes("."))
  ) {
    throw new ValidationError("The URL must point to a public address, not an internal one", { field });
  }
  return url;
}

/**
 * Full check before connecting: the syntax rules above, plus every address the hostname resolves to must be public.
 * A hostname that resolves to a private address (or that cannot be resolved) is refused.
 * Residual risk: DNS can change between this lookup and the connection (rebinding); it narrows, not closes, that window.
 */
export async function assertPublicHttpUrl(
  urlStr: string,
  opts: { allowPrivate?: boolean; field?: string; requireHttps?: boolean } = {},
): Promise<URL> {
  const url = checkPublicHttpUrl(urlStr, opts);
  if (opts.allowPrivate ?? allowPrivateByDefault()) return url;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return url;
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new ValidationError("The address could not be resolved", { field: opts.field ?? "url" });
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new ValidationError("The URL must point to a public address, not an internal one", { field: opts.field ?? "url" });
  }
  return url;
}
