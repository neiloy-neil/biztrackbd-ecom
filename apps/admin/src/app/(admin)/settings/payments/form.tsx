"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { savePaymentsAction, type PayState } from "./actions";

export interface PayValues {
  codEnabled: boolean; codFee: number; codMaxAmount: number | null;
  bkashEnabled: boolean; bkashNumber: string; bkashKind: string; bkashInstruction: string;
  nagadEnabled: boolean; nagadNumber: string; nagadKind: string; nagadInstruction: string; paymentNote: string;
}

const KINDS: [string, string][] = [["PERSONAL", "Personal (send money)"], ["AGENT", "Agent (cash out)"], ["MERCHANT", "Merchant (payment)"]];

export function PaymentsForm({ initial }: { initial: PayValues }) {
  const [state, action] = useActionState<PayState, FormData>(savePaymentsAction, {});
  const bad = (f: string) => (state.field === f ? { "aria-invalid": true as const } : {});
  return (
    <form action={action} className="stack" data-testid="payments-form">
      <section className="card">
        <label className="check"><input type="checkbox" name="codEnabled" defaultChecked={initial.codEnabled} data-testid="cod-enabled" /><span><b>Cash on delivery</b><br /><span className="muted" style={{ fontSize: 13 }}>Customer pays the courier when the parcel arrives.</span></span></label>
        <div className="row-2" style={{ marginTop: 12 }}>
          <label className="field" style={{ marginBottom: 0 }}><span className="label">Extra COD fee (৳)</span><input className="input" name="codFee" inputMode="decimal" defaultValue={initial.codFee} {...bad("codFee")} data-testid="cod-fee" /></label>
          <label className="field" style={{ marginBottom: 0 }}><span className="label">Allow COD up to (৳) <span className="opt">(optional)</span></span><input className="input" name="codMaxAmount" inputMode="decimal" defaultValue={initial.codMaxAmount ?? ""} {...bad("codMaxAmount")} data-testid="cod-max" /></label>
        </div>
      </section>

      {([
        ["bkash", "bKash", initial.bkashEnabled, initial.bkashNumber, initial.bkashKind, initial.bkashInstruction],
        ["nagad", "Nagad", initial.nagadEnabled, initial.nagadNumber, initial.nagadKind, initial.nagadInstruction],
      ] as const).map(([k, name, enabled, number, kindValue, instruction]) => (
        <section className="card" key={k}>
          <label className="check"><input type="checkbox" name={`${k}Enabled`} defaultChecked={enabled} data-testid={`${k}-enabled`} /><span><b>{name}</b><br /><span className="muted" style={{ fontSize: 13 }}>Customer sends money, then enters the TrxID at checkout. You confirm it.</span></span></label>
          <div className="row-2" style={{ marginTop: 12 }}>
            <label className="field"><span className="label">{name} number</span><input className="input" name={`${k}Number`} inputMode="tel" defaultValue={number} {...bad(`${name} number`)} data-testid={`${k}-number`} /></label>
            <label className="field"><span className="label">Account type</span>
              <select className="select" name={`${k}Kind`} defaultValue={kindValue}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
          <label className="field" style={{ marginBottom: 0 }}><span className="label">Extra instruction shown to customers <span className="opt">(optional)</span></span><input className="input" name={`${k}Instruction`} defaultValue={instruction} maxLength={300} /></label>
        </section>
      ))}

      <section className="card">
        <label className="field" style={{ marginBottom: 0 }}><span className="label">Note under the payment steps <span className="opt">(optional)</span></span><input className="input" name="paymentNote" defaultValue={initial.paymentNote} maxLength={200} placeholder="We confirm within 2 hours." /></label>
      </section>
      <div className="notice info">Customers send money to these numbers. If someone else gets into your account and changes them, your payments go to them, so every change here is recorded in the audit log.</div>
      {state.error && <div className="notice bad" role="alert" data-testid="payments-error">{state.error}</div>}
      {state.ok && <div className="notice good" role="status" data-testid="payments-saved">Payment settings saved.</div>}
      <SubmitButton className="btn btn-primary btn-lg">Save payment settings</SubmitButton>
    </form>
  );
}
