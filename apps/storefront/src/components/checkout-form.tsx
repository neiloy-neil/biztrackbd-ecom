"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Quote, StorefrontOrderBump } from "@biztrackbd/core";
import { BD_GEO } from "@biztrackbd/core/geo";
import { quoteCartAction, fetchCheckoutBumpsAction } from "@/app/actions";
import { placeOrderAction, parseAddressTextAction } from "@/app/(store)/checkout/actions";
import { captureAction } from "@/app/growth-actions";
import { fmt, money, productTitle, type Lang } from "@/lib/i18n-core";
import type { CHECKOUT_STRINGS, LOYALTY_STRINGS } from "@/lib/strings";
import { useCart } from "./cart-provider";
import { trackEvent } from "./tracker";


export interface PayInfo {
  bkashNumber: string | null;
  bkashKind: string;
  nagadNumber: string | null;
  nagadKind: string;
  paymentNote: string | null;
  uddoktapayEnabled?: boolean;
  sslcommerzEnabled?: boolean;
  bkashDirectEnabled?: boolean;
}

type Method = "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD" | "GATEWAY_UDDOKTAPAY" | "GATEWAY_SSLCOMMERZ" | "GATEWAY_BKASH" | "BANK_TRANSFER";
type Errors = Partial<Record<"phone" | "name" | "email" | "division" | "district" | "upazila" | "address" | "mfsSender" | "trxId" | "coupon" | "referral", string>>;

// ---- Phone: the customer types the 10 digits after +880. Pasting 01712345678 or +8801712345678 also works.
export function cleanPhoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("880")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}
const showPhone = (d: string) => (d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d);
const validLocal = (d: string) => /^1[3-9]\d{8}$/.test(d);
const full = (d: string) => `0${d}`;

const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export interface RecoverCart {
  items: { variantId: string; quantity: number }[];
  name: string | null;
  phoneLocal: string;
}

const fbCookie = (n: string) => {
  try {
    return document.cookie.split("; ").find((c) => c.startsWith(`${n}=`))?.split("=")[1];
  } catch {
    return undefined;
  }
};

export interface LoyaltyProps {
  s: Record<(typeof LOYALTY_STRINGS)[number], string>;
  /** The store has points on. */
  pointsOn: boolean;
  signedIn: boolean;
  available: number;
  worth: number;
  /** A friend's code remembered from their link. */
  referralCode: string;
  referralOn: boolean;
}

