"use client";

import { useActionState, useMemo, useState } from "react";
import { BD_GEO } from "@biztrackbd/core/geo";
import { SubmitButton } from "@/components/ui";
import { addressAction, rejectAction, type AddressState, type RejectState } from "./actions";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button" className="btn btn-secondary btn-sm"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked */ } }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

/** "Payment not received" asks for a short reason first, so the team can see why later. */
export function RejectForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState<RejectState, FormData>(rejectAction.bind(null, orderId), {});
  return (
    <details className="stack">
      <summary className="btn btn-danger btn-block" style={{ listStyle: "none" }}>Payment not received</summary>
      <form action={action} className="stack" style={{ marginTop: 12 }}>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="label">Why? (the team can see this)</span>
          <input className="input" name="reason" required minLength={3} maxLength={200} placeholder="Not in my bKash history" />
        </label>
        {state.error && <div className="err" role="alert">{state.error}</div>}
        <SubmitButton className="btn btn-danger btn-block" pending="Saving…">Mark as not received</SubmitButton>
      </form>
    </details>
  );
}

export interface AddressValue { name: string; line: string; area: string; district: string; division: string }

export function AddressEditor({ orderId, value }: { orderId: string; value: AddressValue }) {
  const [state, action] = useActionState<AddressState, FormData>(addressAction.bind(null, orderId), {});
  const [division, setDivision] = useState(value.division);
  const [district, setDistrict] = useState(value.district);
  const districts = useMemo(() => BD_GEO.find((d) => d.name === division)?.districts ?? [], [division]);
  const upazilas = useMemo(() => districts.find((d) => d.name === district)?.upazilas ?? [], [districts, district]);
  return (
    <details>
      <summary className="link" style={{ cursor: "pointer" }}>Edit address</summary>
      <form action={action} className="stack" style={{ marginTop: 12 }}>
        <label className="field"><span className="label">Name</span><input className="input" name="name" defaultValue={value.name} /></label>
        <div className="row-2">
          <label className="field"><span className="label">Division</span>
            <select className="select" name="division" value={division} onChange={(e) => { const v = e.target.value; setDivision(v); setDistrict(BD_GEO.find((d) => d.name === v)?.districts[0]?.name ?? ""); }}>
              {BD_GEO.map((d) => <option key={d.name}>{d.name}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">District</span>
            <select className="select" name="district" value={district} onChange={(e) => setDistrict(e.target.value)}>{districts.map((d) => <option key={d.name}>{d.name}</option>)}</select>
          </label>
        </div>
        <label className="field"><span className="label">Upazila or thana</span>
          <select className="select" name="area" defaultValue={upazilas.includes(value.area) ? value.area : ""} key={`${division}-${district}`} required>
            <option value="" disabled>Choose…</option>{upazilas.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label className="field"><span className="label">House, road and area</span><textarea className="textarea" name="line" defaultValue={value.line} required minLength={5} /></label>
        {state.error && <div className="err" role="alert">{state.error}</div>}
        {state.ok && <div className="ok" role="status">Address saved.</div>}
        <SubmitButton className="btn btn-primary btn-block">Save address</SubmitButton>
      </form>
    </details>
  );
}
