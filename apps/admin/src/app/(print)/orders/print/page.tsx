import type { Metadata } from "next";
import Link from "next/link";
import { getOrderDetail, getPrintSettings, type OrderDetail, type StoreSettingsView } from "@biztrackbd/core";
import { dateOnly, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { methodName } from "@/lib/status";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Print" };

type Doc = "invoice" | "slip" | "label";
type Size = "a4" | "a5" | "thermal";
const DOCS: [Doc, string][] = [["invoice", "Invoice"], ["slip", "Packing slip"], ["label", "Courier label"]];
const SIZES: [Size, string][] = [["a4", "A4"], ["a5", "A5"], ["thermal", "Thermal 80mm"]];

const PAGE_CSS: Record<Size, string> = {
  a4: "@page { size: A4; margin: 14mm; } .doc { width: 100%; font-size: 13px; }",
  a5: "@page { size: A5; margin: 10mm; } .doc { width: 100%; font-size: 11.5px; }",
  thermal: "@page { size: 80mm auto; margin: 3mm; } .doc { width: 74mm; font-size: 11px; }",
};

const css = (size: Size) => `
${PAGE_CSS[size]}
body { background: #fff; }
.toolbar-print { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--bg); position: sticky; top: 0; }
.toolbar-print .group { display: flex; gap: 4px; }
.toolbar-print a { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line-2); font-weight: 600; font-size: 13px; background: #fff; }
.toolbar-print a[aria-current="true"] { background: var(--brand); border-color: var(--brand); color: #fff; }
.sheet { max-width: ${size === "a4" ? "210mm" : size === "a5" ? "148mm" : "80mm"}; margin: 16px auto; padding: ${size === "thermal" ? "4mm" : "12mm"}; background: #fff; border: 1px solid var(--line); border-radius: 6px; page-break-after: always; break-after: page; color: #111; font-family: var(--font); }
.sheet:last-child { page-break-after: auto; break-after: auto; }
.doc h1 { font-size: 1.5em; margin: 0; letter-spacing: 0.5px; }
.doc h2 { font-size: 1em; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
.doc .head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
.doc .biz b { font-size: 1.2em; }
.doc .cols { display: grid; grid-template-columns: ${size === "thermal" ? "1fr" : "1fr 1fr 1fr"}; gap: 10px; margin: 12px 0; }
.doc table { width: 100%; border-collapse: collapse; margin: 10px 0; }
.doc th { text-align: left; font-size: 0.85em; color: #555; border-bottom: 1.5px solid #111; padding: 4px 4px; }
.doc td { padding: 5px 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
.doc .r { text-align: right; }
.doc .tot { margin-left: auto; width: ${size === "thermal" ? "100%" : "55%"}; }
.doc .tot div { display: flex; justify-content: space-between; padding: 2px 0; }
.doc .tot .g { font-weight: 800; font-size: 1.15em; border-top: 1.5px solid #111; margin-top: 4px; padding-top: 4px; }
.doc .box { border: 2px solid #111; padding: 8px; margin: 10px 0; text-align: center; font-weight: 800; font-size: 1.4em; }
.doc .sq { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #111; margin-right: 6px; vertical-align: -2px; }
.doc .foot { margin-top: 14px; color: #555; font-size: 0.9em; }
.doc .big { font-size: 1.35em; font-weight: 800; line-height: 1.3; }
.doc .logo { max-height: 44px; max-width: 160px; }
@media print {
  .toolbar-print { display: none; }
  .sheet { margin: 0; border: 0; border-radius: 0; padding: 0; max-width: none; }
  body { background: #fff; }
}
`;

function Biz({ st }: { st: StoreSettingsView }) {
  return (
    <div className="biz">
      {st.invoiceOptions.showLogo && st.logoUrl ? /* eslint-disable-line @next/next/no-img-element */ <img className="logo" src={st.logoUrl} alt="" /> : <b>{st.storeName}</b>}
      {st.pickupAddress || st.addressLine ? <div>{st.pickupAddress ?? st.addressLine}</div> : null}
      {st.contactPhone && <div>{prettyPhone(st.contactPhone)}{st.email ? ` · ${st.email}` : ""}</div>}
    </div>
  );
}

const payLine = (o: OrderDetail) =>
  o.paymentMethod === "COD" ? "Cash on delivery" : `${methodName(o.paymentMethod)}${o.mfs.trxId ? `, TrxID ${o.mfs.trxId}` : ""}${o.paymentStatus === "PAID" ? " (paid)" : o.paymentStatus === "PENDING_VERIFICATION" ? " (to be verified)" : ""}`;
const toCollect = (o: OrderDetail) => (o.paymentMethod === "COD" && o.paymentStatus !== "PAID" ? o.totals.total : 0);

function Invoice({ o, st }: { o: OrderDetail; st: StoreSettingsView }) {
  return (
    <div className="doc">
      <div className="head"><Biz st={st} /><div style={{ textAlign: "right" }}><h1>INVOICE</h1><div><b>{o.orderNumber}</b></div><div>{dateOnly(o.createdAt)}</div></div></div>
      <div className="cols">
        <div><h2>Bill to</h2><div>{o.customerName}</div><div>{prettyPhone(o.customerPhone)}</div></div>
        <div><h2>Ship to</h2><div>{o.address.line}</div><div>{o.address.area}, {o.address.district}</div></div>
        <div><h2>Payment</h2><div>{payLine(o)}</div></div>
      </div>
      <table>
        <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Total</th></tr></thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id}>
              <td>{i.title}{i.variantTitle && i.variantTitle.toLowerCase() !== "default" ? ` · ${i.variantTitle}` : ""}{st.invoiceOptions.showSku && i.sku ? <div style={{ color: "#666", fontSize: "0.85em" }}>{i.sku}</div> : null}</td>
              <td className="r">{i.quantity}</td><td className="r">{taka(i.unitPrice)}</td><td className="r">{taka(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tot">
        <div><span>Subtotal</span><span>{taka(o.totals.subtotal)}</span></div>
        <div><span>Delivery</span><span>{taka(o.totals.delivery)}</span></div>
        {o.totals.codFee > 0 && <div><span>Cash on delivery fee</span><span>{taka(o.totals.codFee)}</span></div>}
        {o.totals.discount > 0 && <div><span>Coupon {o.totals.couponCode}</span><span>− {taka(o.totals.discount)}</span></div>}
        {o.totals.tierDiscount + o.totals.referralDiscount + o.totals.pointsDiscount > 0 && <div><span>Member discounts</span><span>− {taka(o.totals.tierDiscount + o.totals.referralDiscount + o.totals.pointsDiscount)}</span></div>}
        <div className="g"><span>Total</span><span>{taka(o.totals.total)}</span></div>
      </div>
      {st.invoiceFooter && <div className="foot">{st.invoiceFooter}</div>}
    </div>
  );
}

function Slip({ o, st }: { o: OrderDetail; st: StoreSettingsView }) {
  const collect = toCollect(o);
  return (
    <div className="doc">
      <div className="head"><div><h1>PACKING SLIP</h1><div><b>{o.orderNumber}</b> · {dateOnly(o.createdAt)}</div></div><div style={{ textAlign: "right" }} className="biz"><b>{st.storeName}</b></div></div>
      <div className="cols" style={{ gridTemplateColumns: "1fr" }}>
        <div><h2>Deliver to</h2><div className="big">{o.customerName}</div><div>{o.address.line}</div><div>{o.address.area}, {o.address.district}</div><div><b>{prettyPhone(o.customerPhone)}</b></div></div>
      </div>
      {collect > 0 && <div className="box">COLLECT {taka(collect)}</div>}
      <table>
        <thead><tr><th>Pack</th><th>Item</th><th className="r">Qty</th>{st.invoiceOptions.showPricesOnSlip && <th className="r">Price</th>}</tr></thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id}>
              <td><span className="sq" /></td>
              <td>{i.title}{i.variantTitle && i.variantTitle.toLowerCase() !== "default" ? ` · ${i.variantTitle}` : ""}{i.sku ? <div style={{ color: "#666", fontSize: "0.85em" }}>{i.sku}</div> : null}</td>
              <td className="r"><b>{i.quantity}</b></td>
              {st.invoiceOptions.showPricesOnSlip && <td className="r">{taka(i.total)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {o.callNote && <div><h2>Call note</h2><div><b>{o.callNote}</b></div></div>}
      {o.notes && <div><h2>Customer note</h2><div>{o.notes}</div></div>}
      {o.tags.length > 0 && <div style={{ marginTop: 6 }}>Labels: {o.tags.join(", ")}</div>}
    </div>
  );
}

function Label({ o, st }: { o: OrderDetail; st: StoreSettingsView }) {
  const collect = toCollect(o);
  return (
    <div className="doc">
      <div className="box" style={{ fontSize: "1.2em" }}>{o.orderNumber}</div>
      <h2>To</h2>
      <div className="big">{o.customerName}</div>
      <div className="big" style={{ fontSize: "1.15em" }}>{prettyPhone(o.customerPhone)}</div>
      <div style={{ margin: "6px 0" }}>{o.address.line}<br />{o.address.area}, {o.address.district}</div>
      {collect > 0 ? <div className="box">COD {taka(collect)}</div> : <div className="box">PREPAID</div>}
      <h2>From</h2>
      <div>{st.storeName}{st.contactPhone ? ` · ${prettyPhone(st.contactPhone)}` : ""}</div>
      {st.pickupAddress && <div>{st.pickupAddress}</div>}
      {o.courier.trackingCode && <div style={{ marginTop: 6 }}>Tracking: <b>{o.courier.trackingCode}</b></div>}
    </div>
  );
}

/** A made-up order for the invoice preview in settings, so a store sees its layout before it has any orders. */
function sampleOrder(): OrderDetail {
  const items = [
    { id: "s1", title: "Cotton Panjabi", variantTitle: "Off-white · M", sku: "PJ-001", unitPrice: 1850, quantity: 1, total: 1850 },
    { id: "s2", title: "Handloom Gamchha", variantTitle: "Default", sku: "GM-014", unitPrice: 450, quantity: 2, total: 900 },
  ];
  return {
    id: "sample", orderNumber: "BT-10482", status: "CONFIRMED", paymentStatus: "UNPAID", paymentMethod: "COD", channel: "STOREFRONT", createdAt: new Date(),
    customerName: "Rina Akter", customerPhone: "01712345678", customerEmail: null,
    address: { line: "House 12, Road 5, Dhanmondi", area: "Dhanmondi", district: "Dhaka", division: "Dhaka", zone: "Dhaka" },
    notes: "Please call before delivery.",
    tags: [],
    callNote: null,
    totals: { subtotal: 2750, delivery: 80, codFee: 0, discount: 0, couponCode: null, tierDiscount: 0, referralDiscount: 0, pointsDiscount: 0, pointsUsed: 0, total: 2830 },
    mfs: { trxId: null, sender: null, verifiedAt: null, verifiedBy: null },
    courier: { provider: null, trackingCode: "SF-884201", consignmentId: null, trackingUrl: null, bookedAt: null, status: null, statusLabel: null, statusAt: null, syncedAt: null, fee: null },
    items: items.map((i) => ({ ...i, productId: i.id, slug: null, imageUrl: null })),
    events: [],
  } as unknown as OrderDetail;
}

const flag = (v: string | undefined, fallback: boolean) => (v === "1" ? true : v === "0" ? false : fallback);

export default async function PrintPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders");
  const raw = sp.ids;
  const ids = [...new Set((Array.isArray(raw) ? raw : [raw ?? ""]).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean))].slice(0, 50);
  const doc = (DOCS.find(([d]) => d === one(sp.doc))?.[0] ?? "invoice") as Doc;
  const saved = await getPrintSettings(s.tenantId, s.actor).catch(() => null);
  const size = (SIZES.find(([z]) => z === one(sp.size))?.[0] ?? (doc === "label" ? "thermal" : saved?.invoiceOptions.paper ?? "a4")) as Size;
  // Preview mode (settings, Invoices): a made-up order, with the options being edited laid over the saved ones. Nothing is saved or marked printed.
  const sample = one(sp.sample) === "1";
  const st = saved && sample
    ? { ...saved, invoiceFooter: sp.footer !== undefined ? one(sp.footer)?.slice(0, 200) || null : saved.invoiceFooter,
        invoiceOptions: { ...saved.invoiceOptions, showLogo: flag(one(sp.showLogo), saved.invoiceOptions.showLogo), showSku: flag(one(sp.showSku), saved.invoiceOptions.showSku), showPricesOnSlip: flag(one(sp.prices), saved.invoiceOptions.showPricesOnSlip) } }
    : saved;
  const orders = sample ? [sampleOrder()] : (await Promise.all(ids.map((id) => getOrderDetail(s.tenantId, s.actor, id).catch(() => null)))).filter((o): o is OrderDetail => o !== null);
  const link = (over: Partial<{ doc: Doc; size: Size }>) => `/orders/print?ids=${ids.join(",")}&doc=${over.doc ?? doc}&size=${over.size ?? size}`;

  return (
    <>
      <style>{css(size)}</style>
      {!sample && <div className="toolbar-print">
        <div className="group" role="group" aria-label="Document">{DOCS.map(([d, l]) => <Link key={d} href={link({ doc: d })} aria-current={d === doc} prefetch={false}>{l}</Link>)}</div>
        <div className="group" role="group" aria-label="Paper size">{SIZES.map(([z, l]) => <Link key={z} href={link({ size: z })} aria-current={z === size} prefetch={false}>{l}</Link>)}</div>
        <span style={{ flex: 1 }} />
        <span className="muted">{orders.length} {orders.length === 1 ? "order" : "orders"}</span>
        {orders.length > 0 && <PrintButton ids={orders.map((o) => o.id)} doc={doc} />}
      </div>}
      {orders.length === 0 || !st ? (
        <div className="empty">Choose at least one order to print.</div>
      ) : (
        orders.map((o) => (
          <div className="sheet" key={o.id} data-testid="print-sheet">
            {doc === "invoice" ? <Invoice o={o} st={st} /> : doc === "slip" ? <Slip o={o} st={st} /> : <Label o={o} st={st} />}
          </div>
        ))
      )}
    </>
  );
}
