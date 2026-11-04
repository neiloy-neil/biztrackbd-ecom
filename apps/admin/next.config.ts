import { resolve } from "node:path";
import type { NextConfig } from "next";

// One shared env file at the repo root (gitignored). Existing process env wins.
try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* no root env file, rely on the real environment */
}


// Baseline hardening for every response (docs/16 Phase 8 security review): framing, object-src, base-uri and form-action are always enforced here.
// The script policy (per-request nonce + 'strict-dynamic') is set by src/proxy.ts through @biztrackbd/core createCsp, as
// Content-Security-Policy-Report-Only until CSP_MODE=enforce is set.
const securityHeaders = (frameAncestors: string) => [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors ${frameAncestors}` },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const config: NextConfig = {
  outputFileTracingRoot: resolve(process.cwd(), "../../"),
  transpilePackages: ["@biztrackbd/core", "@biztrackbd/db", "@biztrackbd/ui", "@biztrackbd/media"],
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "sharp"],
  images: {
    // Product photos live in Supabase Storage. Lists show them as 44px thumbnails and small cards, so serve resized AVIF/WebP, not the originals.
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  async headers() {
    return [
      // The print preview in settings (Invoices) is shown in a frame on our own pages. Every other page refuses to be framed.
      { source: "/orders/print", headers: [...securityHeaders("'self'"), { key: "X-Frame-Options", value: "SAMEORIGIN" }] },
      { source: "/:path((?!orders/print$).*)", headers: [...securityHeaders("'none'"), { key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default config;
