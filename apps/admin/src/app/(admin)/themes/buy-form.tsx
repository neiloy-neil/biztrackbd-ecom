"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui";
import { buyThemeAction, payThemeOnlineAction, type BuyState } from "./actions";

interface PayTo { provider: "BKASH" | "NAGAD"; number: string; kind: string }

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;
const KIND: Record<string, string> = { PERSONAL: "personal", AGENT: "agent", MERCHANT: "merchant" };

/** Pay once by mobile money, then tell us the TrxID. The price shown is only for the owner: the server uses the theme's own. */
export function BuyForm({ themeId, themeName, price, payTo, online }: { themeId: string; themeName: string; price: number; payTo: PayTo[]; online: boolean }) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(!online);
  const [busy, setBusy] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [state, action] = useActionState<BuyState, FormData>(buyThemeAction, {});
  const [provider, setProvider] = useState<string>(payTo[0]?.provider ?? "BKASH");
  const target = payTo.find((p) => p.provider === provider) ?? payTo[0];

  async function payOnline() {
    setBusy(true);
    setOnlineError("");
    const r = await payThemeOnlineAction(themeId);
    if (r.paymentUrl) { window.location.href = r.paymentUrl; return; }
    setOnlineError(r.error ?? "Could not start the online payment.");
    setManual(true);
    setBusy(false);
  }

  if (!open) {
    return <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} data-testid={`buy-${themeId}`}>Buy for {taka(price)}</button>;
  }
  if (online && !manual) {
    return (
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        <p style={{ margin: 0, fontSize: 14 }}><b>{themeName}</b> is {taka(price)}, paid once. It is yours for life.</p>
        <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={payOnline} disabled={busy} aria-busy={busy} data-testid={`pay-online-${themeId}`}>{busy ? "Opening payment…" : `Pay ${taka(price)} online`}</button>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>bKash, Nagad, Rocket or card. The theme unlocks the moment the payment is confirmed.</p>
        {onlineError && <p className="notice bad" role="alert" style={{ margin: 0 }}>{onlineError}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setManual(true)} data-testid={`pay-manual-${themeId}`}>Pay by sending money myself</button>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="stack" style={{ display: "grid", gap: 10, marginTop: 8 }} data-testid={`buy-form-${themeId}`}>
      <input type="hidden" name="themeId" value={themeId} />
      <p style={{ margin: 0, fontSize: 14 }}><b>{themeName}</b> is {taka(price)}, paid once. It is yours for life.</p>
      {payTo.length === 0 ? (
        <p className="notice bad" role="alert" style={{ margin: 0 }}>Payment numbers are not set up yet. Please contact support.</p>
      ) : (
        <>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <legend className="muted" style={{ fontSize: 13, marginBottom: 4 }}>1. Send {taka(price)} to</legend>
            {payTo.map((p) => (
              <label key={p.provider} className="pill" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", cursor: "pointer", border: provider === p.provider ? "2px solid currentColor" : "1px solid var(--border, #ddd)" }}>
                <input type="radio" name="provider" value={p.provider} checked={provider === p.provider} onChange={() => setProvider(p.provider)} />
                {p.provider === "BKASH" ? "bKash" : "Nagad"}
              </label>
            ))}
          </fieldset>
          {target && <p style={{ margin: 0, fontSize: 15 }}>Send money to <b data-testid="pay-number">{target.number}</b> ({KIND[target.kind] ?? "merchant"} number).</p>}
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>2. The number you sent from
            <input name="senderNumber" inputMode="tel" autoComplete="tel" placeholder="01712345678" required style={{ minHeight: 44, fontSize: 16 }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>3. The TrxID from the message
            <input name="trxId" autoCapitalize="characters" placeholder="8 to 12 letters and numbers" required style={{ minHeight: 44, fontSize: 16 }} />
          </label>
        </>
      )}
      {(state.error || onlineError) && <p className="notice bad" role="alert" style={{ margin: 0 }} data-testid="buy-error">{state.error || onlineError}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <SubmitButton pending="Sending…" disabled={payTo.length === 0}>Send payment details</SubmitButton>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => (online ? setManual(false) : setOpen(false))}>{online ? "Back" : "Cancel"}</button>
      </div>
    </form>
  );
}
