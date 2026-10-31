"use client";

import { useActionState, useState } from "react";
import { initiateOnlineBillingAction, submitProofAction, type ProofState } from "./actions";
import { dateOnly } from "@/lib/format";

interface Plan {
  tier: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  yearlyMonthsFree: number;
  summary: string;
}

interface PayTo {
  provider: "BKASH" | "NAGAD";
  number: string;
  kind: string;
}

export interface SerializedQuote {
  planTier: string;
  interval: "MONTHLY" | "YEARLY";
  fullPrice: number;
  creditApplied: number;
  amountToPay: number;
  isUpgrade: boolean;
  isRenewal: boolean;
  newPeriodStart: string;
  newPeriodEnd: string;
}

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;
const KIND: Record<string, string> = { PERSONAL: "personal", AGENT: "agent", MERCHANT: "merchant" };

/** Pick a plan, see exactly what to send and where, then tell us the TrxID. The price shown is only for the owner: the server uses the plan's own. */
export function PayForm({
  plans,
  payTo,
  current,
  suggested,
  quotes,
  subscription,
}: {
  plans: Plan[];
  payTo: PayTo[];
  current: string;
  suggested: string;
  quotes?: Record<string, SerializedQuote>;
  subscription?: {
    tier: string;
    interval: string;
    amount: number;
    periodStart?: string;
    periodEnd?: string;
  } | null;
}) {
  const [state, action, pending] = useActionState<ProofState, FormData>(submitProofAction, {});
  const [plan, setPlan] = useState(suggested);
  const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [provider, setProvider] = useState<string>(payTo[0]?.provider ?? "BKASH");
  const [onlinePending, setOnlinePending] = useState(false);
  const [onlineError, setOnlineError] = useState("");
  const [showManual, setShowManual] = useState(false);

  const chosen = plans.find((p) => p.tier === plan)!;
  const quote = quotes?.[`${plan}:${interval}`] ?? {
    planTier: plan,
    interval,
    fullPrice: interval === "YEARLY" ? chosen.priceYearly : chosen.priceMonthly,
    creditApplied: 0,
    amountToPay: interval === "YEARLY" ? chosen.priceYearly : chosen.priceMonthly,
    isUpgrade: false,
    isRenewal: false,
    newPeriodStart: new Date().toISOString(),
    newPeriodEnd: new Date().toISOString(),
  };

  const amount = quote.amountToPay;
  const target = payTo.find((p) => p.provider === provider);

  async function handlePayOnline() {
    setOnlinePending(true);
    setOnlineError("");
    const res = await initiateOnlineBillingAction(plan, interval);
    if (res.paymentUrl) {
      window.location.href = res.paymentUrl;
      return;
    }
    setOnlinePending(false);
    setOnlineError(res.error || "Could not open online payment gateway");
  }

  return (
    <div className="stack">
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Plan</legend>
        <div className="grid grid-3">
          {plans.map((p) => {
            const pQuote = quotes?.[`${p.tier}:${interval}`];
            const isCardRenewal = pQuote?.isRenewal;
            const isCardUpgrade = pQuote?.isUpgrade && (pQuote?.creditApplied ?? 0) > 0;
            return (
              <label
                key={p.tier}
                className="card"
                style={{
                  cursor: "pointer",
                  borderColor: p.tier === plan ? "var(--brand)" : undefined,
                  boxShadow: p.tier === plan ? "0 0 0 2px var(--tint)" : undefined,
                }}
                data-testid={`plan-${p.tier}`}
              >
                <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <b>{p.name}</b>
                  <input
                    type="radio"
                    name="plan"
                    value={p.tier}
                    checked={p.tier === plan}
                    onChange={() => setPlan(p.tier)}
                    aria-label={`${p.name} plan`}
                  />
                </div>
                <div className="num" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                  {taka(p.priceMonthly)}
                  <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
                    {" "}
                    / month
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {p.summary}
                </div>
                {isCardRenewal ? (
                  <span className="pill ok" style={{ marginTop: 8 }}>
                    Extend cycle (+30 days)
                  </span>
                ) : isCardUpgrade ? (
                  <span className="pill ok" style={{ marginTop: 8 }}>
                    Upgrade · {taka(pQuote.creditApplied)} credit applied
                  </span>
                ) : p.tier === current ? (
                  <span className="pill info" style={{ marginTop: 8 }}>
                    Your plan
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Pay for</legend>
        <div className="chips">
          <label className="chip" style={{ cursor: "pointer" }}>
            <input
              type="radio"
              name="interval"
              value="MONTHLY"
              checked={interval === "MONTHLY"}
              onChange={() => setInterval("MONTHLY")}
            />{" "}
            1 month
          </label>
          <label className="chip" style={{ cursor: "pointer" }}>
            <input
              type="radio"
              name="interval"
              value="YEARLY"
              checked={interval === "YEARLY"}
              onChange={() => setInterval("YEARLY")}
            />{" "}
            1 year{chosen.yearlyMonthsFree > 0 ? ` (${chosen.yearlyMonthsFree} months free)` : ""}
          </label>
        </div>
      </fieldset>

      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(15,118,110,0.06), rgba(2,132,199,0.06))",
          borderColor: "var(--brand, #0f766e)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: 16 }}>
              {quote.isRenewal
                ? "Extend Your Subscription Instantly"
                : quote.isUpgrade
                ? "Upgrade Plan Instantly"
                : "Pay Instantly with UddoktaPay"}
            </h3>
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              {quote.isRenewal
                ? `Your active subscription ending on ${dateOnly(quote.newPeriodStart)} will be extended until ${dateOnly(
                    quote.newPeriodEnd,
                  )}. 100% of your remaining prepaid days are preserved.`
                : quote.isUpgrade
                ? `৳${quote.creditApplied.toLocaleString("en-IN")} unused credit deducted from your current plan. Your ${
                    chosen.name
                  } plan activates immediately until ${dateOnly(quote.newPeriodEnd)}.`
                : `Auto-activates your ${chosen.name} plan immediately via bKash, Nagad, Rocket, Upay or Cards.`}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handlePayOnline}
            disabled={onlinePending}
            style={{ minWidth: 200 }}
          >
            {onlinePending
              ? "Opening gateway…"
              : quote.isRenewal
              ? `Pay ${taka(amount)} to Extend`
              : quote.isUpgrade
              ? `Pay ${taka(amount)} to Upgrade`
              : `Pay ${taka(amount)} Online`}
          </button>
        </div>
        {onlineError && <div className="notice bad" style={{ marginTop: 12 }}>{onlineError}</div>}
      </div>

      <div style={{ textAlign: "center", margin: "8px 0" }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowManual(!showManual)}
        >
          {showManual ? "Hide manual Send Money form" : "Or pay manually (Send Money TrxID verification) ↓"}
        </button>
      </div>

      {showManual && (
        <form action={action} className="stack" data-testid="pay-form">
          <input type="hidden" name="plan" value={plan} />
          <input type="hidden" name="interval" value={interval} />
          {payTo.length === 0 ? (
            <div className="notice bad" role="alert">
              Payment numbers are not set up yet. Please contact support.
            </div>
          ) : (
            <div className="notice info" data-testid="pay-instructions">
              <b>Send {taka(amount)}</b> by {provider === "BKASH" ? "bKash" : "Nagad"} Send Money to{" "}
              <b className="num">{target?.number}</b> ({KIND[target?.kind ?? ""] ?? "merchant"} number). Then fill in
              the details below.
            </div>
          )}

          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label">You paid with</legend>
            <div className="chips">
              {payTo.map((p) => (
                <label key={p.provider} className="chip" style={{ cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="provider"
                    value={p.provider}
                    checked={provider === p.provider}
                    onChange={() => setProvider(p.provider)}
                  />{" "}
                  {p.provider === "BKASH" ? "bKash" : "Nagad"}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="row-2">
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="label">The number you sent from</span>
              <input className="input" name="senderNumber" inputMode="tel" required placeholder="01712345678" />
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="label">Transaction ID (TrxID)</span>
              <input
                className="input"
                name="trxId"
                required
                minLength={8}
                maxLength={12}
                autoCapitalize="characters"
                autoComplete="off"
              />
            </label>
          </div>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="label">
              Note <span className="opt">(optional)</span>
            </span>
            <input className="input" name="note" maxLength={150} />
          </label>
          {state.error && (
            <div className="notice bad" role="alert" data-testid="pay-error">
              {state.error}
            </div>
          )}
          <button className="btn btn-secondary btn-lg" type="submit" disabled={pending || payTo.length === 0}>
            {pending ? "Sending…" : `I sent ${taka(amount)}. Check my payment`}
          </button>
          <p className="muted" style={{ fontSize: 13 }}>
            We check the TrxID in our own {provider === "BKASH" ? "bKash" : "Nagad"} account and switch your plan on,
            usually within a few hours. Your store keeps working while you wait.
          </p>
        </form>
      )}
    </div>
  );
}
