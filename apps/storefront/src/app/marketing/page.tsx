import { notFound } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

/** Placeholder for the platform's own site (Phase 6). Only reachable through the proxy's rewrite for the root domain. */
export default async function Marketing() {
  const h = await headers();
  // The proxy sets no store headers for the root domain. A store hostname that types /marketing must not see this page.
  if (h.get("x-bt-route")) notFound();
  return (
    <main className="wrap" style={{ padding: "80px 0" }}>
      <h1>BizTrackBD</h1>
      <p className="muted">Online stores for Bangladeshi businesses. This site arrives in a later phase.</p>
    </main>
  );
}
