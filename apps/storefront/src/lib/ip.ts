import { headers } from "next/headers";

/** Best-effort client IP for rate limits. Behind the platform's proxy the first forwarded address is the visitor. */
export async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
}
