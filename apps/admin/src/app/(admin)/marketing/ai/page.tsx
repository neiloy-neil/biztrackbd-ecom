import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@biztrackbd/ui";
import { withTenant } from "@biztrackbd/db";
import { requireAccess } from "@/lib/session";
import { AiStudioClient } from "./ai-studio-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Marketing Content Studio" };

export default async function AiStudioPage() {
  const s = await requireAccess("marketing");

  // Fetch active products for quick dropdown selection
  const products = await withTenant(s.tenantId, async (tx) => {
    const list = await tx.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        title: true,
        variants: { select: { price: true }, take: 1 },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });
    return list.map((p) => ({
      id: p.id,
      title: p.title,
      price: Number(p.variants[0]?.price ?? 0),
    }));
  });

  return (
    <>
      <PageHeader
        title="Marketing Content Studio"
        crumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Content Studio" }]}
        sub="Create social ad posts, WhatsApp broadcasts, SMS promotional copy, and banner slogans in Bangla or English."
        actions={
          <Link href="/settings/ai" className="btn btn-secondary btn-sm">
            Assistant Settings & Quota
          </Link>
        }
      />

      <AiStudioClient products={products} />
    </>
  );
}
