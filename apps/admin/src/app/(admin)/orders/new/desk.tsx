"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Quote } from "@biztrackbd/core";
import { BD_GEO } from "@biztrackbd/core/geo";
import { SubmitButton } from "@/components/ui";
import { taka } from "@/lib/format";
import {
  createDeskOrderAction, deskQuoteAction, lookupCustomerAction, parseMessageAction, searchProductsAction,
} from "./actions";

type Found = Awaited<ReturnType<typeof lookupCustomerAction>>;
type Variant = Awaited<ReturnType<typeof searchProductsAction>>[number];
interface Line { variantId: string; label: string; price: number; stock: number; quantity: number }

const SOURCES = [["MESSENGER", "Messenger"], ["WHATSAPP", "WhatsApp"], ["PHONE", "Phone call"], ["INSTAGRAM", "Instagram"]] as const;
const PAY = [["COD", "Cash on delivery"], ["MANUAL_BKASH", "Paid by bKash"], ["MANUAL_NAGAD", "Paid by Nagad"]] as const;

const digits = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("880")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
};
const show = (d: string) => (d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d);
const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export interface Prefill {
  /** The 10 digits after 0, as the phone box holds them. */
  phone: string;
  name: string;
  division: string;
  district: string;
  lines: Line[];
  /** The abandoned checkout this order will close. */
  fromAbandoned: boolean;
}

