"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EditableOrder } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { searchProductsAction } from "../../new/actions";
import { saveItemsAction } from "./actions";

type Line = { key: string; itemId?: string; productTitle: string; variantId: string; quantity: number; options: { variantId: string; title: string; stock: number; price: number }[]; originalVariantId?: string; unitPrice: number };
type Found = Awaited<ReturnType<typeof searchProductsAction>>[number];

export function ItemsEditor({ orderId, orderNumber, lines: initial, paid, currentTotal }: { orderId: string; orderNumber: string; lines: EditableOrder["lines"]; paid: boolean; currentTotal: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lines, setLines] = useState<Line[]>(() =>
    initial.map((l) => ({ key: l.itemId, itemId: l.itemId, productTitle: l.productTitle, variantId: l.variantId, quantity: l.quantity, options: l.options, originalVariantId: l.variantId, unitPrice: l.unitPrice })),
  );
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    let live = true;
    const t = setTimeout(() => searchProductsAction(q).then((r) => { if (live) setResults(r); }), 200);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const priceOf = (l: Line) => (l.variantId === l.originalVariantId ? l.unitPrice : l.options.find((o) => o.variantId === l.variantId)?.price ?? l.unitPrice);
  const subtotal = lines.reduce((n, l) => n + priceOf(l) * l.quantity, 0);

  function add(f: Found) {
    setResults([]); setQ("");
    setLines((c) => {
      const same = c.find((l) => l.variantId === f.variantId);
      if (same) return c.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { key: `new-${f.variantId}`, productTitle: f.productTitle, variantId: f.variantId, quantity: 1, options: [{ variantId: f.variantId, title: f.variantTitle, stock: f.stock, price: f.price }], unitPrice: f.price }];
    });
  }

  function save() {
    setError("");
    start(async () => {
      const r = await saveItemsAction(orderId, lines.map((l) => ({ itemId: l.itemId, variantId: l.variantId, quantity: l.quantity })));
      if (r.error) { setError(r.error); return; }
      router.push(`/orders/${orderId}`);
      router.refresh();
    });
  }

  return (
    <div className="card stack" data-testid="items-editor">
      <p className="muted" style={{ margin: 0 }}>
        Change a size or colour, the quantity, or add or remove items. Stock is adjusted for you, and the delivery charge, coupon and total are worked out again.
        {paid && ` The customer has already paid or sent a TrxID for ${taka(currentTotal)}, so the total has to stay the same.`}
      </p>
      {lines.map((l) => (
        <div key={l.key} className="row" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }} data-testid="items-line">
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{l.productTitle}</div>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="label">Size or colour</span>
              <select className="select" value={l.variantId} onChange={(e) => setLines((c) => c.map((x) => (x === l ? { ...x, variantId: e.target.value } : x)))} data-testid="items-variant">
                {l.options.map((o) => (
                  <option key={o.variantId} value={o.variantId} disabled={o.stock < 1 && o.variantId !== l.originalVariantId}>{o.title} · {o.stock} in stock · {taka(o.price)}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field" style={{ marginBottom: 0, width: 96 }}>
            <span className="label">Quantity</span>
            <input className="input" type="number" inputMode="numeric" min={1} max={50} value={l.quantity} onChange={(e) => setLines((c) => c.map((x) => (x === l ? { ...x, quantity: Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1))) } : x)))} data-testid="items-qty" />
          </label>
          <b className="num" style={{ minWidth: 70, textAlign: "right" }}>{taka(priceOf(l) * l.quantity)}</b>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLines((c) => c.filter((x) => x !== l))} disabled={lines.length === 1} aria-label={`Remove ${l.productTitle}`} data-testid="items-remove">Remove</button>
        </div>
      ))}

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <label className="field" style={{ marginBottom: 6 }}>
          <span className="label">Add another item</span>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a product name or SKU" autoComplete="off" data-testid="items-search" />
        </label>
        {results.length > 0 && (
          <ul className="list" style={{ margin: 0, padding: 0, listStyle: "none" }} data-testid="items-results">
            {results.map((f) => (
              <li key={f.variantId}>
                <button type="button" className="btn btn-secondary btn-block" style={{ justifyContent: "space-between", marginBottom: 6 }} disabled={f.stock < 1} onClick={() => add(f)}>
                  <span>{f.productTitle}{f.variantTitle && f.variantTitle !== "Default" ? ` (${f.variantTitle})` : ""}</span>
                  <span className="num">{f.stock < 1 ? "Out of stock" : `${f.stock} in stock · ${taka(f.price)}`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Items subtotal (delivery and discounts are added when you save)</span><b className="num" data-testid="items-subtotal">{taka(subtotal)}</b></div>
      {error && <div className="notice bad" role="alert" data-testid="items-error">{error}</div>}
      <button type="button" className="btn btn-primary btn-lg" onClick={save} disabled={pending || lines.length === 0} data-testid="items-save">{pending ? "Saving…" : `Save changes to ${orderNumber}`}</button>
    </div>
  );
}
