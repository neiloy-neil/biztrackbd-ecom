"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Quote } from "@biztrackbd/core";
import { quoteCartAction } from "@/app/actions";
import { fmt, money, productTitle, type Lang } from "@/lib/i18n-core";
import type { CART_STRINGS } from "@/lib/strings";
import { useCart } from "./cart-provider";
import { tintFor } from "./product-image";


export function CartView({ lang, s, freeOver }: { lang: Lang; s: Record<(typeof CART_STRINGS)[number], string>; freeOver: number | null }) {
  const cart = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!cart.ready) return;
    if (cart.lines.length === 0) { setQuote(null); return; }
    const mine = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const r = await quoteCartAction({ items: cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) });
      if (mine !== seq.current) return; // a newer request is in flight
      setLoading(false);
      if (r.ok) setQuote(r.quote);
    }, 120);
    return () => clearTimeout(timer);
  }, [cart.lines, cart.ready]);

  // Items the store no longer sells leave the cart, so checkout never starts with a dead line.
  useEffect(() => {
    if (!quote) return;
    for (const p of quote.problems) if (p.kind === "unavailable") cart.remove(p.variantId);
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cart.ready) return <div className="empty" aria-busy="true" />;
  if (cart.lines.length === 0) {
    return (
      <div className="empty">
        <p>{s.cartEmpty}</p>
        <p style={{ marginTop: 16 }}><Link href="/search" className="btn btn-primary">{s.continueShopping}</Link></p>
      </div>
    );
  }

  const sub = quote?.subtotal ?? 0;
  const remaining = freeOver != null ? Math.max(0, freeOver - sub) : null;
  const blocked = quote?.problems.some((p) => p.kind === "insufficient_stock") ?? false;

  return (
    <div className="stack" data-testid="cart-view" aria-busy={loading}>
      <div className="card" style={{ padding: "4px 16px" }}>
        {(quote?.lines ?? []).map((l) => {
          const lineCart = cart.lines.find((x) => x.variantId === l.variantId);
          const qty = lineCart?.quantity ?? l.quantity;
          const title = productTitle(lang, l.productTitle, l.productTitleBn);
          const low = l.available > 0 && qty >= l.available;
          return (
            <div key={l.variantId} className="cart-line" data-testid="cart-line">
              <Link href={`/products/${l.slug}`} className="pimg" style={{ background: tintFor(l.productId) }} aria-hidden="true" tabIndex={-1}>
                {l.imageUrl && <Image src={l.imageUrl} alt="" fill sizes="76px" quality={60} />}
              </Link>
              <div>
                <Link href={`/products/${l.slug}`} className="name">{title}</Link>
                {l.variantTitle.toLowerCase() !== "default" && <div className="var">{l.variantTitle}</div>}
                <div className="qty" role="group" aria-label={s.quantity}>
                  <button type="button" aria-label="−" disabled={qty <= 1} onClick={() => cart.setQuantity(l.variantId, qty - 1)}>−</button>
                  <span>{qty}</span>
                  <button type="button" aria-label="+" disabled={qty >= Math.min(l.available, 10)} onClick={() => cart.setQuantity(l.variantId, qty + 1)}>+</button>
                </div>
                {(low || l.available < qty) && <div className="low">{fmt(s.itemLowStock, { n: l.available })}</div>}
                <div><button type="button" className="link-btn" onClick={() => cart.remove(l.variantId)}>{s.remove}</button></div>
              </div>
              <div className="price num" style={{ textAlign: "right" }}>{money(l.lineTotal, lang)}</div>
            </div>
          );
        })}
        {loading && !quote && <div className="empty">{s.updatingPrices}</div>}
      </div>

      {quote?.problems.filter((p) => p.kind === "insufficient_stock").map((p) => (
        <div key={p.variantId} className="notice" role="alert">{fmt(s.itemLowStock, { n: p.available })}</div>
      ))}

      {remaining != null && freeOver != null && (
        <div className="card">
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{remaining > 0 ? fmt(s.freeDeliveryAway, { amount: money(remaining, lang) }) : s.freeDeliveryGot}</div>
          <div className="progress" aria-hidden="true"><i style={{ width: `${Math.min(100, (sub / freeOver) * 100)}%` }} /></div>
        </div>
      )}

      <div className="card">
        <div className="totals">
          <div className="r"><span>{s.subtotal}</span><span className="num" data-testid="cart-subtotal">{money(sub, lang)}</span></div>
          <div className="r"><span>{s.deliveryFee}</span><span className="muted">{s.deliveryAtCheckout}</span></div>
        </div>
        <Link href="/checkout" className="btn btn-primary btn-block btn-round" style={{ marginTop: 16, ...(blocked ? { pointerEvents: "none", opacity: 0.55 } : {}) }} aria-disabled={blocked} data-testid="go-checkout">
          {s.checkout}
        </Link>
      </div>
    </div>
  );
}
