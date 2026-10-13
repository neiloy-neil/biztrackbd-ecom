import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStoreInfo, signOrderAccess, viewDraftOrder } from "@biztrackbd/core";
import { getLang, money, productTitle } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";
import { DraftConfirm } from "./draft-confirm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

const TEXT = {
  en: {
    title: "Please check your order", sub: "{store} set this up for you. Check it, choose how to pay and place it.", items: "Items", deliverTo: "Deliver to",
    gone: "This order link is not valid", goneS: "It may have been mistyped. Please ask the store to send it again.",
    expired: "This order link has expired", expiredS: "Please ask the store to send you a new one.",
    cancelled: "This order link was cancelled", cancelledS: "Please ask the store to send you a new one.", home: "Go to the shop",
    paused: "The store is taking a short break and cannot take orders right now. Please try again later.",
  },
  bn: {
    title: "আপনার অর্ডারটি দেখে নিন", sub: "{store} আপনার জন্য এই অর্ডারটি সাজিয়েছে। দেখে নিন, পেমেন্টের উপায় বেছে অর্ডার করুন।", items: "পণ্য", deliverTo: "ডেলিভারির ঠিকানা",
    gone: "এই অর্ডার লিংকটি সঠিক নয়", goneS: "লিংকটি ভুল লেখা হয়ে থাকতে পারে। দোকানকে আবার পাঠাতে বলুন।",
    expired: "এই অর্ডার লিংকের সময় শেষ", expiredS: "দোকানকে নতুন লিংক পাঠাতে বলুন।",
    cancelled: "এই অর্ডার লিংক বাতিল করা হয়েছে", cancelledS: "দোকানকে নতুন লিংক পাঠাতে বলুন।", home: "দোকানে যান",
    paused: "দোকান কিছুক্ষণের বিরতিতে আছে, এখন অর্ডার নিতে পারছে না। একটু পরে আবার চেষ্টা করুন।",
  },
} as const;

export default async function DraftPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const store = await getStore();
  const lang = await getLang(store.locale);
  const t = TEXT[lang];
  const view = await viewDraftOrder(store.id, code);
  if (view.state === "converted") redirect(`/order/${view.orderId}?k=${encodeURIComponent(signOrderAccess(store.id, view.orderId))}`);
  if (view.state !== "open") {
    const key = view.state === "missing" ? "gone" : view.state;
    return (
      <div className="wrap" style={{ textAlign: "center", padding: "48px 0" }}>
        <h1 className="page-title" data-testid="draft-gone">{t[key as "gone" | "expired" | "cancelled"]}</h1>
        <p>{t[`${key}S` as "goneS" | "expiredS" | "cancelledS"]}</p>
        <p><Link href="/" className="btn btn-primary">{t.home}</Link></p>
      </div>
    );
  }
  const info = await getStoreInfo(store.id);
  const q = view.quote;
  return (
    <div className="wrap" data-testid="draft-page">
      <h1 className="page-title" style={{ paddingBottom: 4 }}>{t.title}</h1>
      <p style={{ marginTop: 0 }}>{t.sub.replace("{store}", view.storeName || info.storeName)}</p>
      {info.ordersPaused ? (
        <div className="card" role="status">{t.paused}</div>
      ) : (
        <>
          <section className="card" style={{ marginBottom: 14 }}>
            <h2>{t.items}</h2>
            {q.lines.map((l) => (
              <div key={l.variantId} className="row" style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0" }} data-testid="draft-line">
                <div>{productTitle(lang, l.productTitle, l.productTitleBn)}{l.variantTitle && l.variantTitle.toLowerCase() !== "default" ? ` (${l.variantTitle})` : ""} × {l.quantity}</div>
                <b className="num">{money(l.lineTotal, lang)}</b>
              </div>
            ))}
          </section>
          <section className="card" style={{ marginBottom: 14 }}>
            <h2>{t.deliverTo}</h2>
            <div><b>{view.customer.name}</b></div>
            <div>{view.shipping.address}</div>
            <div className="muted">{view.shipping.upazila}, {view.shipping.district}</div>
            {view.note && <div className="muted" style={{ marginTop: 6 }}>{view.note}</div>}
          </section>
          <DraftConfirm
            code={code} lang={lang}
            totals={{ subtotal: q.subtotal, delivery: q.deliveryCharge ?? 0, discount: q.discount, couponCode: q.couponCode, codFee: q.paymentOptions.cod.fee, total: q.total ?? q.subtotal }}
            cod={q.paymentOptions.cod} bkash={{ available: q.paymentOptions.bkash.available && Boolean(info.bkashNumber), number: info.bkashNumber }} nagad={{ available: q.paymentOptions.nagad.available && Boolean(info.nagadNumber), number: info.nagadNumber }}
            problems={q.problems.length}
          />
        </>
      )}
    </div>
  );
}
