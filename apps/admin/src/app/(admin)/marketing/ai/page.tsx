import type { Metadata } from "next";
import Link from "next/link";
import { withTenant } from "@biztrackbd/db";
import { requireAccess } from "@/lib/session";
import { AiStudioClient } from "./ai-studio-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI Copywriter Studio" };

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
      <div className="page-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Link href="/marketing" className="link muted" style={{ fontSize: 13 }}>
              ← Marketing Command Center
            </Link>
          </div>
          <h1 style={{ margin: 0 }}>✨ AI Marketing Copywriter Studio</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            Craft high-converting Facebook/Instagram ad posts, single-part SMS campaigns, and banner slogans with Google Gemini.
          </p>
        </div>
        <div className="actions">
          <Link href="/settings/ai" className="btn btn-secondary btn-sm">
            ⚙️ AI Settings &amp; Quota
          </Link>
        </div>
      </div>

      <AiStudioClient products={products} />
    </>
  );
}
