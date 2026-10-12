import type { Metadata } from "next";
import Link from "next/link";
import { DASHBOARD_RANGES, can, changePercent, getDashboard, type SetupStep } from "@biztrackbd/core";
import { PlusIcon } from "@/components/icons";
import { friendlyDate, taka } from "@/lib/format";
import { demoTick } from "@/lib/demo";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { OrderPill, PaymentPill } from "@/lib/status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Home" };

const SETUP: Record<SetupStep["key"], { label: string; href: string }> = {
  products: { label: "Add your first products", href: "/products/new" },
  details: { label: "Set your store name and phone", href: "/settings/store" },
  payments: { label: "Choose how customers pay", href: "/settings/payments" },
  delivery: { label: "Set delivery charges", href: "/settings/shipping" },
  courier: { label: "Connect Pathao or Steadfast", href: "/settings/integrations" },
  publish: { label: "Publish your store", href: "/settings/store" },
};

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false }).format(now));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders");
  await demoTick(s);
  const now = new Date();
  const range = Number(one(sp.range)) || 7;
  const d = await getDashboard(s.tenantId, s.actor, now, { range });
  const showMoney = can(s.user.role, "reports");
  const salesChange = changePercent(d.today.sales, d.yesterday.sales);
  const chg = changePercent(d.series.total, d.series.previousTotal);
  const ser = d.series;
  const max = Math.max(1, ...ser.days.map((x) => Math.max(x.sales, x.previousSales)));
  const W = 700, H = 200, bw = W / ser.days.length;
  const y = (v: number) => H - Math.max(2, (v / max) * (H - 8));
  const prevLine = ser.days.map((x, i) => `${(i * bw + bw / 2).toFixed(1)},${(x.previousSales > 0 ? y(x.previousSales) : H).toFixed(1)}`).join(" ");
  const shortDate = (date: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const tips: { text: string; href: string; cta: string }[] = [];
  if (d.setup.steps.some((st) => st.key === "courier" && !st.done)) tips.push({ text: "Connect a courier and book parcels from the orders list in one tap.", href: "/settings/integrations", cta: "Connect" });
  if (d.lowStock.length + d.outOfStock.count > 0) tips.push({ text: "Products that run out lose sales. Restock the ones below their reorder level.", href: "/inventory?filter=low", cta: "Open inventory" });
  tips.push({ text: "Share your store link in your Facebook page and WhatsApp status. Most first orders come from there.", href: "/settings/store", cta: "See your link" });
  const dayName = (date: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <>
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <h1 style={{ flex: "none" }}>{greeting(now)}, {s.user.name.split(" ")[0]}</h1>
          <p className="muted" style={{ marginTop: 2 }}>{today}{d.toPack.count > 0 ? ` · ${d.toPack.count} ${d.toPack.count === 1 ? "order needs" : "orders need"} packing` : ""}</p>
        </div>
        <div className="actions">
          {can(s.user.role, "products", "edit") && <Link href="/products/new" className="btn btn-secondary" prefetch={false}><PlusIcon width={18} height={18} /> Add product</Link>}
          {can(s.user.role, "orders", "edit") && <Link href="/orders/new" className="btn btn-primary" prefetch={false}>New order</Link>}
        </div>
      </div>

      <div className="grid grid-4" data-testid="dash-stats">
        <div className="stat"><div className="k">New orders</div><div className="v num">{d.newOrders.count}</div><div className={`d ${d.newOrders.count >= d.newOrders.previous ? "up" : "down"}`}>{d.newOrders.count - d.newOrders.previous >= 0 ? "+" : ""}{d.newOrders.count - d.newOrders.previous} vs the 24 hours before</div></div>
        <div className="stat"><div className="k">To pack and ship</div><div className="v num">{d.toPack.count}</div><div className="d">{d.toPack.waitingOver24h > 0 ? `${d.toPack.waitingOver24h} waiting over 24 hours` : "None waiting long"}</div></div>
        {showMoney ? (
          <div className="stat"><div className="k">Sales today</div><div className="v num">{taka(d.today.sales)}</div><div className={`d ${salesChange == null ? "" : salesChange >= 0 ? "up" : "down"}`}>{salesChange == null ? `${d.today.orders} orders` : `${salesChange >= 0 ? "+" : ""}${salesChange}% vs yesterday`}</div></div>
        ) : (
          <div className="stat"><div className="k">Orders today</div><div className="v num">{d.today.orders}</div><div className="d">{d.yesterday.orders} yesterday</div></div>
        )}
        <div className="stat"><div className="k">Awaiting payment check</div><div className="v num">{d.awaitingCheck.count}</div><div className="d">Verify bKash and Nagad</div></div>
      </div>

      {(d.awaitingCheck.count > 0 || d.toPack.count > 0 || d.outOfStock.count > 0) && (
        <section className="stack" style={{ marginTop: 16 }} aria-label="Needs your attention">
          <h2 style={{ fontSize: 16 }}>Needs your attention</h2>
          {d.awaitingCheck.count > 0 && (
            <Link href="/orders/check" className="attention" prefetch={false}>
              <span className="n" style={{ color: "var(--warning)" }}>{d.awaitingCheck.count}</span>
              <span className="t"><b>bKash and Nagad payments to check</b><span className="muted">{d.awaitingCheck.oldestHours != null ? `Oldest waiting ${d.awaitingCheck.oldestHours === 0 ? "less than an hour" : `${d.awaitingCheck.oldestHours} hours`}` : ""}</span></span>
              <span className="link">Check</span>
            </Link>
          )}
          {d.toPack.count > 0 && (
            <Link href="/orders/ship" className="attention" prefetch={false}>
              <span className="n">{d.toPack.count}</span>
              <span className="t"><b>Orders to pack and ship</b><span className="muted">{d.toPack.waitingOver24h > 0 ? `${d.toPack.waitingOver24h} are over 24 hours old` : "All fresh"}</span></span>
              <span className="link">Open</span>
            </Link>
          )}
          {d.outOfStock.count > 0 && (
            <Link href="/inventory?filter=out" className="attention" prefetch={false}>
              <span className="n" style={{ color: "var(--danger)" }}>{d.outOfStock.count}</span>
              <span className="t"><b>{d.outOfStock.count === 1 ? "Product" : "Products"} out of stock</b><span className="muted">{d.outOfStock.examples.join(", ")}</span></span>
              <span className="link">Restock</span>
            </Link>
          )}
        </section>
      )}

      <div className="split" style={{ marginTop: 16 }}>
        <div className="col stack">
          {showMoney && (
            <section className="card" data-testid="sales-chart">
              <div className="card-head">
                <h2>Sales, last {ser.range} days</h2>
                <div className="view-toggle" role="group" aria-label="Date range">
                  {DASHBOARD_RANGES.map((r) => <Link key={r} href={r === 7 ? "/" : `/?range=${r}`} className="chip" aria-current={ser.range === r ? "true" : undefined} prefetch={false} data-testid={`range-${r}`}>{r} days</Link>)}
                </div>
              </div>
              <div className="num" style={{ fontSize: 24, fontWeight: 800 }} data-testid="sales-total">{taka(ser.total)}</div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{ser.orders} {ser.orders === 1 ? "order" : "orders"} · {chg == null ? "No earlier period to compare" : `${chg >= 0 ? "+" : ""}${chg}% vs the previous ${ser.range} days (${taka(ser.previousTotal)})`}</div>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="200" preserveAspectRatio="none" role="img" aria-label={`Sales per day for the last ${ser.range} days, with the previous ${ser.range} days as a dashed line. Total ${taka(ser.total)}, before ${taka(ser.previousTotal)}.`}>
                <path d={`M0 ${H - 0.5}H${W}`} stroke="var(--line)" />
                {ser.days.map((x, i) => <rect key={x.date} x={i * bw + bw * 0.15} width={bw * 0.7} y={y(x.sales)} height={H - y(x.sales)} rx={2} fill="var(--brand)" opacity={i === ser.days.length - 1 ? 1 : 0.6}><title>{`${shortDate(x.date)}: ${taka(x.sales)}`}</title></rect>)}
                <polyline points={prevLine} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="row" style={{ justifyContent: "space-between", fontSize: 12.5, marginTop: 6 }} aria-hidden="true">
                <span className="muted">{shortDate(ser.days[0]!.date)}</span>
                <span className="muted"><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--brand)", borderRadius: 2, marginRight: 4 }} />This period <span style={{ display: "inline-block", width: 16, borderTop: "2px dashed var(--ink-3)", margin: "0 4px 3px 10px" }} />Before</span>
                <span className="muted">{shortDate(ser.days.at(-1)!.date)}</span>
              </div>
              <Link href="/reports" className="link" prefetch={false} style={{ display: "inline-flex", alignItems: "center", minHeight: 40 }}>Open report</Link>
            </section>
          )}

          <section>
            <div className="card-head"><h2 style={{ fontSize: 16 }}>Recent orders</h2><Link href="/orders" className="link" prefetch={false}>View all orders</Link></div>
            {d.recent.length === 0 ? (
              <div className="card empty">No orders yet. When a customer orders, it shows up here.</div>
            ) : (
              <>
                <div className="only-mobile">
                  {d.recent.map((o) => (
                    <Link key={o.id} href={`/orders/${o.id}`} className="list-card" prefetch={false}>
                      <div className="top"><b>{o.customerName}</b><span className="num">{taka(o.totalAmount)}</span></div>
                      <div className="muted" style={{ fontSize: 13 }}>{o.orderNumber} · {o.area}</div>
                      <div className="row" style={{ marginTop: 8 }}><PaymentPill method={o.paymentMethod} status={o.paymentStatus} /><OrderPill status={o.status} /></div>
                    </Link>
                  ))}
                </div>
                <table className="table only-desktop">
                  <thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Fulfilment</th><th className="r">Total</th></tr></thead>
                  <tbody>
                    {d.recent.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/orders/${o.id}`} className="link" prefetch={false}>{o.orderNumber}</Link></td>
                        <td>{o.customerName}<div className="muted" style={{ fontSize: 12.5 }}>{o.area}, {o.district}</div></td>
                        <td><PaymentPill method={o.paymentMethod} status={o.paymentStatus} /></td>
                        <td><OrderPill status={o.status} /></td>
                        <td className="r num">{taka(o.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </div>

        <div className="col stack">
          {d.setup.done < d.setup.steps.length && (
            <section className="card" data-testid="setup-card">
              <div className="card-head"><h2>Finish setting up</h2><span className="muted">{d.setup.done} of {d.setup.steps.length}</span></div>
              <div className="meter" aria-hidden="true"><i style={{ width: `${(d.setup.done / d.setup.steps.length) * 100}%` }} /></div>
              <div style={{ marginTop: 8 }}>
                {d.setup.steps.map((st) => (
                  <div key={st.key} className={`setup-step${st.done ? " done" : ""}`}>
                    <span className="dot" aria-hidden="true">{st.done ? "✓" : ""}</span>
                    {st.done ? <span>{SETUP[st.key].label}</span> : <Link href={SETUP[st.key].href} className="link" prefetch={false}>{SETUP[st.key].label}</Link>}
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="card" data-testid="tips-card">
            <div className="card-head"><h2>Tips</h2></div>
            {tips.slice(0, 3).map((t) => (
              <div key={t.text} style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <p style={{ margin: "0 0 4px", fontSize: 14 }}>{t.text}</p>
                <Link href={t.href} className="link" prefetch={false} style={{ display: "inline-flex", alignItems: "center", minHeight: 40 }}>{t.cta}</Link>
              </div>
            ))}
          </section>
          {d.lowStock.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>Low stock</h2><Link href="/inventory?filter=low" className="link" prefetch={false}>See all</Link></div>
              {d.lowStock.map((l) => (
                <div key={l.variantId} className="row" style={{ justifyContent: "space-between", padding: "6px 0" }}>
                  <span>{l.productTitle}{l.variantTitle.toLowerCase() !== "default" ? <span className="muted"> · {l.variantTitle}</span> : null}</span>
                  <span className="pill warn">{l.stock} left</span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 20, fontSize: 12.5 }}>Updated {friendlyDate(now, now)}</p>
    </>
  );
}
