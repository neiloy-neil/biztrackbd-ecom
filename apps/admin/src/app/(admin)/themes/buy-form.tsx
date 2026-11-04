"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui";
import { buyThemeAction, payThemeOnlineAction, quoteThemeAction, type BuyState } from "./actions";

interface PayTo { provider: "BKASH" | "NAGAD"; number: string; kind: string }
interface Quote { listPrice: number; discount: number; total: number; code: string | null }

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const KIND: Record<string, string> = { PERSONAL: "personal", AGENT: "agent", MERCHANT: "merchant" };

/**
 * Pay once by mobile money, then tell us the TrxID. Works for one theme (themeId) or a bundle (bundleId). A code is checked on the server and
 * the price shown is the server's answer; what the owner pays is worked out again there, never taken from this page.
 */
export function BuyForm({ themeId = "", bundleId = "", name, price, monthly = false, renew = false, payTo, online }: { themeId?: string; bundleId?: string; name: string; price: number; monthly?: boolean; renew?: boolean; payTo: PayTo[]; online: boolean }) {
  const ref = bundleId || themeId;
  const terms = monthly ? "per month. Pay again each month to keep it." : bundleId ? "paid once. Every theme in it is yours for life." : "paid once. It is yours for life.";
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(!online);
  const [busy, setBusy] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [state, action] = useActionState<BuyState, FormData>(buyThemeAction, {});
  const [provider, setProvider] = useState<string>(payTo[0]?.provider ?? "BKASH");
  const target = payTo.find((p) => p.provider === provider) ?? payTo[0];
  const [codeText, setCodeText] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [codeError, setCodeError] = useState("");
  const [checking, setChecking] = useState(false);
  const due = quote ? quote.total : price;
  const appliedCode = quote?.code ?? "";

  async function applyCode() {
    setChecking(true);
    setCodeError("");
    const r = await quoteThemeAction(themeId, bundleId, codeText);
    setChecking(false);
    if (r.quote) setQuote(r.quote);
    else { setQuote(null); setCodeError(r.error ?? "That code did not work."); }
  }
  const removeCode = () => { setQuote(null); setCodeText(""); setCodeError(""); };

  async function payOnline() {
    setBusy(true);
    setOnlineError("");
    const r = await payThemeOnlineAction(themeId, bundleId, appliedCode);
    if (r.paymentUrl) { window.location.href = r.paymentUrl; return; }
    setOnlineError(r.error ?? "Could not start the online payment.");
    setManual(true);
    setBusy(false);
  }

  const codeBox = (
    <div style={{ display: "grid", gap: 4 }} data-testid={`code-box-${ref}`}>
      {appliedCode ? (
        <p style={{ margin: 0, fontSize: 14 }} data-testid={`code-applied-${ref}`}>
          Code <b>{appliedCode}</b> applied: <s>{taka(quote!.listPrice)}</s> <b>{taka(quote!.total)}</b> (you save {taka(quote!.discount)}).{" "}
          <button type="button" className="link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={removeCode}>Remove</button>
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={codeText} onChange={(e) => setCodeText(e.target.value)} placeholder="Discount code" aria-label="Discount code" autoCapitalize="characters" style={{ minHeight: 44, fontSize: 16, flex: "1 1 140px", minWidth: 0 }} data-testid={`code-input-${ref}`} />
          <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={applyCode} disabled={checking || !codeText.trim()} data-testid={`code-apply-${ref}`}>{checking ? "Checking…" : "Apply"}</button>
        </div>
      )}
      {codeError && <p className="notice bad" role="alert" style={{ margin: 0, fontSize: 13 }}>{codeError}</p>}
    </div>
  );

  if (!open) {
    return <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} data-testid={`buy-${ref}`}>{renew ? "Renew" : "Buy"} for {taka(price)}</button>;
  }
  if (online && !manual) {
    return (
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        <p style={{ margin: 0, fontSize: 14 }}><b>{name}</b> is {taka(due)}, {terms}</p>
        {codeBox}
        <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={payOnline} disabled={busy} aria-busy={busy} data-testid={`pay-online-${ref}`}>{busy ? "Opening payment…" : `Pay ${taka(due)} online`}</button>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>bKash, Nagad, Rocket or card. {bundleId ? "The themes unlock" : "The theme unlocks"} the moment the payment is confirmed.</p>
        {onlineError && <p className="notice bad" role="alert" style={{ margin: 0 }}>{onlineError}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setManual(true)} data-testid={`pay-manual-${ref}`}>Pay by sending money myself</button>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="stack" style={{ display: "grid", gap: 10, marginTop: 8 }} data-testid={`buy-form-${ref}`}>
      <input type="hidden" name="themeId" value={themeId} />
      <input type="hidden" name="bundleId" value={bundleId} />
      <input type="hidden" name="code" value={appliedCode} />
      <p style={{ margin: 0, fontSize: 14 }}><b>{name}</b> is {taka(due)}, {terms}</p>
      {codeBox}
      {payTo.length === 0 ? (
        <p className="notice bad" role="alert" style={{ margin: 0 }}>Payment numbers are not set up yet. Please contact support.</p>
      ) : (
        <>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <legend className="muted" style={{ fontSize: 13, marginBottom: 4 }}>1. Send {taka(due)} to</legend>
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
