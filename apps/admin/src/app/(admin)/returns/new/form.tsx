"use client";

import { useActionState, useState } from "react";
import { createReturnAction, type NewReturnState } from "../actions";

interface Item { id: string; title: string; variantTitle: string | null; unitPrice: number; left: number }
interface Option { id: string; label: string; stock: number }

export function NewReturnForm({ orderId, items, options, reasons }: { orderId: string; items: Item[]; options: Option[]; reasons: readonly string[] }) {
  const [state, action, pending] = useActionState<NewReturnState, FormData>(createReturnAction.bind(null, orderId), {});
  const [type, setType] = useState("REFUND");
  const [reason, setReason] = useState<string>(reasons[0] ?? "Other");
  return (
    <form action={action} className="stack" data-testid="new-return-form">
      <section className="card">
        <h2>What is coming back?</h2>
        {items.map((i) => (
          <div key={i.id} className="row flex-between nowrap py-xs">
            <div className="min-w-0">
              <div className="text-medium">{i.title}</div>
              <div className="muted text-sm">{i.variantTitle && i.variantTitle.toLowerCase() !== "default" ? `${i.variantTitle} · ` : ""}৳ {i.unitPrice} each · {i.left} can still be returned</div>
            </div>
            <input className="input w-70" type="number" min={0} max={i.left} defaultValue={0} name={`qty_${i.id}`} disabled={i.left === 0} aria-label={`How many ${i.title}`} />
          </div>
        ))}
      </section>

      <section className="card stack">
        <label className="field mb-0"><span className="label">Reason</span>
          <select className="select" name="reason" value={reason} onChange={(e) => setReason(e.target.value)}>{reasons.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        {reason === "Other" && <input className="input" name="other_reason" required minLength={3} maxLength={150} placeholder="Tell us what happened" aria-label="Other reason" />}
        <label className="field mb-0"><span className="label">What the customer said <span className="opt">(optional)</span></span><input className="input" name="note" maxLength={300} /></label>
        <fieldset className="field border-none p-0 m-0">
          <legend className="label">They want</legend>
          <div className="chips">
            {([["REFUND", "A refund"], ["EXCHANGE", "A different size or colour"], ["STORE_CREDIT", "Store credit"]] as const).map(([v, l]) => (
              <label key={v} className="chip cursor-pointer"><input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} /> {l}</label>
            ))}
          </div>
        </fieldset>
        {type === "EXCHANGE" && (
          <label className="field mb-0"><span className="label">Send instead</span>
            <select className="select" name="exchangeVariantId" required defaultValue="">
              <option value="" disabled>Choose size or colour</option>
              {options.map((o) => <option key={o.id} value={o.id} disabled={o.stock <= 0}>{o.label} · {o.stock > 0 ? `${o.stock} in stock` : "out of stock"}</option>)}
            </select>
          </label>
        )}
        {state.error && <div className="notice bad" role="alert" data-testid="new-return-error">{state.error}</div>}
        <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>{pending ? "Opening…" : "Open return"}</button>
      </section>
    </form>
  );
}
