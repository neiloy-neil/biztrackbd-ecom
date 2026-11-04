"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui";
import { buySmsAction, type BuySmsState } from "@/app/(admin)/settings/notifications/sms-actions";

interface PayTo { provider: "BKASH" | "NAGAD"; number: string; kind: string }

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;
const KIND: Record<string, string> = { PERSONAL: "personal", AGENT: "agent", MERCHANT: "merchant" };

/** Pick a pack, pay by mobile money, then send the TrxID. The price shown is a guide: the server works out the real one from the quantity. */
export function SmsBuyForm({ pricePaisa, minPack, step, payTo }: { pricePaisa: number; minPack: number; step: number; payTo: PayTo[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<BuySmsState, FormData>(buySmsAction, {});
  const [qty, setQty] = useState(minPack);
  const [provider, setProvider] = useState<string>(payTo[0]?.provider ?? "BKASH");
  const target = payTo.find((p) => p.provider === provider) ?? payTo[0];
  const price = (qty * pricePaisa) / 100;
  const valid = Number.isInteger(qty) && qty >= minPack && qty % step === 0;

  if (state.sent) return <p className="notice good" role="status" data-testid="buy-sms-sent" style={{ margin: 0 }}>Payment details sent. We will check the TrxID and add your SMS soon.</p>;
  if (!open) return <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)} data-testid="buy-sms">Buy more SMS</button>;
  return (
    <form action={action} style={{ display: "grid", gap: 10, width: "100%", maxWidth: 460 }} data-testid="buy-sms-form">
      <p style={{ margin: 0, fontSize: 14 }}>Each SMS is {(pricePaisa / 100).toFixed(2)} taka. The smallest pack is {minPack} SMS ({taka((minPack * pricePaisa) / 100)}). Bought SMS never expire.</p>
      <label style={{ display: "grid", gap: 4, fontSize: 14 }}>How many SMS
        <input name="quantity" type="number" inputMode="numeric" min={minPack} step={step} value={qty} onChange={(e) => setQty(Number(e.target.value))} required style={{ minHeight: 44, fontSize: 16 }} />
      </label>
      {!valid && <p className="notice bad" role="alert" style={{ margin: 0, fontSize: 13 }}>Enter at least {minPack}, in hundreds.</p>}
      {payTo.length === 0 ? (
        <p className="notice bad" role="alert" style={{ margin: 0 }}>Payment numbers are not set up yet. Please contact support.</p>
      ) : (
        <>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <legend className="muted" style={{ fontSize: 13, marginBottom: 4 }}>1. Send {valid ? taka(price) : "the amount"} to</legend>
            {payTo.map((p) => (
              <label key={p.provider} className="pill" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", cursor: "pointer", border: provider === p.provider ? "2px solid currentColor" : "1px solid var(--line)" }}>
                <input type="radio" name="provider" value={p.provider} checked={provider === p.provider} onChange={() => setProvider(p.provider)} />
                {p.provider === "BKASH" ? "bKash" : "Nagad"}
              </label>
            ))}
          </fieldset>
          {target && <p style={{ margin: 0, fontSize: 15 }}>Send money to <b>{target.number}</b> ({KIND[target.kind] ?? "merchant"} number).</p>}
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>2. The number you sent from
            <input name="senderNumber" inputMode="tel" autoComplete="tel" placeholder="01712345678" required style={{ minHeight: 44, fontSize: 16 }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>3. The TrxID from the message
            <input name="trxId" autoCapitalize="characters" placeholder="8 to 12 letters and numbers" required style={{ minHeight: 44, fontSize: 16 }} />
          </label>
        </>
      )}
      {state.error && <p className="notice bad" role="alert" style={{ margin: 0 }} data-testid="buy-sms-error">{state.error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <SubmitButton pending="Sending…" disabled={payTo.length === 0 || !valid}>Send payment details</SubmitButton>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
