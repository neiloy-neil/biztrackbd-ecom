import { demoTick } from "@/lib/demo";
import type { Metadata } from "next";
import Link from "next/link";
import { BD_GEO, addDays, can, listConnectedCouriers, listOrders, orderTabCounts, type OrderTab } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { BulkBar } from "@/components/bulk";
import { ChipFilter, LiveSearch, SelectFilter } from "@/components/live-filters";
import { QuickViewButton, QuickViewHost } from "@/components/quick-view";
import { Pager, SubmitButton, Tabs } from "@/components/ui";
import { friendlyDate, prettyPhone, taka } from "@/lib/format";
import { one, pageOf, qs } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { CHANNEL, OrderPill, PaymentPill } from "@/lib/status";
import { bulkBookAction, bulkPackAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders" };

const TABS: { key: OrderTab; label: string; alert?: boolean }[] = [
  { key: "all", label: "All" }, { key: "new", label: "New" }, { key: "check", label: "Check payment", alert: true }, { key: "to_pack", label: "To pack" },
  { key: "shipped", label: "Shipped" }, { key: "delivered", label: "Delivered" }, { key: "returns", label: "Returns" }, { key: "cancelled", label: "Cancelled" },
];
const RANGES = [["today", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"]] as const;
const PAYMENTS = [{ value: "COD", label: "Cash on delivery" }, { value: "MANUAL_BKASH", label: "bKash" }, { value: "MANUAL_NAGAD", label: "Nagad" }];
const DISTRICTS = BD_GEO.flatMap((d) => d.districts.map((x) => x.name)).sort();

export default async function Orders({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders");
  await demoTick(s);
  const tab = (TABS.find((t) => t.key === one(sp.tab))?.key ?? "all") as OrderTab;
  const q = one(sp.q)?.trim() ?? "";
  const payment = (["COD", "MANUAL_BKASH", "MANUAL_NAGAD"] as const).find((p) => p === one(sp.payment));
  const range = RANGES.find((r) => r[0] === one(sp.range))?.[0] ?? "";
  const district = DISTRICTS.find((d) => d === one(sp.district)) ?? "";
  const courierWanted = one(sp.courier) ?? "";
  const page = pageOf(one(sp.page));
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  const from = range === "today" ? new Date(`${todayIso}T00:00:00+06:00`) : range ? new Date(`${addDays(todayIso, -(Number(range) - 1))}T00:00:00+06:00`) : undefined;

  const [counts, couriers] = await Promise.all([orderTabCounts(s.tenantId, s.actor), listConnectedCouriers(s.tenantId)]);
  const courier = couriers.find((c) => c.provider === courierWanted)?.provider ?? "";
  const list = await listOrders(s.tenantId, s.actor, { tab, q: q || undefined, payment, district: district || undefined, courier: courier || undefined, from, page, pageSize: 25 });
  const canEdit = can(s.user.role, "orders", "edit");
  const base = { tab, q, payment, range, district, courier };
  const here = `/orders${qs({ ...base, page })}`;
  const msg = one(sp.msg);
  const packedMsg = msg?.startsWith("packed-") ? msg.split("-").map(Number) : null;
  const bookedMsg = msg?.startsWith("booked-") ? msg.split("-").map(Number) : null;
  const why = one(sp.why);
  const filtered = Boolean(q || payment || range || district || courier);

  return (
    <>
      <PageHeader title="Orders" actions={canEdit ? <Link href="/orders/new" className="btn btn-primary" prefetch={false}>Create order</Link> : undefined} />

      {packedMsg && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{packedMsg[1]} marked as packed{packedMsg[2] ? `. ${packedMsg[2]} could not be packed (they must be confirmed first).` : "."}</div>}
      {bookedMsg && <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="booked-msg">{bookedMsg[1]} booked with the courier{bookedMsg[2] ? `. ${bookedMsg[2]} could not be booked${why ? `: ${why}` : ""}.` : "."}</div>}
      {msg === "none" && <div className="notice" role="status" style={{ marginBottom: 12 }}>Select at least one order first.</div>}

      <Tabs tabs={TABS.map((t) => ({ href: `/orders${qs({ ...base, tab: t.key === "all" ? undefined : t.key })}`, label: t.label, count: counts[t.key], alert: t.alert, current: t.key === tab }))} />

      {/* Filters apply as you type or choose. The form and its Search button are what a browser without scripts uses. */}
      <form className="toolbar" method="get" role="search">
        {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
        <LiveSearch name="q" label="Search orders" placeholder="Order number, name or phone" defaultValue={q} />
        <ChipFilter name="payment" label="Payment" value={payment ?? ""} options={PAYMENTS} />
        {couriers.length > 0 && <ChipFilter name="courier" label="Courier" value={courier} options={couriers.map((c) => ({ value: c.provider, label: c.provider.charAt(0) + c.provider.slice(1).toLowerCase() }))} />}
        <ChipFilter name="range" label="Date" value={range} options={RANGES.map(([value, label]) => ({ value, label }))} />
        <SelectFilter name="district" label="District" value={district} options={[{ value: "", label: "District: all" }, ...DISTRICTS.map((d) => ({ value: d, label: d }))]} />
        <button className="sr-only" type="submit">Search</button>
      </form>

      {list.rows.length === 0 ? (
        <div className="card empty" data-testid="orders-empty">{filtered ? "No orders match. Try clearing the filters." : tab === "check" ? "No payments waiting for you. Nice." : "Nothing here yet."}</div>
      ) : (
        <QuickViewHost>
          <form>
            <input type="hidden" name="back" value={here} />
            {canEdit && (
              <BulkBar noun="order">
                <SubmitButton formAction={bulkPackAction} className="btn btn-secondary btn-sm" pending="Packing…">Mark selected as packed</SubmitButton>
                {couriers.length > 0 && (
                  <>
                    <label><span className="sr-only">Courier</span><select className="select input-sm" name="provider" defaultValue={couriers[0]!.provider} data-testid="bulk-courier">{couriers.map((c) => <option key={c.provider} value={c.provider}>{c.provider.charAt(0) + c.provider.slice(1).toLowerCase()}</option>)}</select></label>
                    <SubmitButton formAction={bulkBookAction} className="btn btn-primary btn-sm" pending="Booking…" data-testid="bulk-book">Book courier for selected</SubmitButton>
                  </>
                )}
                <button className="btn btn-secondary btn-sm" type="submit" formAction="/orders/print" formMethod="get" formTarget="_blank" name="doc" value="slip">Print packing slips</button>
                <button className="btn btn-secondary btn-sm" type="submit" formAction="/orders/print" formMethod="get" formTarget="_blank" name="doc" value="invoice">Print invoices</button>
              </BulkBar>
            )}

            <div className="only-mobile">
              {list.rows.map((o) => (
                <div key={o.id} className="list-card" data-testid="order-row">
                  <div className="top">
                    {canEdit && <input type="checkbox" name="ids" value={o.id} aria-label={`Select ${o.orderNumber}`} style={{ width: 20, height: 20 }} />}
                    <Link href={`/orders/${o.id}`} prefetch={false} style={{ flex: 1, display: "flex", alignItems: "center", minHeight: 40, gap: 8 }}><b>{o.orderNumber}</b> <span className="muted" style={{ fontSize: 12.5 }}>{friendlyDate(o.createdAt)}</span></Link>
                    <span className="num">{taka(o.totalAmount)}</span>
                  </div>
                  <Link href={`/orders/${o.id}`} prefetch={false}>
                    <div style={{ marginTop: 4 }}>{o.customerName}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{o.area}, {o.district} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}</div>
                    <div className="row" style={{ marginTop: 8 }}><PaymentPill method={o.paymentMethod} status={o.paymentStatus} /><OrderPill status={o.status} /></div>
                  </Link>
                  <div className="row" style={{ marginTop: 10, gap: 8 }}>
                    {o.paymentStatus === "PENDING_VERIFICATION" && canEdit && <Link href={`/orders/${o.id}`} className="btn btn-primary btn-sm" style={{ flex: 1 }} prefetch={false}>Verify payment</Link>}
                    <QuickViewButton id={o.id} label={o.orderNumber} />
                  </div>
                </div>
              ))}
            </div>

            <table className="table only-desktop" data-testid="orders-table">
              <thead><tr>{canEdit && <th style={{ width: 36 }}><span className="sr-only">Select</span></th>}<th>Order</th><th>Date</th><th>Customer</th><th>Payment</th><th>Fulfilment</th><th>Source</th><th className="r">Total</th></tr></thead>
              <tbody>
                {list.rows.map((o) => (
                  <tr key={o.id} data-testid="order-row">
                    {canEdit && <td><input type="checkbox" name="ids" value={o.id} aria-label={`Select ${o.orderNumber}`} style={{ width: 18, height: 18 }} /></td>}
                    <td><Link href={`/orders/${o.id}`} className="link" prefetch={false}>{o.orderNumber}</Link>{o.priority && <span className="pill info" style={{ marginLeft: 6 }} data-testid="priority">Priority</span>}<div><QuickViewButton id={o.id} label={o.orderNumber} /></div></td>
                    <td className="muted">{friendlyDate(o.createdAt)}</td>
                    <td>{o.customerName}<div className="muted" style={{ fontSize: 12.5 }}>{o.area}, {o.district} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"} · {prettyPhone(o.customerPhone)}</div></td>
                    <td><PaymentPill method={o.paymentMethod} status={o.paymentStatus} /></td>
                    <td><OrderPill status={o.status} /></td>
                    <td className="muted">{CHANNEL[o.channel] ?? o.channel}</td>
                    <td className="r num">{taka(o.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={list.page} pageSize={list.pageSize} total={list.total} path="/orders" params={base} />
          </form>
        </QuickViewHost>
      )}
    </>
  );
}
