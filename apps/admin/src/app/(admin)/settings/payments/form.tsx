"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/ui";
import { toast } from "@/components/toast";
import { savePaymentsAction, type PayState } from "./actions";

export interface PayValues {
  codEnabled: boolean; codFee: number; codMaxAmount: number | null;
  bkashEnabled: boolean; bkashNumber: string; bkashKind: string; bkashInstruction: string;
  nagadEnabled: boolean; nagadNumber: string; nagadKind: string; nagadInstruction: string; paymentNote: string;
  advanceMode: string; advanceValue: number; advanceMinOrder: number; advancePayVia: string; advanceWindowHours: number;
}

const KINDS: [string, string][] = [["PERSONAL", "Personal (send money)"], ["AGENT", "Agent (cash out)"], ["MERCHANT", "Merchant (payment)"]];

export function PaymentsForm({ initial }: { initial: PayValues }) {
  const [state, action] = useActionState<PayState, FormData>(savePaymentsAction, {});
  useEffect(() => {
    if (state.ok) toast.success("Payment settings saved.");
    else if (state.error) toast.error(state.error);
  }, [state]);
  const bad = (f: string) => (state.field === f ? { "aria-invalid": true as const } : {});
  const [advMode, setAdvMode] = useState(initial.advanceMode);
  return (
    <form action={action} className="stack" data-testid="payments-form">
      <section className="card">
        <label className="check"><input type="checkbox" name="codEnabled" defaultChecked={initial.codEnabled} data-testid="cod-enabled" /><span><b>Cash on delivery</b><br /><span className="muted text-sm">Customer pays the courier when the parcel arrives.</span></span></label>
        <div className="row-2 mt-sm">
          <label className="field m-0"><span className="label">Extra COD fee (৳)</span><input className="input" name="codFee" inputMode="decimal" defaultValue={initial.codFee} {...bad("codFee")} data-testid="cod-fee" /></label>
          <label className="field m-0"><span className="label">Allow COD up to (৳) <span className="opt">(optional)</span></span><input className="input" name="codMaxAmount" inputMode="decimal" defaultValue={initial.codMaxAmount ?? ""} {...bad("codMaxAmount")} data-testid="cod-max" /></label>
        </div>
      </section>

      <section className="card" data-testid="advance-settings">
        <b>Advance payment for cash on delivery</b>
        <p className="muted text-sm mt-sm">Ask the customer to pay part (or all) of the order first. The order is held, with its stock, until you confirm the payment. The rest is collected by the courier. Customers who pay the whole order by bKash, Nagad or online are not asked for an advance.</p>
        <div className="row-2 mt-sm">
          <label className="field m-0"><span className="label">Ask for an advance</span>
            <select className="select" name="advanceMode" value={advMode} onChange={(e) => setAdvMode(e.target.value)} {...bad("advanceMode")} data-testid="advance-mode">
              <option value="OFF">No advance</option>
              <option value="FIXED">A fixed amount</option>
              <option value="PERCENT">A percentage of the order total</option>
              <option value="FULL">The whole order up front</option>
            </select></label>
          {(advMode === "FIXED" || advMode === "PERCENT") && (
            <label className="field m-0"><span className="label">{advMode === "FIXED" ? "Advance amount (৳)" : "Advance (% of the total)"}</span>
              <input className="input" name="advanceValue" inputMode="decimal" defaultValue={initial.advanceValue || ""} {...bad("advanceValue")} data-testid="advance-value" /></label>
          )}
        </div>
        {advMode !== "OFF" && (
          <>
            <div className="row-2 mt-sm">
              <label className="field m-0"><span className="label">Only for orders of at least (৳)</span>
                <input className="input" name="advanceMinOrder" inputMode="decimal" defaultValue={initial.advanceMinOrder} {...bad("advanceMinOrder")} data-testid="advance-min" /></label>
              <label className="field m-0"><span className="label">Hours to pay before the order is cancelled</span>
                <input className="input" name="advanceWindowHours" inputMode="numeric" defaultValue={initial.advanceWindowHours} {...bad("advanceWindowHours")} data-testid="advance-hours" /></label>
            </div>
            <label className="field mt-sm m-0"><span className="label">How customers pay the advance</span>
              <select className="select" name="advancePayVia" defaultValue={initial.advancePayVia} {...bad("advancePayVia")} data-testid="advance-payvia">
                <option value="MANUAL">bKash / Nagad (customer sends the TrxID, you confirm it)</option>
                <option value="GATEWAY">Online payment page (confirmed automatically)</option>
                <option value="BOTH">Customer chooses either</option>
              </select></label>
          </>
        )}
        {advMode === "OFF" && (<>
          <input type="hidden" name="advanceValue" value="0" />
          <input type="hidden" name="advanceMinOrder" value="0" />
          <input type="hidden" name="advanceWindowHours" value="24" />
          <input type="hidden" name="advancePayVia" value={initial.advancePayVia} />
        </>)}
      </section>

      <section className="card bg-subtle border">
        <div className="flex-between items-center flex-wrap gap-md">
          <div>
            <b>Automated Online Payments (UddoktaPay)</b><br />
            <span className="muted text-sm">Accept automated bKash, Nagad, Rocket, Upay and Cards without manual TrxID checking.</span>
          </div>
          <a href="/settings/apps?open=uddoktapay_pay" className="btn btn-secondary btn-sm">Configure UddoktaPay Keys →</a>
        </div>
      </section>

      {([
        ["bkash", "bKash", initial.bkashEnabled, initial.bkashNumber, initial.bkashKind, initial.bkashInstruction],
        ["nagad", "Nagad", initial.nagadEnabled, initial.nagadNumber, initial.nagadKind, initial.nagadInstruction],
      ] as const).map(([k, name, enabled, number, kindValue, instruction]) => (
        <section className="card" key={k}>
          <label className="check"><input type="checkbox" name={`${k}Enabled`} defaultChecked={enabled} data-testid={`${k}-enabled`} /><span><b>{name}</b><br /><span className="muted text-sm">Customer sends money, then enters the TrxID at checkout. You confirm it.</span></span></label>
          <div className="row-2 mt-sm">
            <label className="field"><span className="label">{name} number</span><input className="input" name={`${k}Number`} inputMode="tel" defaultValue={number} {...bad(`${name} number`)} data-testid={`${k}-number`} /></label>
            <label className="field"><span className="label">Account type</span>
              <select className="select" name={`${k}Kind`} defaultValue={kindValue}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
          <label className="field m-0"><span className="label">Extra instruction shown to customers <span className="opt">(optional)</span></span><input className="input" name={`${k}Instruction`} defaultValue={instruction} maxLength={300} /></label>
        </section>
      ))}

      <section className="card">
        <label className="field m-0"><span className="label">Note under the payment steps <span className="opt">(optional)</span></span><input className="input" name="paymentNote" defaultValue={initial.paymentNote} maxLength={200} placeholder="We confirm within 2 hours." /></label>
      </section>
      <div className="notice info">Customers send money to these numbers. If someone else gets into your account and changes them, your payments go to them, so every change here is recorded in the audit log.</div>
      {state.error && <div className="notice bad" role="alert" data-testid="payments-error">{state.error}</div>}
      {state.ok && <div className="notice good" role="status" data-testid="payments-saved">Payment settings saved.</div>}
      <div>
        <SubmitButton className="btn btn-primary btn-lg">Save payment settings</SubmitButton>
      </div>
    </form>
  );
}
