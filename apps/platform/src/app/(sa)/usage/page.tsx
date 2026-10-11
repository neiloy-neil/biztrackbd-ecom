import type { Metadata } from "next";
import Link from "next/link";
import { getPlatformPrisma } from "@biztrackbd/db";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Usage and limits" };

export default async function UsagePage() {
  await requireAccess("tenants");
  const db = getPlatformPrisma();

  // Load active non-demo stores with their current counts against limits
  const tenants = await db.tenant.findMany({
    where: { isDemo: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      subdomain: true,
      planTier: true,
      status: true,
      products: { select: { id: true } },
      orders: { select: { id: true } },
      users: { select: { id: true } },
    },
    take: 50,
  });

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Usage and limits</h1>
      </div>
      <p className="page-sub">Monitor tenant resource utilization against their subscribed plan limits.</p>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>
          Store resource usage
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.8fr) 100px 110px 110px 110px 90px",
            padding: "10px 24px",
            background: "var(--bg)",
            borderBottom: "1px solid var(--line)",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--ink-3)",
            letterSpacing: "0.3px",
          }}
        >
          <div>STORE</div>
          <div>PLAN</div>
          <div style={{ textAlign: "right" }}>PRODUCTS</div>
          <div style={{ textAlign: "right" }}>ORDERS</div>
          <div style={{ textAlign: "right" }}>STAFF</div>
          <div></div>
        </div>
        {tenants.map((t) => (
          <div
            key={t.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.8fr) 100px 110px 110px 110px 90px",
              padding: "0 24px",
              height: 56,
              alignItems: "center",
              borderBottom: "1px solid var(--line)",
              fontSize: 13.5,
            }}
          >
            <div>
              <Link href={`/tenants/${t.id}`} style={{ fontWeight: 700, color: "var(--ink)" }}>
                {t.name}
              </Link>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{t.subdomain}</div>
            </div>
            <div>
              <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11.5, fontWeight: 600, background: "var(--tint)", color: "var(--brand)" }}>
                {t.planTier}
              </span>
            </div>
            <div className="num" style={{ textAlign: "right" }}>{t.products.length}</div>
            <div className="num" style={{ textAlign: "right" }}>{t.orders.length}</div>
            <div className="num" style={{ textAlign: "right" }}>{t.users.length}</div>
            <div style={{ textAlign: "right" }}>
              <Link href={`/tenants/${t.id}?tab=usage`} style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>
                Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
