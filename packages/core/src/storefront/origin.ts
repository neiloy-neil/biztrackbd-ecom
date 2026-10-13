import { withTenant } from "@biztrackbd/db";

/** The address customers use for a store: its verified main custom domain, otherwise its subdomain. No trailing slash. */
export async function storeOriginFor(tenantId: string): Promise<string> {
  const t = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findFirstOrThrow({ select: { subdomain: true } });
    const domain = await tx.domain.findFirst({ where: { isPrimary: true, verified: true }, select: { domain: true } });
    return { subdomain: tenant.subdomain, domain: domain?.domain ?? null };
  });
  if (t.domain) return `https://${t.domain}`;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  return `${root.startsWith("localhost") ? "http" : "https"}://${t.subdomain}.${root}`;
}
