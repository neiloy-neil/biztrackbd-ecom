"use client";

import { useActionState, useState } from "react";
import { submitProofAction, type ProofState } from "./actions";

interface Plan { tier: string; name: string; priceMonthly: number; priceYearly: number; yearlyMonthsFree: number; summary: string }
interface PayTo { provider: "BKASH" | "NAGAD"; number: string; kind: string }

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;
const KIND: Record<string, string> = { PERSONAL: "personal", AGENT: "agent", MERCHANT: "merchant" };

/** Pick a plan, see exactly what to send and where, then tell us the TrxID. The price shown is only for the owner: the server uses the plan's own. */
export function PayForm({ plans, payTo, current, suggested }: { plans: Plan[]; payTo: PayTo[]; current: string; suggested: string }) {
  const [state, action, pending] = useActionState<ProofState, FormData>(submitProofAction, {});
  const [plan, setPlan] = useState(suggested);
  const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [provider, setProvider] = useState<string>(payTo[0]?.provider ?? "BKASH");
  const chosen = plans.find((p) => p.tier === plan)!;
  const amount = interval === "YEARLY" ? chosen.priceYearly : chosen.priceMonthly;
  const target = payTo.find((p) => p.provider === provider);

  return (
    <form action={action} className="stack" data-testid="pay-form">
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Plan</legend>
        <div className="grid grid-3">
          {plans.map((p) => (
            <label key={p.tier} className="card" style={{ cursor: "pointer", borderColor: p.tier === plan ? "var(--brand)" : undefined, boxShadow: p.tier === plan ? "0 0 0 2px var(--tint)" : undefined }} data-testid={`plan-${p.tier}`}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <b>{p.name}</b>
                <input type="radio" name="plan" value={p.tier} checked={p.tier === plan} onChange={() => setPlan(p.tier)} aria-label={`${p.name} plan`} />
              </div>
              <div className="num" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{taka(p.priceMonthly)}<span className="muted" style={{ fontSize: 13, fontWeight: 500 }}> / month</span></div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{p.summary}</div>
              {p.tier === current && <span className="pill info" style={{ marginTop: 8 }}>Your plan</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Pay for</legend>
        <div className="chips">
          <label className="chip" style={{ cursor: "pointer" }}><input type="radio" name="interval" value="MONTHLY" checked={interval === "MONTHLY"} onChange={() => setInterval("MONTHLY")} /> 1 month</label>
          <label className="chip" style={{ cursor: "pointer" }}><input type="radio" name="interval" value="YEARLY" checked={interval === "YEARLY"} onChange={() => setInterval("YEARLY")} /> 1 year{chosen.yearlyMonthsFree > 0 ? ` (${chosen.yearlyMonthsFree} months free)` : ""}</label>
        </div>
      </fieldset>

      {payTo.length === 0 ? (
        <div className="notice bad" role="alert">Payment numbers are not set up yet. Please contact support.</div>
      ) : (
        <div className="notice info" data-testid="pay-instructions">
          <b>Send {taka(amount)}</b> by {provider === "BKASH" ? "bKash" : "Nagad"} Send Money to <b className="num">{target?.number}</b> ({KIND[target?.kind ?? ""] ?? "merchant"} number). Then fill in the details below.
        </div>
      )}

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">You paid with</legend>
        <div className="chips">
          {payTo.map((p) => (
            <label key={p.provider} className="chip" style={{ cursor: "pointer" }}><input type="radio" name="provider" value={p.provider} checked={provider === p.provider} onChange={() => setProvider(p.provider)} /> {p.provider === "BKASH" ? "bKash" : "Nagad"}</label>
          ))}
        </div>
      </fieldset>
      <div className="row-2">
        <label className="field" style={{ marginBottom: 0 }}><span className="label">The number you sent from</span><input className="input" name="senderNumber" inputMode="tel" required placeholder="01712345678" /></label>
        <label className="field" style={{ marginBottom: 0 }}><span className="label">Transaction ID (TrxID)</span><input className="input" name="trxId" required minLength={8} maxLength={12} autoCapitalize="characters" autoComplete="off" /></label>
      </div>
      <label className="field" style={{ marginBottom: 0 }}><span className="label">Note <span className="opt">(optional)</span></span><input className="input" name="note" maxLength={150} /></label>
      {state.error && <div className="notice bad" role="alert" data-testid="pay-error">{state.error}</div>}
      <button className="btn btn-primary btn-lg" type="submit" disabled={pending || payTo.length === 0}>{pending ? "Sending…" : `I sent ${taka(amount)}. Check my payment`}</button>
      <p className="muted" style={{ fontSize: 13 }}>We check the TrxID in our own {provider === "BKASH" ? "bKash" : "Nagad"} account and switch your plan on, usually within a few hours. Your store keeps working while you wait.</p>
    </form>
  );
}
