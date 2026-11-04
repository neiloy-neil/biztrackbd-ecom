/**
 * Per-request Content-Security-Policy with a script nonce (security audit F5).
 *
 * Each app's proxy calls createCsp(req.headers) for every page request, passes `csp.requestHeaders(...)` to NextResponse.next/rewrite (Next reads
 * the nonce from the request's CSP header and puts it on its own scripts and on <Script nonce>), and runs the response through `csp.apply(res)`.
 *
 * Mode comes from CSP_MODE: "report-only" (the default: violations are reported in the browser console, nothing is blocked) or "enforce".
 * Frame rules (frame-ancestors, X-Frame-Options), object-src, base-uri and form-action stay in each app's next.config headers as an
 * always-enforced baseline, so they are not repeated here.
 */

export type CspMode = "report-only" | "enforce";

export interface CspOptions {
  nonce?: string;
  mode?: CspMode;
  dev?: boolean;
}

export function cspMode(raw = process.env.CSP_MODE): CspMode {
  return raw === "enforce" ? "enforce" : "report-only";
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** The policy text. No 'unsafe-inline' for scripts; styles keep it (React inline styles and style tags are used throughout). */
export function buildCspPolicy(nonce: string, dev = false): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic': scripts a nonced script loads (Meta Pixel, gtag, GTM, TikTok, Speed Insights) are trusted; 'self' and host lists are ignored then.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    // Analytics beacons and the apps' own APIs; dev adds the hot-reload socket.
    `connect-src 'self' https:${dev ? " ws: http://localhost:* http://127.0.0.1:*" : ""}`,
    "media-src 'self' blob: https:",
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

export interface RequestCsp {
  nonce: string;
  mode: CspMode;
  headerName: "Content-Security-Policy" | "Content-Security-Policy-Report-Only";
  value: string;
  /** A copy of the request headers carrying the nonce and policy, for NextResponse.next/rewrite({ request: { headers } }). */
  requestHeaders(base: Headers): Headers;
  /** Sets the policy header on a response and returns it. */
  apply<T extends { headers: Headers }>(res: T): T;
}

export function createCsp(opts: CspOptions = {}): RequestCsp {
  const nonce = opts.nonce ?? generateNonce();
  const mode = opts.mode ?? cspMode();
  const dev = opts.dev ?? process.env.NODE_ENV === "development";
  const headerName = mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
  const value = buildCspPolicy(nonce, dev);
  return {
    nonce,
    mode,
    headerName,
    value,
    requestHeaders(base) {
      const h = new Headers(base);
      h.set("x-nonce", nonce);
      h.set(headerName, value);
      return h;
    },
    apply(res) {
      res.headers.set(headerName, value);
      return res;
    },
  };
}
