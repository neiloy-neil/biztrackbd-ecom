"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Drawer, Skeleton } from "@biztrackbd/ui";

interface Summary {
  id: string; orderNumber: string; status: string; paymentStatus: string; paymentMethod: string; channel: string; createdAt: string;
  customer: { name: string; phone: string; email: string | null };
  address: { line: string; area: string; district: string; division: string };
  notes: string | null;
  items: { title: string; variant: string | null; quantity: number; total: number; imageUrl: string | null }[];
  totals: { subtotal: number; delivery: number; discount: number; total: number };
  trxId: string | null;
  courier: { provider: string | null; trackingCode: string | null; statusLabel: string | null };
}

const Ctx = createContext<(id: string, label: string) => void>(() => undefined);
const taka = (n: number) => `৳ ${Math.round(n).toLocaleString("en-IN")}`;
const words = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Wrap a list in this, and any QuickViewButton inside opens that order in a side panel, without leaving the list. */
export function QuickViewHost({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const ctl = new AbortController();
    setData(null); setError(null);
    fetch(`/api/shell/order?id=${encodeURIComponent(target.id)}`, { signal: ctl.signal, cache: "no-store" })
      .then(async (r) => (r.ok ? setData(await r.json()) : setError("This order could not be loaded.")))
      .catch(() => { if (!ctl.signal.aborted) setError("This order could not be loaded."); });
    return () => ctl.abort();
  }, [target]);

  return (
    <Ctx.Provider value={(id, label) => setTarget({ id, label })}>
      {children}
      <Drawer open={target !== null} onClose={() => setTarget(null)} title={target ? `Order ${target.label}` : ""}>
        {error && <div className="notice bad" role="alert">{error}</div>}
        {!data && !error && <div style={{ display: "grid", gap: 10 }} aria-busy="true"><Skeleton height={20} width="50%" /><Skeleton height={14} /><Skeleton height={14} width="80%" /><Skeleton height={80} /></div>}
        {data && (
          <div className="stack" style={{ gap: 16 }} data-testid="quick-view">
            <div className="row" style={{ gap: 6 }}><span className="pill grey">{words(data.status)}</span><span className="pill info">{words(data.paymentMethod.replace("MANUAL_", ""))}: {words(data.paymentStatus)}</span></div>
            <section>
              <div className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>CUSTOMER</div>
              <div>{data.customer.name}</div>
              <div className="muted" style={{ fontSize: 14 }}>{data.customer.phone}{data.customer.email ? ` · ${data.customer.email}` : ""}</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{data.address.line}, {data.address.area}, {data.address.district}</div>
            </section>
            <section>
              <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>ITEMS</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {data.items.map((i, n) => (
                  <li key={n} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>{i.title}{i.variant && i.variant.toLowerCase() !== "default" ? ` (${i.variant})` : ""} <span className="muted">× {i.quantity}</span></span>
                    <span className="num">{taka(i.total)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="totals">
              <div className="r"><span>Items</span><span className="num">{taka(data.totals.subtotal)}</span></div>
              <div className="r"><span>Delivery</span><span className="num">{taka(data.totals.delivery)}</span></div>
              {data.totals.discount > 0 && <div className="r"><span>Discount</span><span className="num">− {taka(data.totals.discount)}</span></div>}
              <div className="r grand"><span>Total</span><span className="num">{taka(data.totals.total)}</span></div>
            </section>
            {data.trxId && <div className="notice info">Transaction ID: <b>{data.trxId}</b></div>}
            {data.courier.provider && <div className="muted" style={{ fontSize: 14 }}>{words(data.courier.provider)}{data.courier.trackingCode ? ` · ${data.courier.trackingCode}` : ""}{data.courier.statusLabel ? ` · ${data.courier.statusLabel}` : ""}</div>}
            {data.notes && <div className="muted" style={{ fontSize: 14 }}>Note: {data.notes}</div>}
            <Link href={`/orders/${data.id}`} className="btn btn-primary btn-block" prefetch={false}>Open the full order</Link>
          </div>
        )}
      </Drawer>
    </Ctx.Provider>
  );
}

export function QuickViewButton({ id, label }: { id: string; label: string }) {
  const open = useContext(Ctx);
  return <button type="button" className="quick-btn" onClick={() => open(id, label)} aria-label={`Quick view ${label}`} title="Quick view" data-testid="quick-view-btn">Quick view</button>;
}
