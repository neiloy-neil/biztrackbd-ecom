/** Where a store's public pages are served from in this environment (the preview iframe and "view page" links). */
export function storefrontOrigin(subdomain: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000");
  const proto = root.includes("localhost") ? "http" : "https";
  return `${proto}://${subdomain}.${root}`;
}
