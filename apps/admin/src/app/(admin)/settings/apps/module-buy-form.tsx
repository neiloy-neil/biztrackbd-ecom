"use client";

import { useActionState, useState } from "react";
import type { ModuleSaleItem } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { buyModuleAction, type BuyModuleState } from "./actions";

interface PayTo { provider: "BKASH" | "NAGAD"; number: string; kind: string }

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;
const KIND: Record<string, string> = { PERSONAL: "personal", AGENT: "agent", MERCHANT: "merchant" };

/** Pay by mobile money, then send the TrxID. The price shown is for the owner only: the server uses the module's own. */
export function ModuleBuyForm({ item, payTo }: { item: ModuleSaleItem; payTo: PayTo[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<BuyModuleState, FormData>(buyModuleAction, {});
  const [provider, setProvider] = useState<string>(payTo[0]?.provider ?? "BKASH");
  const target = payTo.find((p) => p.provider === provider) ?? payTo[0];
  const monthly = item.priceModel === "MONTHLY";
  const terms = monthly ? "per month. Pay again each month to keep it." : "paid once. It is yours to keep.";

  if (item.state === "PENDING") return <span className="pill warn" style={{ fontSize: 12 }}>Payment being checked</span>;
  if (!open) {
    return <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)} data-testid={`buy-module-${item.moduleKey}`}>{item.expired ? "Renew" : "Buy"} for {taka(item.price)}{monthly ? "/mo" : ""}</button>;
  }
  return (
    <form action={action} style={{ display: "grid", gap: 10, width: "100%" }} data-testid={`buy-module-form-${item.moduleKey}`}>
      <input type="hidden" name="moduleKey" value={item.moduleKey} />
      <p style={{ margin: 0, fontSize: 14 }}><b>{item.label}</b> is {taka(item.price)}, {terms}</p>
      {item.lastRejection && <p className="notice bad" role="alert" style={{ margin: 0, fontSize: 13 }}>Your last payment was not accepted: {item.lastRejection}</p>}
      {payTo.length === 0 ? (
        <p className="notice bad" role="alert" style={{ margin: 0 }}>Payment numbers are not set up yet. Please contact support.</p>
      ) : (
        <>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <legend className="muted" style={{ fontSize: 13, marginBottom: 4 }}>1. Send {taka(item.price)} to</legend>
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
      {state.error && <p className="notice bad" role="alert" style={{ margin: 0 }} data-testid="buy-module-error">{state.error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <SubmitButton pending="Sending…" disabled={payTo.length === 0}>Send payment details</SubmitButton>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
