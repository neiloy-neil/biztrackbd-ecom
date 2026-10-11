import { resolve } from "node:path";
import type { NextConfig } from "next";

// One shared env file at the repo root (gitignored). Existing process env wins.
try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* no root env file, rely on the real environment */
}


// Baseline hardening for every response (docs/16 Phase 8 security review). A strict script-src is NOT set: the Meta Pixel and
// Next's own inline bootstrap would need nonces, which is later work. These directives are the ones that are safe today.
const securityHeaders = (frameAncestors: string) => [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors ${frameAncestors}` },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const config: NextConfig = {
  transpilePackages: ["@biztrackbd/core", "@biztrackbd/db", "@biztrackbd/ui", "@biztrackbd/media"],
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "sharp", "sanitize-html"],
  images: {
    // AVIF first, WebP as the fallback: much smaller than JPEG on Bangladesh mobile networks (docs/14).
    formats: ["image/avif", "image/webp"],
    qualities: [55, 60, 72, 75],
    deviceSizes: [360, 414, 640, 828, 1080, 1280],
    imageSizes: [56, 76, 120, 230, 360],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Store media lives in Supabase Storage (docs/14). Only that host and our own demo files are optimised.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  poweredByHeader: false,
  async headers() {
    // Production needs NEXT_PUBLIC_ADMIN_URL; without it the editor preview cannot be framed (it fails closed).
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3001");
    const admin = adminUrl ? new URL(adminUrl).origin : "";
    return [
      { source: "/:path*", headers: securityHeaders("'self'") },
      // The editor shows /preview and /l/<page>?preview=... in an iframe. Both need the signed link to show anything.
      { source: "/preview", headers: securityHeaders(`'self' ${admin}`.trim()) },
      { source: "/l/:path*", headers: securityHeaders(`'self' ${admin}`.trim()) },
    ];
  },
};

export default config;