export function QuickOrderDesk({ prefill }: { prefill?: Prefill }) {
  const [key, setKey] = useState(uuid);
  const [started, setStarted] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [found, setFound] = useState<Found>(null);
  const [name, setName] = useState(prefill?.name ?? "");
  const [division, setDivision] = useState(prefill?.division || "Dhaka");
  const [district, setDistrict] = useState(prefill?.district || "Dhaka");
  const [upazila, setUpazila] = useState("");
  const [address, setAddress] = useState("");
  const [source, setSource] = useState<(typeof SOURCES)[number][0]>(prefill ? "PHONE" : "MESSENGER");
  const [lines, setLines] = useState<Line[]>(prefill?.lines ?? []);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Variant[]>([]);
  const [pay, setPay] = useState<(typeof PAY)[number][0]>("COD");
  const [trx, setTrx] = useState("");
  const [coupon, setCoupon] = useState("");
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; number: string; total: number }[]>([]);
  const seq = useRef(0);

  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const secs = Math.floor((Date.now() - started) / 1000) + 0 * tick;

  const districts = useMemo(() => BD_GEO.find((d) => d.name === division)?.districts ?? [], [division]);
  const upazilas = useMemo(() => districts.find((d) => d.name === district)?.upazilas ?? [], [districts, district]);

  // Known customer: look up as soon as a full number is typed.
  useEffect(() => {
    if (!/^1[3-9]\d{8}$/.test(phone)) { setFound(null); return; }
    let live = true;
    lookupCustomerAction(`0${phone}`).then((c) => { if (live) setFound(c); });
    return () => { live = false; };
  }, [phone]);

  // Product search.
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    let live = true;
    const t = setTimeout(() => searchProductsAction(q).then((r) => { if (live) setResults(r); }), 200);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  // Live totals from the same rules the order uses.
  useEffect(() => {
    if (lines.length === 0) { setQuote(null); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const r = await deskQuoteAction({ items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), district, paymentMethod: pay, couponCode: coupon || undefined });
      if (mine === seq.current && r.ok) setQuote(r.quote);
    }, 150);
    return () => clearTimeout(t);
  }, [lines, district, pay, coupon]);

  async function fillFromMessage() {
    if (!message.trim()) return;
    const p = await parseMessageAction(message);
    if (p.phone) setPhone(digits(p.phone));
    if (p.name) setName(p.name);
    if (p.division && p.district) { setDivision(p.division); setDistrict(p.district); }
    if (p.upazila) setUpazila(p.upazila);
    if (p.addressHint) setAddress(p.addressHint);
    if (p.payment === "MANUAL_BKASH" || p.payment === "MANUAL_NAGAD" || p.payment === "COD") setPay(p.payment);
    const first = p.items[0];
    if (first) {
      if (first.variantId) {
        const r = await searchProductsAction(first.label.split(" (")[0]!);
        const v = r.find((x) => x.variantId === first.variantId);
        if (v) addVariant(v, first.quantity);
      } else {
        setQ(first.label);
      }
    }
  }

  function addVariant(v: Variant, quantity = 1) {
    setLines((cur) => {
      const found = cur.find((l) => l.variantId === v.variantId);
      if (found) return cur.map((l) => (l.variantId === v.variantId ? { ...l, quantity: Math.min(l.quantity + quantity, Math.max(v.stock, 1)) } : l));
      return [...cur, { variantId: v.variantId, label: `${v.productTitle}${v.variantTitle.toLowerCase() === "default" ? "" : ` (${v.variantTitle})`}`, price: v.price, stock: v.stock, quantity: Math.min(quantity, Math.max(v.stock, 1)) }];
    });
    setQ("");
    setResults([]);
  }

  function reset(keepSource = true) {
    setKey(uuid()); setStarted(Date.now()); setMessage(""); setPhone(""); setFound(null); setName(""); setDivision("Dhaka"); setDistrict("Dhaka"); setUpazila("");
    setAddress(""); setLines([]); setQ(""); setPay("COD"); setTrx(""); setCoupon(""); setNote(""); setQuote(null); setError("");
    if (!keepSource) setSource("MESSENGER");
  }

  function problem(): string {
    if (!/^1[3-9]\d{8}$/.test(phone)) return "Enter the customer's mobile number.";
    if (name.trim().length < 2) return "Enter the customer's name.";
    if (!upazila) return "Choose the upazila or thana.";
    if (address.trim().length < 5) return "Enter the house, road and area.";
    if (lines.length === 0) return "Add at least one product.";
    const over = lines.find((l) => l.quantity > l.stock);
    if (over) return `Only ${over.stock} left of ${over.label}.`;
    return "";
  }

  async function create(next: boolean) {
    if (busy) return;
    const p = problem();
    setError(p);
    if (p) return;
    setBusy(true);
    const r = await createDeskOrderAction({
      idempotencyKey: key, source, customer: { name: name.trim(), phone: `0${phone}` }, shipping: { division, district, upazila, address: address.trim() },
      items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), paymentMethod: pay, alreadyPaid: pay !== "COD",
      trxId: pay !== "COD" && trx.trim() ? trx.trim().toUpperCase() : undefined, couponCode: coupon.trim() || undefined, note: note.trim() || undefined,
    });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setDone((d) => [{ id: r.orderId, number: r.orderNumber, total: r.total }, ...d].slice(0, 5));
    if (next) reset(true);
    else window.location.assign(`/orders/${r.orderId}`);
  }

  return (
    <div onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void create(true); } }} data-testid="quick-desk">
      <div className="page-head">
        <h1>Quick order desk</h1>
        <div className="actions"><span className="pill grey num" aria-label="Time on this order">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</span></div>
      </div>
      <p className="page-sub">For orders that arrive on Messenger, WhatsApp, Instagram or the phone. Aim for 15 seconds.</p>

      <div className="split">
        <div className="col stack">
          <section className="card">
            <label className="field" style={{ marginBottom: 8 }}>
              <span className="label">Paste the customer's message <span className="opt">(optional)</span></span>
              <textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tania Akter, 01712345678, মিরপুর ১০, ব্লক সি রোড ৭ বাসা ১৪। Panjabi L, 1 pcs. COD" data-testid="desk-message" />
            </label>
            <div className="row"><button type="button" className="btn btn-secondary" onClick={fillFromMessage} data-testid="desk-fill">Fill the form</button><span className="muted" style={{ fontSize: 13 }}>We suggest the phone, name, place and product. Check each field before you save.</span></div>
          </section>

          <section className="card">
            <h2>Customer</h2>
            <label className="field">
              <span className="label">Mobile number</span>
              <div className="row" style={{ flexWrap: "nowrap", gap: 0 }}>
                <span className="input" style={{ width: "auto", display: "flex", alignItems: "center", borderRight: 0, borderRadius: "10px 0 0 10px", background: "var(--bg)", color: "var(--ink-3)" }}>+880</span>
                <input className="input" style={{ borderRadius: "0 10px 10px 0" }} inputMode="tel" autoComplete="off" placeholder="1712-345678" value={show(phone)} onChange={(e) => setPhone(digits(e.target.value))} data-testid="desk-phone" />
              </div>
            </label>
            {found && (
              <div className={`notice ${found.blocked ? "bad" : "good"}`} style={{ marginBottom: 14 }} data-testid="desk-known">
                {found.blocked ? "This number is on your blocked list. The order will be refused." : `Returning customer. ${found.orders} ${found.orders === 1 ? "order" : "orders"}, ${taka(found.spent)}${found.deliverySuccessPercent != null ? `, ${found.deliverySuccessPercent}% delivered` : ""}.`}
                {found.lastAddress && !found.blocked && (
                  <> <button type="button" className="link" style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }} onClick={() => {
                    const a = found.lastAddress!;
                    if (!name) setName(found.name);
                    setDivision(a.division); setDistrict(a.district); setUpazila(a.area); setAddress(a.line);
                  }}>Use saved address</button></>
                )}
              </div>
            )}
            <label className="field"><span className="label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} data-testid="desk-name" /></label>
            <div className="row-2">
              <label className="field"><span className="label">Division</span>
                <select className="select" value={division} onChange={(e) => { const v = e.target.value; setDivision(v); setDistrict(BD_GEO.find((d) => d.name === v)?.districts[0]?.name ?? ""); setUpazila(""); }}>{BD_GEO.map((d) => <option key={d.name}>{d.name}</option>)}</select>
              </label>
              <label className="field"><span className="label">District</span>
                <select className="select" value={district} onChange={(e) => { setDistrict(e.target.value); setUpazila(""); }} data-testid="desk-district">{districts.map((d) => <option key={d.name}>{d.name}</option>)}</select>
              </label>
            </div>
            <label className="field"><span className="label">Upazila or thana</span>
              <select className="select" value={upazila} onChange={(e) => setUpazila(e.target.value)} data-testid="desk-upazila"><option value="">Choose…</option>{upazilas.map((u) => <option key={u}>{u}</option>)}</select>
            </label>
            <label className="field"><span className="label">House, road and area</span><textarea className="textarea" style={{ minHeight: 64 }} value={address} onChange={(e) => setAddress(e.target.value)} data-testid="desk-address" /></label>
            <div className="field" style={{ marginBottom: 0 }}>
              <span className="label">Where did the order come from?</span>
              <div className="chips" role="group" aria-label="Order source">{SOURCES.map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={source === v} onClick={() => setSource(v)}>{l}</button>)}</div>
            </div>
          </section>
        </div>

        <div className="col stack">
          <section className="card">
            <h2>Products</h2>
            <label className="field"><span className="label">Type a name or SKU</span>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cotton Panjabi" autoComplete="off" data-testid="desk-search" />
            </label>
            {results.length > 0 && (
              <div className="stack" style={{ marginBottom: 12 }} data-testid="desk-results">
                {results.map((v) => (
                  <button key={v.variantId} type="button" className="list-card" style={{ width: "100%", textAlign: "left", cursor: v.stock > 0 ? "pointer" : "not-allowed", opacity: v.stock > 0 ? 1 : 0.5 }} disabled={v.stock <= 0} onClick={() => addVariant(v)}>
                    <div className="top"><b>{v.productTitle}{v.variantTitle.toLowerCase() !== "default" ? ` · ${v.variantTitle}` : ""}</b><span className="num">{taka(v.price)}</span></div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{v.stock > 0 ? `${v.stock} in stock` : "Out of stock"}{v.sku ? ` · ${v.sku}` : ""}</div>
                  </button>
                ))}
              </div>
            )}
            {lines.length === 0 && results.length === 0 && <p className="muted">No products added yet.</p>}
            {lines.map((l) => (
              <div key={l.variantId} className="row" style={{ padding: "8px 0", flexWrap: "nowrap" }} data-testid="desk-line">
                <div style={{ flex: 1, minWidth: 0 }}><b>{l.label}</b><div className="muted num" style={{ fontSize: 13 }}>{taka(l.price)}{l.quantity > l.stock ? ` · only ${l.stock} left` : ""}</div></div>
                <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                  <button type="button" className="btn btn-secondary btn-sm" aria-label="Fewer" onClick={() => setLines((c) => c.flatMap((x) => (x.variantId === l.variantId ? (x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : []) : [x])))}>−</button>
                  <b className="num" style={{ minWidth: 24, textAlign: "center" }}>{l.quantity}</b>
                  <button type="button" className="btn btn-secondary btn-sm" aria-label="More" disabled={l.quantity >= l.stock} onClick={() => setLines((c) => c.map((x) => (x.variantId === l.variantId ? { ...x, quantity: x.quantity + 1 } : x)))}>+</button>
                </div>
              </div>
            ))}
          </section>

          <section className="card">
            <h2>Payment</h2>
            <div className="chips" role="group" aria-label="Payment">{PAY.map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={pay === v} onClick={() => setPay(v)} data-testid={`desk-pay-${v}`}>{l}</button>)}</div>
            {pay !== "COD" && (
              <label className="field" style={{ marginTop: 12 }}><span className="label">TrxID <span className="opt">(optional, if you have it)</span></span><input className="input" value={trx} onChange={(e) => setTrx(e.target.value)} maxLength={20} /></label>
            )}
            <label className="field" style={{ marginTop: 12 }}><span className="label">Coupon <span className="opt">(optional)</span></span><input className="input" style={{ textTransform: "uppercase" }} value={coupon} onChange={(e) => setCoupon(e.target.value)} /></label>
            {quote?.couponError && <div className="err">{quote.couponError}</div>}
            <label className="field"><span className="label">Note <span className="opt">(optional)</span></span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></label>
            <div className="totals" data-testid="desk-totals">
              <div className="r"><span>Subtotal</span><span className="num">{taka(quote?.subtotal ?? 0)}</span></div>
              {quote && quote.discount > 0 && <div className="r"><span>Discount {quote.couponCode}</span><span className="num">− {taka(quote.discount)}</span></div>}
              <div className="r"><span>Delivery{quote?.zone ? `, ${quote.zone.name.toLowerCase()} (auto)` : ""}</span><span className="num">{quote?.deliveryCharge == null ? "—" : taka(quote.deliveryCharge)}</span></div>
              {quote && quote.codFee > 0 && <div className="r"><span>Cash on delivery fee</span><span className="num">{taka(quote.codFee)}</span></div>}
              <div className="r grand"><span>Total{pay === "COD" ? ", cash on delivery" : ", already paid"}</span><span className="num" data-testid="desk-total">{quote?.total == null ? taka(quote?.subtotal ?? 0) : taka(quote.total)}</span></div>
            </div>
            {error && <div className="notice bad" role="alert" style={{ marginTop: 12 }} data-testid="desk-error">{error}</div>}
            <div className="stack" style={{ marginTop: 14 }}>
              <SubmitButton className="btn btn-primary btn-block btn-lg" pending="Creating…" disabled={busy} onClick={(e) => { e.preventDefault(); void create(false); }} data-testid="desk-create">Create order</SubmitButton>
              <button type="button" className="btn btn-secondary btn-block" disabled={busy} onClick={() => void create(true)} data-testid="desk-create-next">Create and start the next one</button>
              <p className="muted" style={{ fontSize: 12.5, textAlign: "center" }}>Press Ctrl and Enter to save and start the next order.</p>
            </div>
          </section>

          {done.length > 0 && (
            <section className="card" data-testid="desk-done">
              <h2>Just created</h2>
              {done.map((d) => <div key={d.id} className="row" style={{ justifyContent: "space-between", padding: "4px 0" }}><Link href={`/orders/${d.id}`} className="link" prefetch={false}>{d.number}</Link><span className="num">{taka(d.total)}</span></div>)}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
