"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Drawer, Skeleton } from "@biztrackbd/ui";

interface Summary {
  id: string; name: string; phone: string; email: string | null; since: string; isVip: boolean; isBlocked: boolean; tags: string[];
  address: { line: string; area: string; district: string } | null;
  stats: { totalSpent: number; orders: number; averageOrder: number; deliverySuccessPercent: number | null };
  orders: { id: string; orderNumber: string; createdAt: string; status: string; totalAmount: number }[];
  canOrder: boolean;
}

const Ctx = createContext<(id: string, label: string) => void>(() => undefined);
const taka = (n: number) => `৳ ${Math.round(n).toLocaleString("en-IN")}`;
const words = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date(iso));

/** Wrap the customers list in this, and any CustomerQuickButton inside opens that customer in a side panel, without leaving the list. */
export function CustomerQuickHost({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const ctl = new AbortController();
    setData(null); setError(null);
    fetch(`/api/shell/customer?id=${encodeURIComponent(target.id)}`, { signal: ctl.signal, cache: "no-store" })
      .then(async (r) => (r.ok ? setData(await r.json()) : setError("This customer could not be loaded.")))
      .catch(() => { if (!ctl.signal.aborted) setError("This customer could not be loaded."); });
    return () => ctl.abort();
  }, [target]);

  return (
    <Ctx.Provider value={(id, label) => setTarget({ id, label })}>
      {children}
      <Drawer open={target !== null} onClose={() => setTarget(null)} title={target ? target.label : ""}>
        {error && <div className="notice bad" role="alert">{error}</div>}
        {!data && !error && <div style={{ display: "grid", gap: 10 }} aria-busy="true"><Skeleton height={20} width="50%" /><Skeleton height={14} /><Skeleton height={14} width="80%" /></div>}
        {data && (
          <div className="stack" style={{ gap: 16 }} data-testid="customer-quick-view">
            <div className="row" style={{ gap: 6 }}>{data.isVip && <span className="pill info">VIP</span>}{data.isBlocked && <span className="pill bad">Blocked</span>}{data.tags.map((t) => <span key={t} className="pill grey">{t}</span>)}</div>
            <section>
              <div className="num" style={{ fontSize: 16 }}>{data.phone}</div>
              {data.email && <div className="muted" style={{ fontSize: 14 }}>{data.email}</div>}
              {data.address && <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{data.address.line}, {data.address.area}, {data.address.district}</div>}
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Customer since {day(data.since)}</div>
            </section>
            <dl className="kv">
              <dt>Total spent</dt><dd className="num">{taka(data.stats.totalSpent)}</dd>
              <dt>Orders</dt><dd className="num">{data.stats.orders}</dd>
              <dt>Average order</dt><dd className="num">{taka(data.stats.averageOrder)}</dd>
              <dt>Delivery success</dt><dd className="num">{data.stats.deliverySuccessPercent == null ? "—" : `${data.stats.deliverySuccessPercent}%`}</dd>
            </dl>
            <section>
              <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>LATEST ORDERS</div>
              {data.orders.length === 0 ? <p className="muted" style={{ margin: 0 }}>No orders yet.</p> : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
                  {data.orders.map((o) => (
                    <li key={o.id}><Link href={`/orders/${o.id}`} prefetch={false} style={{ display: "flex", justifyContent: "space-between", gap: 10, minHeight: 40, alignItems: "center" }}><span><b>{o.orderNumber}</b> <span className="muted" style={{ fontSize: 12.5 }}>{day(o.createdAt)} · {words(o.status)}</span></span><span className="num">{taka(o.totalAmount)}</span></Link></li>
                  ))}
                </ul>
              )}
            </section>
            <div className="row" style={{ gap: 8 }}>
              <a className="btn btn-secondary" href={`tel:${data.phone}`} style={{ flex: 1 }}>Call</a>
              <a className="btn btn-secondary" href={`https://wa.me/88${data.phone}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>WhatsApp</a>
            </div>
            <Link href={`/customers/${data.id}`} className="btn btn-primary btn-block" prefetch={false}>Open the full profile</Link>
          </div>
        )}
      </Drawer>
    </Ctx.Provider>
  );
}

export function CustomerQuickButton({ id, label }: { id: string; label: string }) {
  const open = useContext(Ctx);
  return <button type="button" className="quick-btn" onClick={() => open(id, label)} aria-label={`Quick view ${label}`} title="Quick view" data-testid="customer-quick-btn">Quick view</button>;
}
