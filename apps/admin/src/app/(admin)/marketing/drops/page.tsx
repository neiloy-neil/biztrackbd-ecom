import { requireAccess } from "@/lib/session";
import { withTenant } from "@biztrackbd/db";
import { listDrops } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { DropsManagerClient } from "./drops-manager-client";

export const metadata = {
  title: "Limited Drops & Pre-Orders | Admin",
};

export default async function DropsPage() {
  const s = await requireAccess("marketing", "view");

  const [drops, products] = await Promise.all([
    listDrops(s.tenantId),
    withTenant(s.tenantId, async (tx) => {
      const prods = await tx.product.findMany({
        where: { tenantId: s.tenantId, deletedAt: null },
        select: {
          id: true,
          title: true,
          variants: {
            where: { isActive: true },
            select: { price: true, stockQuantity: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return prods.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.variants[0] ? Number(p.variants[0].price) : 0,
        stockQuantity: p.variants[0]?.stockQuantity ?? 0,
      }));
    }),
  ]);

  return (
    <div className="stack">
      <PageHeader
        title="Limited Drops & Pre-Orders"
        crumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Limited Drops" }]}
        sub="Launch timed exclusive drops, collect buyer waitlists, and secure pre-orders with partial advance deposits."
      />
      <DropsManagerClient
        initialDrops={drops as any}
        availableProducts={products}
        storeDomain={s.tenantSubdomain}
      />
    </div>
  );
}
