import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { ValidationError } from "../errors";
import { checkPublicHttpUrl, isPrivateAddress } from "./safe-url";

/**
 * Fetch for URLs a merchant typed in (webhook targets, a store's own WhatsApp gateway) that closes the DNS-rebinding window.
 *
 * assertPublicHttpUrl resolves the hostname and checks the answer, but a normal fetch then resolves it AGAIN to connect, and an attacker's
 * DNS server can answer differently the second time (public for the check, 169.254.169.254 for the connection). Here the hostname is resolved
 * ONCE, every address is checked, and the connection is made to that checked address. The URL keeps its hostname, so the Host header, the
 * TLS server name (SNI) and the certificate check still use the original name. Redirects are not followed unless asked, and each hop is
 * checked and pinned the same way.
 *
 * Outside production private addresses are allowed (local development and tests), and then this is a plain fetch.
 */

export interface ResolvedAddress {
  address: string;
  family: number;
}
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface SafeFetchOptions {
  /** Defaults to NODE_ENV !== "production". When true no address checking or pinning happens (plain fetch). */
  allowPrivate?: boolean;
  field?: string;
  requireHttps?: boolean;
  /** How many redirects to follow (GET and HEAD only; each target is checked and pinned). Default 0: a 3xx is returned as it is. */
  maxRedirects?: number;
  /** Largest response body kept, in bytes. Default 1 MiB. */
  maxBytes?: number;
  /** Test hooks. */
  resolve?: Resolver;
  isAddressAllowed?: (address: string) => boolean;
}

const defaultResolve: Resolver = async (hostname) => (await dnsLookup(hostname, { all: true })).map((a) => ({ address: a.address, family: a.family }));
const defaultAllowed = (address: string) => !isPrivateAddress(address);

/** Resolves once and returns the address to connect to; throws if the name cannot be resolved or ANY answer is not public. */
export async function resolvePinned(hostname: string, opts: SafeFetchOptions = {}): Promise<ResolvedAddress> {
  const field = opts.field ?? "url";
  const host = hostname.replace(/^\[|\]$/g, "");
  const allowed = opts.isAddressAllowed ?? defaultAllowed;
  let answers: ResolvedAddress[];
  const literal = isIP(host);
  if (literal) answers = [{ address: host, family: literal }];
  else {
    try {
      answers = await (opts.resolve ?? defaultResolve)(host);
    } catch {
      throw new ValidationError("The address could not be resolved", { field });
    }
  }
  if (answers.length === 0 || answers.some((a) => !allowed(a.address))) {
    throw new ValidationError("The URL must point to a public address, not an internal one", { field });
  }
  return answers[0]!;
}

function request(url: URL, init: RequestInit, pinned: ResolvedAddress, maxBytes: number): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => {
      headers[k] = v;
    });
    const body = init.body == null ? undefined : typeof init.body === "string" ? init.body : String(init.body);
    if (body !== undefined && !("content-length" in headers)) headers["content-length"] = String(Buffer.byteLength(body));
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ""), // the original name: Host header, TLS SNI and certificate check
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: init.method ?? "GET",
        headers,
        signal: init.signal ?? undefined,
        // The only name resolution on this connection: hand back the address that was already checked.
        lookup: (_host, options, cb) => {
          const done = cb as unknown as (err: Error | null, address: string | { address: string; family: number }[], family?: number) => void;
          if ((options as { all?: boolean }).all) done(null, [{ address: pinned.address, family: pinned.family }]);
          else done(null, pinned.address, pinned.family);
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let settled = false;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size <= maxBytes) chunks.push(c);
          else res.destroy();
        });
        const finish = () => {
          if (settled) return;
          settled = true;
          const h = new Headers();
          for (const [k, v] of Object.entries(res.headers)) for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) h.append(k, one);
          const status = res.statusCode ?? 502;
          const nullBody = status === 204 || status === 205 || status === 304;
          resolve(new Response(nullBody ? null : Buffer.concat(chunks), { status, headers: h }));
        };
        res.on("end", finish);
        res.on("close", finish);
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/** fetch() for a merchant-supplied URL: public addresses only, connection pinned to the checked address, redirects checked. */
export async function safeFetch(urlStr: string, init: RequestInit = {}, opts: SafeFetchOptions = {}): Promise<Response> {
  const allowPrivate = opts.allowPrivate ?? process.env.NODE_ENV !== "production";
  if (allowPrivate) {
    checkPublicHttpUrl(urlStr, { allowPrivate: true, field: opts.field, requireHttps: opts.requireHttps });
    return fetch(urlStr, { ...init, redirect: "manual" });
  }
  const maxBytes = opts.maxBytes ?? 1024 * 1024;
  const method = (init.method ?? "GET").toUpperCase();
  let current = urlStr;
  for (let hop = 0; ; hop++) {
    const url = checkPublicHttpUrl(current, { allowPrivate: false, field: opts.field, requireHttps: opts.requireHttps });
    const pinned = await resolvePinned(url.hostname, opts);
    const res = await request(url, { ...init, method }, pinned, maxBytes);
    const location = res.headers.get("location");
    const redirect = res.status >= 300 && res.status < 400 && location;
    if (!redirect || hop >= (opts.maxRedirects ?? 0) || (method !== "GET" && method !== "HEAD")) return res;
    current = new URL(location, url).toString();
  }
}
