import type { Metadata } from "next";
import Link from "next/link";
import { can, listStockAlerts } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { friendlyDate } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { clearAlertsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Back in stock requests" };

export default async function StockAlerts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("products");
  const { rows, sentThisMonth } = await listStockAlerts(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "products", "edit");
  const total = rows.reduce((n, r) => n + r.waiting, 0);
  return (
    <>
      <Link href="/inventory" className="back" prefetch={false}>← Inventory</Link>
      <div className="page-head"><h1>Back in stock requests</h1></div>
      <p className="page-sub">Shoppers who left their number on a sold-out item. When you add stock, each one gets one SMS (it uses one SMS credit). A small restock tells the longest-waiting first, so a few units are not announced to hundreds.</p>
      {one(sp.cleared) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Cleared.</div>}
      {one(sp.err) && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{one(sp.err)}</div>}
      <div className="stats" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="k">People waiting</div><div className="v num" data-testid="alerts-total">{total}</div></div>
        <div className="stat"><div className="k">Told this month</div><div className="v num">{sentThisMonth}</div></div>
      </div>
      {rows.length === 0 ? (
        <div className="card empty" data-testid="alerts-empty">Nobody is waiting for anything.</div>
      ) : (
        <div className="stack" data-testid="alerts-list">
          {rows.map((r) => (
            <div key={r.variantId} className="card" data-testid="alert-row">
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <div style={{ minWidth: 0 }}>
                  <b>{r.productTitle}{r.variantTitle && r.variantTitle.toLowerCase() !== "default" ? ` (${r.variantTitle})` : ""}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{r.waiting} {r.waiting === 1 ? "person" : "people"} waiting since {friendlyDate(r.oldest)} · {r.stock > 0 ? `${r.stock} in stock now (they will be told shortly)` : "sold out"}</div>
                </div>
                {canEdit && <form action={clearAlertsAction.bind(null, r.variantId)}><SubmitButton className="btn btn-secondary btn-sm" pending="…" aria-label={`Clear requests for ${r.productTitle}`}>Clear</SubmitButton></form>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