export function CheckoutForm({ lang, s, pay, errorsText, recover, loyalty }: { lang: Lang; s: Record<(typeof CHECKOUT_STRINGS)[number], string>; pay: PayInfo; errorsText: Record<string, string>; recover?: RecoverCart | null; loyalty?: LoyaltyProps }) {
  const router = useRouter();
  const cart = useCart();
  const key = useRef(uuid());
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [division, setDivision] = useState("Dhaka");
  const [district, setDistrict] = useState("Dhaka");
  const [upazila, setUpazila] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<Method>("COD");
  const [mfsSender, setMfsSender] = useState("");
  const [trx, setTrx] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [availableBumps, setAvailableBumps] = useState<StorefrontOrderBump[]>([]);
  const [selectedBumpIds, setSelectedBumpIds] = useState<string[]>([]);
  const [usePoints, setUsePoints] = useState(false);
  const [redeem, setRedeem] = useState(0);
  const [refInput, setRefInput] = useState(loyalty?.referralCode ?? "");
  const [refCode, setRefCode] = useState(loyalty?.referralCode ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAiPaste, setShowAiPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsingAddress, setParsingAddress] = useState(false);
  const [aiParseSuccess, setAiParseSuccess] = useState(false);

  async function handleAiParse() {
    if (!pasteText.trim() || parsingAddress) return;
    setParsingAddress(true);
    setAiParseSuccess(false);
    try {
      const res = await parseAddressTextAction(pasteText);
      if (res.ok && res.result) {
        const p = res.result;
        if (p.phone) setPhone(cleanPhoneDigits(p.phone));
        if (p.name) setName(p.name);
        if (p.division && p.district) {
          setDivision(p.division);
          setDistrict(p.district);
        }
        if (p.upazila) setUpazila(p.upazila);
        if (p.address) setAddress(p.address);
        if (p.notes && !note) setNote(p.notes);
        setAiParseSuccess(true);
        setTimeout(() => setShowAiPaste(false), 900);
      }
    } finally {
      setParsingAddress(false);
    }
  }
  const seq = useRef(0);
  const restored = useRef(false);
  const began = useRef(false);

  // Someone opened the link from the recovery SMS: put their cart and number back, once.
  useEffect(() => {
    if (!recover || restored.current || !cart.ready) return;
    restored.current = true;
    cart.clear();
    for (const l of recover.items) cart.add(l.variantId, l.quantity);
    setPhone(cleanPhoneDigits(recover.phoneLocal));
    if (recover.name) setName(recover.name);
  }, [recover, cart]);

  useEffect(() => {
    if (began.current || !cart.ready || cart.lines.length === 0) return;
    began.current = true;
    trackEvent("InitiateCheckout", { contentIds: cart.lines.map((l) => l.variantId), numItems: cart.lines.reduce((n, l) => n + l.quantity, 0) });
  }, [cart.ready, cart.lines]);

  // The moment a valid number is typed, the cart is kept for the store's call list. Quiet: nothing is shown, nothing can fail the page.
  useEffect(() => {
    if (!cart.ready || cart.lines.length === 0 || !validLocal(phone)) return;
    const timer = setTimeout(() => {
      void captureAction({ phone: full(phone), name: name.trim() || undefined, district, items: cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }).catch(() => undefined);
    }, 1200);
    return () => clearTimeout(timer);
  }, [cart.ready, cart.lines, phone, name, district]);

  const districts = useMemo(() => BD_GEO.find((d) => d.name === division)?.districts ?? [], [division]);
  const upazilas = useMemo(() => districts.find((d) => d.name === district)?.upazilas ?? [], [districts, district]);

  // Fetch active bumps matching cart items
  const quoteBaseProductIds = useMemo(() => {
    return quote?.lines.filter((l) => !l.isBump).map((l) => l.productId).sort().join(",") ?? "";
  }, [quote]);

  useEffect(() => {
    if (!quote || quote.lines.length === 0) return;
    const basePids = [...new Set(quote.lines.filter((l) => !l.isBump).map((l) => l.productId))];
    if (basePids.length === 0) return;
    void fetchCheckoutBumpsAction(basePids).then((res) => {
      if (res.ok) {
        setAvailableBumps(res.bumps);
        setSelectedBumpIds((prev) => prev.filter((id) => res.bumps.some((b) => b.id === id)));
      }
    });
  }, [quoteBaseProductIds]);

  // Live totals. Display only; the server recalculates when the order is placed.
  useEffect(() => {
    if (!cart.ready || cart.lines.length === 0) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      const bumpItems = availableBumps
        .filter((b) => selectedBumpIds.includes(b.id))
        .map((b) => ({ variantId: b.variantId, quantity: 1, isBump: true }));

      const r = await quoteCartAction({
        items: [
          ...cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          ...bumpItems,
        ],
        bumpIds: selectedBumpIds,
        district, couponCode: coupon || undefined, phone: validLocal(phone) ? full(phone) : undefined,
        redeemPoints: usePoints && redeem > 0 ? redeem : undefined, referralCode: refCode || undefined,
      });
      if (mine !== seq.current || !r.ok) return;
      setQuote(r.quote);
      if (coupon && r.quote.couponError) setErrors((e) => ({ ...e, coupon: r.quote.couponError! }));
      else setErrors((e) => (e.coupon ? { ...e, coupon: undefined } : e));
    }, 150);
    return () => clearTimeout(timer);
  }, [cart.lines, cart.ready, district, coupon, phone, redeem, usePoints, refCode, selectedBumpIds, availableBumps]);

  // "Use my points" means as many as this cart allows. The server says how many that is; follow it as the cart changes.
  useEffect(() => {
    if (!quote) return;
    const want = usePoints ? quote.loyalty.maxRedeemable : 0;
    if (want !== redeem) setRedeem(want);
  }, [quote, usePoints, redeem]);

  if (!cart.ready) return <div className="empty" aria-busy="true" />;
  if (cart.lines.length === 0) {
    return (
      <div className="empty">
        <p>{s.cartEmpty}</p>
        <p style={{ marginTop: 16 }}><Link href="/search" className="btn btn-primary">{s.continueShopping}</Link></p>
      </div>
    );
  }

  const total = quote?.total ?? null;
  const itemCount = cart.count;

  function validate(): Errors {
    const e: Errors = {};
    if (!validLocal(phone)) e.phone = errorsText.phone!;
    if (name.trim().length < 2) e.name = errorsText.name!;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = errorsText.email!;
    if (!upazila) e.upazila = errorsText.upazila!;
    if (address.trim().length < 5) e.address = errorsText.address!;
    if (method === "MANUAL_BKASH" || method === "MANUAL_NAGAD") {
      const sender = cleanPhoneDigits(mfsSender);
      if (!validLocal(sender)) e.mfsSender = errorsText.mfsSender!;
      if (!/^[A-Za-z0-9]{8,12}$/.test(trx.trim())) e.trxId = errorsText.trxId!;
    }
    if (method === "BANK_TRANSFER") {
      if (trx.trim().length < 3) e.trxId = "Please enter bank deposit reference or slip number";
    }
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    setFormError("");

    if (quote?.wholesale?.isWholesaleCustomer && !quote.wholesale.isMinOrderMet) {
      setFormError(`Minimum wholesale order amount is ${money(quote.wholesale.minOrderAmount, lang)}. Please add ${money(quote.wholesale.deficit, lang)} more to proceed.`);
      return;
    }

    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      // Move focus to the first problem so a keyboard or screen reader user lands on it.
      const first = Object.keys(e)[0];
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    setBusy(true);
    const bumpItems = availableBumps
      .filter((b) => selectedBumpIds.includes(b.id))
      .map((b) => ({ variantId: b.variantId, quantity: 1, isBump: true }));

    const r = await placeOrderAction({
      idempotencyKey: key.current,
      items: [
        ...cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        ...bumpItems,
      ],
      bumpIds: selectedBumpIds,
      customer: { name: name.trim(), phone: full(phone), email: email.trim() || undefined },
      shipping: { division, district, upazila, address: address.trim(), note: note.trim() || undefined },
      paymentMethod: method,
      mfs:
        method === "MANUAL_BKASH" || method === "MANUAL_NAGAD"
          ? { senderNumber: full(cleanPhoneDigits(mfsSender)), trxId: trx.trim() }
          : method === "BANK_TRANSFER"
          ? { senderNumber: "BANK_DEPOSIT", trxId: trx.trim() }
          : undefined,
      couponCode: coupon || undefined,
      redeemPoints: usePoints && redeem > 0 ? redeem : undefined,
      referralCode: refCode || undefined,
      tracking: { fbp: fbCookie("_fbp"), fbc: fbCookie("_fbc"), url: location.href },
    });
    if (r.ok) {
      cart.clear();
      if (r.paymentUrl) {
        window.location.href = r.paymentUrl;
        return;
      }
      router.push(`/order/${r.orderId}?k=${encodeURIComponent(r.token)}`);
      return;
    }
    setBusy(false);
    setFormError(r.error || s.orderFailed);
    if (r.field === "phone") setErrors({ phone: r.error });
    else if (r.field === "trxId") setErrors({ trxId: r.error });
    else if (r.field === "district") setErrors({ upazila: r.error });
    else if (r.field === "coupon") setErrors({ coupon: r.error });
    else if (r.field === "referral") setErrors({ referral: r.error });
  }

  const mfsInfo = (m: "MANUAL_BKASH" | "MANUAL_NAGAD") => (m === "MANUAL_BKASH" ? { n: pay.bkashNumber, kind: pay.bkashKind, app: s.bkash } : { n: pay.nagadNumber, kind: pay.nagadKind, app: s.nagad });

  const orderBumpsNode = availableBumps.length > 0 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }} data-testid="checkout-order-bumps">
      {availableBumps.map((b) => {
        const isSelected = selectedBumpIds.includes(b.id);
        const title = (lang === "bn" && b.titleBn) ? b.titleBn : b.title;
        const hl = (lang === "bn" && b.highlightTextBn) ? b.highlightTextBn : b.highlightText;
        const desc = (lang === "bn" && b.descriptionBn) ? b.descriptionBn : b.description;
        return (
          <div
            key={b.id}
            data-testid={`order-bump-card-${b.id}`}
            onClick={() => {
              setSelectedBumpIds((prev) =>
                prev.includes(b.id) ? prev.filter((id) => id !== b.id) : [...prev, b.id]
              );
            }}
            style={{
              cursor: "pointer",
              border: isSelected ? "2px solid #10b981" : "2px dashed #f59e0b",
              backgroundColor: isSelected ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.04)",
              borderRadius: 10,
              padding: "12px 14px",
              position: "relative",
              transition: "all 0.2s ease-in-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#d97706", display: "inline-flex", alignItems: "center", gap: 4 }}>
                {hl || (lang === "bn" ? "এককালীন বিশেষ অফার" : "ONE-TIME SPECIAL OFFER")}
              </span>
              {b.savings > 0 && (
                <span className="pill green" style={{ fontSize: 11, padding: "2px 8px", fontWeight: 700 }}>
                  {lang === "bn" ? `${money(b.savings, lang)} সাশ্রয়!` : `SAVE ${money(b.savings, lang)}!`}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  setSelectedBumpIds((prev) =>
                    prev.includes(b.id) ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                  );
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 18, height: 18, marginTop: 3, accentColor: "#10b981", cursor: "pointer" }}
                data-testid={`order-bump-check-${b.id}`}
              />
              {b.imageUrl && (
                <img
                  src={b.imageUrl}
                  alt={title}
                  style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)" }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--brand, #059669)" }}>
                    {money(b.bumpPrice, lang)}
                  </span>
                  {b.regularPrice > b.bumpPrice && (
                    <del style={{ fontSize: 12, color: "var(--ink-muted, #9ca3af)" }}>
                      {money(b.regularPrice, lang)}
                    </del>
                  )}
                </div>
                {desc && (
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-2, #6b7280)", lineHeight: 1.4 }}>
                    {desc}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ) : null;

  const summary = (
    <div className="card" data-testid="order-summary">
      <div style={{ marginBottom: 6 }}>
        {(quote?.lines ?? []).map((l) => (
          <div key={`${l.variantId}-${l.isBump ? "bump" : "normal"}`} className="totals" style={{ marginBottom: 8 }}>
            <div className="r">
              <span>
                {l.isBump && (
                  <span className="pill green" style={{ fontSize: 10, marginRight: 6, padding: "1px 5px", textTransform: "uppercase" }}>
                    {lang === "bn" ? "অর্ডার বাম্প" : "Order Bump"}
                  </span>
                )}
                {l.bundleTitle && (
                  <span className="pill blue" style={{ fontSize: 10, marginRight: 6, padding: "1px 5px" }}>
                    {l.bundleTitle}
                  </span>
                )}
                {productTitle(lang, l.productTitle, l.productTitleBn)}{l.variantTitle.toLowerCase() !== "default" ? ` (${l.variantTitle})` : ""} × {l.quantity}
              </span>
              <span className="num">{money(l.lineTotal, lang)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="totals">
        <div className="r"><span>{s.subtotal}</span><span className="num">{money(quote?.subtotal ?? 0, lang)}</span></div>
        {quote && quote.discount > 0 && <div className="r"><span>{s.discount} {quote.couponCode}</span><span className="num">−{money(quote.discount, lang)}</span></div>}
        {quote && quote.bundleSavings != null && quote.bundleSavings > 0 && (
          <div className="r" style={{ color: "var(--success, #10b981)" }}>
            <span>{lang === "bn" ? "কম্বো অফার ছাড়" : "Bundle Savings"}</span>
            <span className="num">−{money(quote.bundleSavings, lang)}</span>
          </div>
        )}
        {quote && quote.bumpSavings != null && quote.bumpSavings > 0 && (
          <div className="r" style={{ color: "var(--success, #10b981)" }}>
            <span>{lang === "bn" ? "বাম্প অফার ছাড়" : "Order Bump Savings"}</span>
            <span className="num">−{money(quote.bumpSavings, lang)}</span>
          </div>
        )}
        {quote && quote.loyalty.tierDiscount > 0 && <div className="r" data-testid="vip-line"><span>{loyalty?.s.vipDiscountLine}</span><span className="num">−{money(quote.loyalty.tierDiscount, lang)}</span></div>}
        {quote && quote.loyalty.referralDiscount > 0 && <div className="r" data-testid="referral-line"><span>{loyalty?.s.referralDiscountLine}</span><span className="num">−{money(quote.loyalty.referralDiscount, lang)}</span></div>}
        {quote && quote.loyalty.pointsDiscount > 0 && <div className="r" data-testid="points-line"><span>{loyalty?.s.pointsDiscountLine}</span><span className="num">−{money(quote.loyalty.pointsDiscount, lang)}</span></div>}
        <div className="r">
          <span>{s.deliveryFee}</span>
          <span className="num" data-testid="delivery-fee">{quote?.deliveryCharge == null ? s.deliveryAtCheckout : quote.deliveryCharge === 0 ? s.free : money(quote.deliveryCharge, lang)}</span>
        </div>
        <div className="r grand"><span>{s.total}</span><span className="num" data-testid="grand-total">{total == null ? money(quote?.subtotal ?? 0, lang) : money(total, lang)}</span></div>
      </div>
    </div>
  );

  const err = (k: keyof Errors) => (errors[k] ? <div className="error" id={`e-${k}`} role="alert">{errors[k]}</div> : null);
  const invalid = (k: keyof Errors) => (errors[k] ? { "aria-invalid": true as const, "aria-describedby": `e-${k}` } : {});

  return (
    <form onSubmit={submit} noValidate className="checkout" data-testid="checkout-form">
      <div className="col">
        <details className="mobile-summary">
          <summary className="summary-toggle"><span className="grow">{fmt(s.showSummary, { n: itemCount })}</span><span className="price num">{total == null ? money(quote?.subtotal ?? 0, lang) : money(total, lang)}</span></summary>
          <div style={{ marginTop: 10 }}>{summary}</div>
        </details>

        <section className="card" style={{ background: "rgba(99, 102, 241, 0.04)", borderColor: "rgba(99, 102, 241, 0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 14 }}>
                <span>{lang === "bn" ? "স্বয়ংক্রিয় ঠিকানা পূরণ" : "Auto-Parse Address"}</span>
                <span className="pill" style={{ fontSize: 10, padding: "1px 6px" }}>Auto-Fill</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-2, #6b7280)" }}>
                {lang === "bn"
                  ? "মেসেঞ্জার বা নোট থেকে নাম, ফোন ও ঠিকানা একবারে পেস্ট করুন।"
                  : "Paste customer name, phone and address directly from WhatsApp or messages."}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 13, padding: "6px 12px", border: "1px solid rgba(99, 102, 241, 0.3)" }}
              onClick={() => setShowAiPaste(!showAiPaste)}
            >
              {showAiPaste
                ? (lang === "bn" ? "বন্ধ করুন" : "Close")
                : (lang === "bn" ? "পেস্ট করুন" : "Paste Text")}
            </button>
          </div>

          {showAiPaste && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed rgba(99, 102, 241, 0.2)" }}>
              <textarea
                className="textarea"
                rows={3}
                style={{ width: "100%", fontSize: 13, resize: "vertical" }}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={lang === "bn"
                  ? "যেমন: তানিয়া আক্তার, ০১৭xxxxxxxx, মিরপুর ১০, ব্লক সি রোড ৭ বাসা ১৪, ঢাকা।"
                  : "e.g. Tania Akter, 01712345678, Road 7, House 14, Block C, Mirpur 10, Dhaka."}
              />
              <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
                {aiParseSuccess && (
                  <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 500 }}>
                    ✓ {lang === "bn" ? "ঠিকানা পূরণ সম্পন্ন!" : "Form auto-filled!"}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: 13, padding: "6px 14px" }}
                  disabled={parsingAddress || !pasteText.trim()}
                  onClick={handleAiParse}
                >
                  {parsingAddress
                    ? (lang === "bn" ? "যাচাই হচ্ছে..." : "Parsing...")
                    : (lang === "bn" ? "তথ্য পূরণ করুন" : "Auto-Fill Fields")}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2>{s.contactSection}</h2>
          <label className="field">
            <span className="label">{s.mobileNumber}</span>
            <div className="phone-field" data-invalid={errors.phone ? "true" : "false"}>
              <span className="cc">+880</span>
              <input id="f-phone" name="phone" inputMode="tel" autoComplete="tel-national" placeholder="1712-345678" value={showPhone(phone)} onChange={(e) => setPhone(cleanPhoneDigits(e.target.value))} {...invalid("phone")} />
            </div>
            {err("phone")}
          </label>
          <label className="field">
            <span className="label">{s.fullName}</span>
            <input id="f-name" className="input" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} {...invalid("name")} />
            {err("name")}
          </label>
          <label className="field">
            <span className="label">{s.email} <span className="opt">{s.optional}</span></span>
            <input id="f-email" className="input" name="email" type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} {...invalid("email")} />
            {err("email")}
          </label>
        </section>

        <section className="card">
          <h2>{s.deliveryAddress}</h2>
          <div className="row2">
            <label className="field">
              <span className="label">{s.division}</span>
              <select id="f-division" className="select" value={division} onChange={(e) => { const d = e.target.value; setDivision(d); const first = BD_GEO.find((x) => x.name === d)?.districts[0]?.name ?? ""; setDistrict(first); setUpazila(""); }}>
                {BD_GEO.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">{s.district}</span>
              <select id="f-district" className="select" value={district} onChange={(e) => { setDistrict(e.target.value); setUpazila(""); }}>
                {districts.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="label">{s.upazila}</span>
            <select id="f-upazila" className="select" value={upazila} onChange={(e) => setUpazila(e.target.value)} {...invalid("upazila")}>
              <option value="">{s.chooseOne}</option>
              {upazilas.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {err("upazila")}
          </label>
          <label className="field">
            <span className="label">{s.houseRoad}</span>
            <textarea id="f-address" className="textarea" name="address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} {...invalid("address")} />
            {err("address")}
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="label">{s.note} <span className="opt">{s.optional}</span></span>
            <input className="input" name="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </label>
        </section>

        <section className="card">
          <h2>{s.deliverySection}</h2>
          <div className="option selected" data-testid="delivery-option" style={{ cursor: "default" }}>
            <input type="radio" checked readOnly aria-label={quote?.zone?.name ?? s.deliverySection} />
            <div className="grow">
              <div className="t">{quote?.zone?.name ?? s.deliversEverywhere}</div>
              {quote?.zone && <div className="s">{fmt(s.arrives, { min: quote.zone.etaMinDays, max: quote.zone.etaMaxDays })}</div>}
            </div>
            <div className="t num">{quote?.deliveryCharge == null ? "" : quote.deliveryCharge === 0 ? s.free : money(quote.deliveryCharge, lang)}</div>
          </div>
        </section>

        <section className="card">
          <h2>{s.paymentSection}</h2>
          <label className={`option${method === "COD" ? " selected" : ""}`}>
            <input type="radio" name="pay" checked={method === "COD"} onChange={() => setMethod("COD")} data-testid="pay-cod" />
            <div className="grow"><div className="t">{s.cod}</div><div className="s">{s.codS}</div></div>
          </label>
          {pay.bkashDirectEnabled && (
            <label className={`option${method === "GATEWAY_BKASH" ? " selected" : ""}`} style={{ borderColor: method === "GATEWAY_BKASH" ? "var(--bkash, #D12053)" : undefined }}>
              <input type="radio" name="pay" checked={method === "GATEWAY_BKASH"} onChange={() => setMethod("GATEWAY_BKASH")} data-testid="pay-bkash-direct" />
              <div className="grow">
                <div className="t">{lang === "bn" ? "বিকাশ ডিরেক্ট (তাৎক্ষণিক পেমেন্ট)" : "bKash Direct (Instant Checkout)"}</div>
                <div className="s">{lang === "bn" ? "বিকাশ অ্যাপ অথবা ওটিপি/পিন দিয়ে অটোমেটিক পেমেন্ট" : "Direct & secure automated checkout via bKash"}</div>
              </div>
              <span className="mfs-tag" style={{ background: "var(--bkash, #D12053)", color: "#fff", fontWeight: 700 }} aria-hidden="true">bKash</span>
            </label>
          )}
          {pay.sslcommerzEnabled && (
            <label className={`option${method === "GATEWAY_SSLCOMMERZ" ? " selected" : ""}`} style={{ borderColor: method === "GATEWAY_SSLCOMMERZ" ? "#1b3882" : undefined }}>
              <input type="radio" name="pay" checked={method === "GATEWAY_SSLCOMMERZ"} onChange={() => setMethod("GATEWAY_SSLCOMMERZ")} data-testid="pay-sslcommerz" />
              <div className="grow">
                <div className="t">{lang === "bn" ? "কার্ড ও মোবাইল ব্যাংকিং (SSLCommerz)" : "Cards & Mobile Banking (SSLCommerz)"}</div>
                <div className="s">{lang === "bn" ? "ভিসা, মাস্টারকার্ড, বিকাশ, নগদ, রকেট ও ইন্টারনেট ব্যাংকিং" : "Visa, Mastercard, bKash, Nagad, Rocket & Net Banking"}</div>
              </div>
              <span className="mfs-tag" style={{ background: "linear-gradient(135deg, #1b3882, #0077b6)", color: "#fff", fontWeight: 700 }} aria-hidden="true">SSLCOMMERZ</span>
            </label>
          )}
          {pay.uddoktapayEnabled && (
            <label className={`option${method === "GATEWAY_UDDOKTAPAY" ? " selected" : ""}`} style={{ borderColor: method === "GATEWAY_UDDOKTAPAY" ? "var(--primary, #0f766e)" : undefined }}>
              <input type="radio" name="pay" checked={method === "GATEWAY_UDDOKTAPAY"} onChange={() => setMethod("GATEWAY_UDDOKTAPAY")} data-testid="pay-uddoktapay" />
              <div className="grow">
                <div className="t">{lang === "bn" ? "অনলাইন পেমেন্ট (বিকাশ / নগদ / কার্ড)" : "Pay Online (bKash / Nagad / Cards)"}</div>
                <div className="s">{lang === "bn" ? "উদ্যোক্তাপে এর মাধ্যমে নিরাপদ অটোমেটিক পেমেন্ট" : "Instant automated payment via UddoktaPay"}</div>
              </div>
              <span className="mfs-tag" style={{ background: "linear-gradient(135deg, #0f766e, #0284c7)", color: "#fff", fontWeight: 700 }} aria-hidden="true">ONLINE</span>
            </label>
          )}
          {(["MANUAL_BKASH", "MANUAL_NAGAD"] as const).map((m) => {
            const info = mfsInfo(m);
            const brand = m === "MANUAL_BKASH" ? "bkash" : "nagad";
            const open = method === m;
            return (
              <div key={m} className={`pay-box ${brand}${open ? " open" : ""}`}>
                <label className="option" style={open ? { padding: 14 } : undefined}>
                  <input type="radio" name="pay" checked={open} disabled={!info.n} onChange={() => setMethod(m)} data-testid={`pay-${brand}`} />
                  <div className="grow"><div className="t">{info.app}</div><div className="s">{info.n ? s.mfsS : fmt(s.mfsNumberMissing, { app: info.app })}</div></div>
                  <span className="mfs-tag" style={{ background: brand === "bkash" ? "var(--bkash)" : "var(--nagad)" }} aria-hidden="true">{info.app}</span>
                </label>
                {open && info.n && (
                  <div className="pay-body">
                    <div className="steps">
                      <b>1.</b> {fmt(s.mfsStep1, { app: info.app })}<br />
                      <b>2.</b> {fmt(s.mfsStep2, { amount: money(total ?? quote?.subtotal ?? 0, lang), number: info.n })}<br />
                      <b>3.</b> {s.mfsStep3}
                      {info.kind === "AGENT" && <div style={{ marginTop: 6, color: "var(--warn)", fontWeight: 600 }}>{s.mfsAgent}</div>}
                      {pay.paymentNote && <div style={{ marginTop: 6 }}>{pay.paymentNote}</div>}
                    </div>
                    <label className="field">
                      <span className="label">{fmt(s.yourMfsNumber, { app: info.app })}</span>
                      <input id="f-mfsSender" className="input" inputMode="tel" autoComplete="off" placeholder="01XXXXXXXXX" value={mfsSender} onChange={(e) => setMfsSender(e.target.value)} {...invalid("mfsSender")} />
                      {err("mfsSender")}
                    </label>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span className="label">{s.trxId}</span>
                      <input id="f-trxId" className="input" autoComplete="off" autoCapitalize="characters" maxLength={12} style={{ letterSpacing: 0.5, textTransform: "uppercase" }} value={trx} onChange={(e) => setTrx(e.target.value)} {...invalid("trxId")} />
                      {err("trxId")}
                      <div className="help">{s.mfsConfirm}</div>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          {quote?.paymentOptions?.bankTransfer?.available && (
            <div className={`pay-box ${method === "BANK_TRANSFER" ? " open" : ""}`} style={{ border: "1px solid #4f46e5" }}>
              <label className="option" style={method === "BANK_TRANSFER" ? { padding: 14 } : undefined}>
                <input
                  type="radio"
                  name="pay"
                  checked={method === "BANK_TRANSFER"}
                  onChange={() => setMethod("BANK_TRANSFER")}
                  data-testid="pay-bank-transfer"
                />
                <div className="grow">
                  <div className="t" style={{ color: "#4338ca", fontWeight: 700 }}>
                    {lang === "bn" ? "ব্যাংক ডিপোজিট / ব্যাংক ট্রান্সফার" : "Direct Bank Transfer / Wire"}
                  </div>
                  <div className="s">
                    {lang === "bn" ? "অফিসিয়াল ব্যাংক একাউন্টে জমা দিয়ে স্লিপ রেফারেন্স দিন" : "Transfer funds directly to official corporate account"}
                  </div>
                </div>
                <span className="mfs-tag" style={{ background: "#4f46e5", color: "#fff", fontWeight: 700 }} aria-hidden="true">
                  B2B BANK
                </span>
              </label>

              {method === "BANK_TRANSFER" && quote?.paymentOptions.bankTransfer.bankDetails && (
                <div className="pay-body" style={{ background: "rgba(79, 70, 229, 0.04)", padding: 14, borderRadius: 8 }}>
                  <div className="steps" style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <div><b>Bank:</b> {quote.paymentOptions.bankTransfer.bankDetails.bankName}</div>
                    <div><b>Branch:</b> {quote.paymentOptions.bankTransfer.bankDetails.branchName}</div>
                    <div><b>Account Name:</b> {quote.paymentOptions.bankTransfer.bankDetails.accountName}</div>
                    <div><b>Account No:</b> <b style={{ fontSize: 15, color: "#1e1b4b" }}>{quote.paymentOptions.bankTransfer.bankDetails.accountNumber}</b></div>
                    {quote.paymentOptions.bankTransfer.bankDetails.routingNumber && (
                      <div><b>Routing:</b> {quote.paymentOptions.bankTransfer.bankDetails.routingNumber}</div>
                    )}
                    {quote.paymentOptions.bankTransfer.bankDetails.instructions && (
                      <div style={{ marginTop: 6, color: "#4338ca" }}>
                        <b>Note:</b> {quote.paymentOptions.bankTransfer.bankDetails.instructions}
                      </div>
                    )}
                  </div>

                  <label className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                    <span className="label">Bank Deposit Slip Reference / TrxID *</span>
                    <input
                      id="f-bank-ref"
                      className="input"
                      placeholder="e.g. DEPOSIT-88392 or Cheque #"
                      value={trx}
                      onChange={(e) => setTrx(e.target.value)}
                      required
                    />
                    {err("trxId")}
                  </label>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="label">{s.couponCode} <span className="opt">{s.optional}</span></span>
            <div className="coupon-row">
              <input id="f-coupon" className="input" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} autoComplete="off" {...invalid("coupon")} />
              <button type="button" className="btn btn-ghost" onClick={() => setCoupon(couponInput.trim())}>{s.apply}</button>
            </div>
            {err("coupon")}
            {quote?.couponCode && !errors.coupon && <div className="help" style={{ color: "var(--success)", fontWeight: 600 }}>{fmt(s.couponApplied, { code: quote.couponCode })}</div>}
          </label>
        </section>

        {loyalty?.referralOn && (
          <section className="card" data-testid="referral-box">
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="label">{loyalty.s.referCodeLabel} <span className="opt">{s.optional}</span></span>
              <div className="coupon-row">
                <input id="f-referral" className="input" value={refInput} onChange={(e) => setRefInput(e.target.value.toUpperCase())} autoComplete="off" {...invalid("referral")} />
                <button type="button" className="btn btn-ghost" onClick={() => setRefCode(refInput.trim())}>{loyalty.s.apply}</button>
              </div>
              {err("referral")}
              {quote?.loyalty.referral && !errors.referral && <div className="help" style={{ color: "var(--success)", fontWeight: 600 }}>{loyalty.s.referApplied}</div>}
              {refCode && quote?.loyalty.referralError && !errors.referral && <div className="error" role="alert">{quote.loyalty.referralError}</div>}
            </label>
          </section>
        )}

        {loyalty?.pointsOn && (
          <section className="card" data-testid="points-box">
            {loyalty.signedIn ? (
              <div>
                <label className="row" style={{ flexWrap: "nowrap", gap: 10, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} disabled={loyalty.available <= 0} style={{ width: 22, height: 22, marginTop: 2 }} data-testid="use-points" />
                  <span>
                    <b>{loyalty.s.usePoints}</b>
                    <span className="muted" style={{ display: "block", fontSize: 13.5 }}>{fmt(loyalty.s.usePointsHint, { n: loyalty.available, v: loyalty.worth })}</span>
                    {usePoints && quote && quote.loyalty.pointsUsed > 0 && <span style={{ display: "block", fontSize: 13.5, color: "var(--success)", fontWeight: 600 }}>{fmt(loyalty.s.pointsMax, { n: quote.loyalty.pointsUsed })}</span>}
                    {usePoints && quote?.loyalty.pointsError && <span className="error" role="alert" style={{ display: "block" }}>{quote.loyalty.pointsError}</span>}
                  </span>
                </label>
              </div>
            ) : (
              <p style={{ fontSize: 14 }}>{loyalty.s.signInForPoints} · <Link href="/account" className="link-btn">{loyalty.s.signInLink}</Link></p>
            )}
          </section>
        )}

        <div className="mobile-summary" style={{ marginTop: 14 }}>
          {orderBumpsNode}
        </div>
      </div>

      <aside className="aside">
        {orderBumpsNode}
        {summary}
        <div style={{ marginTop: 14 }}>
          {formError && <div className="notice" role="alert" style={{ marginBottom: 10 }}>{formError}</div>}
          <button type="submit" className="btn btn-primary btn-block btn-round" disabled={busy} data-testid="place-order-desktop">{busy ? s.placing : `${s.placeOrder} · ${money(total ?? quote?.subtotal ?? 0, lang)}`}</button>
        </div>
      </aside>

      <div className="stickybar checkout-bar mobile-summary" style={{ flexDirection: "column" }}>
        {formError && <div className="notice" role="alert">{formError}</div>}
        <button type="submit" className="btn btn-primary btn-block btn-round" disabled={busy} data-testid="place-order">{busy ? s.placing : `${s.placeOrder} · ${money(total ?? quote?.subtotal ?? 0, lang)}`}</button>
      </div>
    </form>
  );
}
