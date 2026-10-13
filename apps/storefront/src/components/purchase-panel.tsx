"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./cart-provider";
import { requestStockAlertAction } from "../app/(store)/products/stock-alert-action";
import { trackEvent } from "./tracker";

export interface PurchaseVariant {
  id: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
}

/** All text arrives already translated and formatted, so this component knows nothing about languages. */
export interface PurchaseText {
  size: string;
  chooseSize: string;
  quantity: string;
  addToCart: string;
  buyNow: string;
  added: string;
  viewCart: string;
  soldOut: string;
  notifyTitle: string;
  notifyPhone: string;
  notifyButton: string;
  notifySent: string;
  notifyWaiting: string;
  notifyBad: string;
  /** contains {n} and {size} */
  onlyLeft: string;
  priceLabel: Record<string, string>;
}

const LOW_STOCK = 5;
const MAX_QTY = 10;

export function PurchasePanel({ variants, text, hasChoices }: { variants: PurchaseVariant[]; text: PurchaseText; hasChoices: boolean }) {
  const router = useRouter();
  const cart = useCart();
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? "");
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const v = variants.find((x) => x.id === variantId);
  const max = Math.max(0, Math.min(v?.stock ?? 0, MAX_QTY));
  const soldOut = !v || v.stock <= 0;
  const inCart = cart.lines.find((l) => l.variantId === variantId)?.quantity ?? 0;
  const canAdd = !soldOut && inCart + qty <= (v?.stock ?? 0);

  function choose(id: string) {
    setVariantId(id);
    setQty(1);
    setNotice(null);
  }

  async function notifyMe() {
    if (sending || !v) return;
    if (!/^(\+?880|0)?1[3-9]\d{8}$/.test(phone.replace(/[\s-]/g, ""))) { setNotice({ kind: "err", text: text.notifyBad }); return; }
    setSending(true);
    const r = await requestStockAlertAction(v.id, phone.replace(/[\s-]/g, ""));
    setSending(false);
    setNotice(r.ok ? { kind: "ok", text: r.alreadyWaiting ? text.notifyWaiting : text.notifySent } : { kind: "err", text: r.error });
  }

  function add(thenCheckout: boolean) {
    if (!v || !canAdd) return;
    cart.add(v.id, qty);
    trackEvent("AddToCart", { contentIds: [v.id], numItems: qty });
    if (thenCheckout) {
      router.push("/checkout");
      return;
    }
    setToast(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(false), 4000);
  }

  return (
    <div>
      {hasChoices && (
        <>
          <div className="opt-head"><span>{text.size}</span></div>
          <div className="sizes" role="group" aria-label={text.size}>
            {variants.map((x) => (
              <button key={x.id} type="button" className="size" aria-pressed={x.id === variantId} disabled={x.stock <= 0} onClick={() => choose(x.id)} data-testid={`size-${x.title}`}>
                {x.title}
              </button>
            ))}
          </div>
        </>
      )}
      {v && v.stock > 0 && v.stock <= LOW_STOCK && <p className="low">{text.onlyLeft.replace("{n}", String(v.stock)).replace("{size}", v.title)}</p>}

      {soldOut && v && (
        <div className="card" style={{ marginTop: 16 }} data-testid="notify-me">
          <b style={{ display: "block", marginBottom: 8 }}>{text.notifyTitle}</b>
          <label className="field" style={{ marginBottom: 8 }}>
            <span className="label">{text.notifyPhone}</span>
            <input id="notify-phone" className="input" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="notify-phone" />
          </label>
          {notice && <p role={notice.kind === "err" ? "alert" : "status"} className={notice.kind === "err" ? "err" : undefined} style={{ margin: "0 0 8px" }} data-testid="notify-notice">{notice.text}</p>}
          <button type="button" className="btn btn-ghost btn-round btn-block" disabled={sending} onClick={() => void notifyMe()} data-testid="notify-go">{text.notifyButton}</button>
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{text.quantity}</div>
        <div className="qty" role="group" aria-label={text.quantity}>
          <button type="button" aria-label="−" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span aria-live="polite" data-testid="qty">{qty}</span>
          <button type="button" aria-label="+" disabled={qty >= max} onClick={() => setQty((q) => Math.min(max, q + 1))}>+</button>
        </div>
      </div>

      <div className="stickybar">
        <button type="button" className="btn btn-primary btn-round" disabled={!canAdd} onClick={() => add(false)} data-testid="add-to-cart">
          {soldOut ? text.soldOut : `${text.addToCart} · ${text.priceLabel[variantId] ?? ""}`}
        </button>
        <button type="button" className="btn btn-ghost btn-round" style={{ flex: "0 0 auto", padding: "0 18px" }} disabled={!canAdd} onClick={() => add(true)} data-testid="buy-now">
          {text.buyNow}
        </button>
      </div>

      {toast && (
        <div className="toast" role="status">
          <span>{text.added}</span>
          <Link href="/cart">{text.viewCart}</Link>
        </div>
      )}
    </div>
  );
}
