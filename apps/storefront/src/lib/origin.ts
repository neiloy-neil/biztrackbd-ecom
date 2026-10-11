import { headers } from "next/headers";

/** The public origin of this request, for canonical links, Open Graph and the sitemap. */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const forwarded = h.get("x-forwarded-proto");
  const proto = forwarded === "http" || forwarded === "https" ? forwarded : /^(localhost|127\.|.*\.localhost)(:|$)/.test(host) ? "http" : "https";
  return `${proto}://${host}`;
}

/** Makes a stored image path absolute so social crawlers can fetch it. */
export function absolute(origin: string, url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
