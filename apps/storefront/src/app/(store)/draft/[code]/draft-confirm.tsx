"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, type Lang } from "@/lib/i18n-core";
import { placeDraftAction } from "./actions";

type Method = "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD";

const S = {
  en: {
    pay: "How would you like to pay?", cod: "Cash on delivery", codS: "Pay the courier when it arrives", codFee: "Cash on delivery fee", bkash: "bKash", nagad: "Nagad", mfsS: "Send money, then enter the TrxID",
    step: "Send {amount} to {number}, then enter the number you sent from and the TrxID from the SMS.", sender: "The number you sent from", trx: "TrxID", subtotal: "Subtotal", delivery: "Delivery", free: "Free",
    total: "Total", place: "Place my order", placing: "Placing…", short: "Some items are not available any more. Please ask the store to send a new link.", coupon: "Coupon",
    badSender: "Enter the number you sent money from", badTrx: "Enter the TrxID from the SMS (8 to 12 letters and numbers)", codNo: "Cash on delivery is not available for this order.",
  },
  bn: {
    pay: "কীভাবে পেমেন্ট করবেন?", cod: "ক্যাশ অন ডেলিভারি", codS: "পণ্য হাতে পেয়ে কুরিয়ারকে টাকা দিন", codFee: "ক্যাশ অন ডেলিভারি ফি", bkash: "বিকাশ", nagad: "নগদ", mfsS: "টাকা পাঠিয়ে TrxID দিন",
    step: "{number} নম্বরে {amount} পাঠান, তারপর যে নম্বর থেকে পাঠিয়েছেন সেটি এবং SMS-এর TrxID দিন।", sender: "যে নম্বর থেকে পাঠিয়েছেন", trx: "TrxID", subtotal: "সাবটোটাল", delivery: "ডেলিভারি", free: "ফ্রি",
    total: "মোট", place: "আমার অর্ডার করুন", placing: "অর্ডার হচ্ছে…", short: "কিছু পণ্য আর নেই। দোকানকে নতুন লিংক পাঠাতে বলুন।", coupon: "কুপন",
    badSender: "যে নম্বর থেকে পাঠিয়েছেন সেটি লিখুন", badTrx: "SMS থেকে TrxID লিখুন (৮ থেকে ১২টি অক্ষর ও সংখ্যা)", codNo: "এই অর্ডারে ক্যাশ অন ডেলিভারি নেই।",
  },
} as const;

export function DraftConfirm(p: {
  code: string; lang: Lang;
  totals: { subtotal: number; delivery: number; discount: number; couponCode: string | null; codFee: number; total: number };
  cod: { available: boolean; fee: number; reason: string | null }; bkash: { available: boolean; number: string | null }; nagad: { available: boolean; number: string | null };
  problems: number;
}) {
  const s = S[p.lang];
  const router = useRouter();
  const first: Method = p.cod.available ? "COD" : p.bkash.available ? "MANUAL_BKASH" : "MANUAL_NAGAD";
  const [method, setMethod] = useState<Method>(first);
  const [sender, setSender] = useState("");
  const [trx, setTrx] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // The quote was worked out for cash on delivery, so its total includes the fee; paying by mobile money does not carry it.
  const total = p.totals.total - (method === "COD" ? 0 : p.totals.codFee);
  const mfs = method !== "COD";
  const number = method === "MANUAL_BKASH" ? p.bkash.number : p.nagad.number;

  async function place() {
    if (busy) return;
    setError("");
    if (mfs) {
      if (!/^(\+?880|0)?1[3-9]\d{8}$/.test(sender.replace(/[\s-]/g, ""))) { setError(s.badSender); return; }
      if (!/^[A-Za-z0-9]{8,12}$/.test(trx.trim())) { setError(s.badTrx); return; }
    }
    setBusy(true);
    const r = await placeDraftAction(p.code, { paymentMethod: method, mfs: mfs ? { senderNumber: sender.replace(/[\s-]/g, ""), trxId: trx.trim() } : undefined });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    router.push(`/order/${r.orderId}?k=${encodeURIComponent(r.token)}`);
  }

  if (p.problems > 0) return <div className="card" role="alert" data-testid="draft-problem">{s.short}</div>;
  const none = !p.cod.available && !p.bkash.available && !p.nagad.available;

  return (
    <div className="stack">
      <section className="card">
        <h2>{s.pay}</h2>
        {p.cod.available && (
          <label className={`option${method === "COD" ? " selected" : ""}`}>
            <input type="radio" name="pay" checked={method === "COD"} onChange={() => setMethod("COD")} data-testid="draft-pay-cod" />
            <div className="grow"><div className="t">{s.cod}</div><div className="s">{s.codS}</div></div>
          </label>
        )}
        {!p.cod.available && p.cod.reason && <p className="muted" style={{ margin: "0 0 8px" }}>{s.codNo}</p>}
        {p.bkash.available && (
          <label className={`option${method === "MANUAL_BKASH" ? " selected" : ""}`}>
            <input type="radio" name="pay" checked={method === "MANUAL_BKASH"} onChange={() => setMethod("MANUAL_BKASH")} data-testid="draft-pay-bkash" />
            <div className="grow"><div className="t">{s.bkash}</div><div className="s">{s.mfsS}</div></div>
          </label>
        )}
        {p.nagad.available && (
          <label className={`option${method === "MANUAL_NAGAD" ? " selected" : ""}`}>
            <input type="radio" name="pay" checked={method === "MANUAL_NAGAD"} onChange={() => setMethod("MANUAL_NAGAD")} data-testid="draft-pay-nagad" />
            <div className="grow"><div className="t">{s.nagad}</div><div className="s">{s.mfsS}</div></div>
          </label>
        )}
        {mfs && (
          <div className="stack" style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>{s.step.replace("{amount}", money(total, p.lang)).replace("{number}", number ?? "")}</p>
            <label className="field" style={{ marginBottom: 0 }}><span className="label">{s.sender}</span><input id="draft-sender" className="input" inputMode="tel" autoComplete="off" placeholder="01XXXXXXXXX" value={sender} onChange={(e) => setSender(e.target.value)} /></label>
            <label className="field" style={{ marginBottom: 0 }}><span className="label">{s.trx}</span><input id="draft-trx" className="input" autoComplete="off" value={trx} onChange={(e) => setTrx(e.target.value)} /></label>
          </div>
        )}
      </section>

      <section className="card">
        <div className="totals">
          <div className="r"><span>{s.subtotal}</span><span className="num">{money(p.totals.subtotal, p.lang)}</span></div>
          {p.totals.discount > 0 && <div className="r"><span>{s.coupon} {p.totals.couponCode}</span><span className="num">− {money(p.totals.discount, p.lang)}</span></div>}
          <div className="r"><span>{s.delivery}</span><span className="num">{p.totals.delivery === 0 ? s.free : money(p.totals.delivery, p.lang)}</span></div>
          {method === "COD" && p.totals.codFee > 0 && <div className="r"><span>{s.codFee}</span><span className="num">{money(p.totals.codFee, p.lang)}</span></div>}
          <div className="r grand"><span>{s.total}</span><span className="num" data-testid="draft-total">{money(total, p.lang)}</span></div>
        </div>
        {error && <div className="err" role="alert" style={{ marginTop: 10 }} data-testid="draft-error">{error}</div>}
        <button type="button" className="btn btn-primary btn-block btn-round" style={{ marginTop: 14 }} disabled={busy || none} onClick={() => void place()} data-testid="draft-place">{busy ? s.placing : `${s.place} · ${money(total, p.lang)}`}</button>
      </section>
    </div>
  );
}
