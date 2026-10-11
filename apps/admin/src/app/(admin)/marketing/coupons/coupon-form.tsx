"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui";
import { saveCouponAction, type CouponState } from "./actions";

export interface CouponValues { code: string; type: string; value: number; minOrderValue: number | null; usageLimit: number | null; perCustomerLimit: number; startsAt: string; expiresAt: string }

const randomCode = () => `SAVE${Math.floor(10 + Math.random() * 90)}${"ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]}`;

export function CouponForm({ id, initial }: { id: string | null; initial: CouponValues }) {
  const [state, action] = useActionState<CouponState, FormData>(saveCouponAction.bind(null, id), {});
  const [type, setType] = useState(initial.type);
  const [code, setCode] = useState(initial.code);
  const err = (f: string) => (state.field === f ? { "aria-invalid": true as const } : {});
  return (
    <form action={action} className="card" data-testid="coupon-form">
      <h2>{id ? "Edit coupon" : "New coupon"}</h2>
      <label className="field"><span className="label">Code</span>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input className="input" name="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={20} style={{ textTransform: "uppercase" }} data-testid="c-code" {...err("code")} />
          <button type="button" className="btn btn-secondary" onClick={() => setCode(randomCode())}>Generate</button>
        </div>
      </label>
      <div className="field"><span className="label">Type</span>
        <div className="chips" role="group">
          {[["PERCENTAGE", "Percent"], ["FIXED_AMOUNT", "Fixed taka"], ["FREE_SHIPPING", "Free delivery"]].map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={type === v} onClick={() => setType(v!)}>{l}</button>)}
        </div>
        <input type="hidden" name="type" value={type} />
      </div>
      {type !== "FREE_SHIPPING" && <label className="field"><span className="label">Value ({type === "PERCENTAGE" ? "%" : "৳"})</span><input className="input" name="value" inputMode="decimal" defaultValue={initial.value || ""} required data-testid="c-value" {...err("value")} /></label>}
      <div className="row-2">
        <label className="field"><span className="label">Minimum order (৳) <span className="opt">(optional)</span></span><input className="input" name="minOrderValue" inputMode="decimal" defaultValue={initial.minOrderValue ?? ""} /></label>
        <label className="field"><span className="label">Total uses <span className="opt">(optional)</span></span><input className="input" name="usageLimit" inputMode="numeric" defaultValue={initial.usageLimit ?? ""} /></label>
      </div>
      <label className="field"><span className="label">Uses per customer</span><input className="input" name="perCustomerLimit" inputMode="numeric" defaultValue={initial.perCustomerLimit} required /></label>
      <div className="row-2">
        <label className="field"><span className="label">Starts</span><input className="input" type="date" name="startsAt" defaultValue={initial.startsAt} /></label>
        <label className="field"><span className="label">Ends <span className="opt">(optional)</span></span><input className="input" type="date" name="expiresAt" defaultValue={initial.expiresAt} {...err("expiresAt")} /></label>
      </div>
      {state.error && <div className="err" role="alert" data-testid="coupon-error">{state.error}</div>}
      <div className="row" style={{ marginTop: 10 }}>
        <SubmitButton className="btn btn-primary" pending="Saving…">Save coupon</SubmitButton>
        <Link href="/marketing/coupons" className="btn btn-secondary" prefetch={false}>Cancel</Link>
      </div>
    </form>
  );
}
