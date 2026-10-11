"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { BD_GEO } from "@biztrackbd/core/geo";
import { SubmitButton } from "@/components/ui";
import { saveZoneAction, type ZoneState } from "./actions";

export interface ZoneValues { name: string; districts: string[]; rate: number; freeOverAmount: number | null; etaMinDays: number; etaMaxDays: number }

export function ZoneForm({ id, initial, taken }: { id: string | null; initial: ZoneValues; taken: Record<string, string> }) {
  const [state, action] = useActionState<ZoneState, FormData>(saveZoneAction.bind(null, id), {});
  const [allOther, setAllOther] = useState(initial.districts.includes("*"));
  const [picked, setPicked] = useState<string[]>(initial.districts.filter((d) => d !== "*"));
  const toggle = (d: string) => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  return (
    <form action={action} className="card" data-testid="zone-form">
      <h2>{id ? "Edit zone" : "New zone"}</h2>
      <label className="field"><span className="label">Zone name</span><input className="input" name="name" defaultValue={initial.name} required placeholder="Inside Dhaka city" data-testid="z-name" /></label>
      <label className="check" style={{ marginBottom: 8 }}><input type="checkbox" name="allOther" checked={allOther} onChange={(e) => setAllOther(e.target.checked)} data-testid="z-all" /><span>All other districts <span className="muted">(everything not in another zone)</span></span></label>
      {!allOther && (
        <div className="field">
          <span className="label">Districts</span>
          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--line-2)", borderRadius: 10, padding: 8 }} data-testid="z-districts">
            {BD_GEO.map((div) => (
              <div key={div.name}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 700, margin: "6px 4px 2px" }}>{div.name}</div>
                {div.districts.map((d) => {
                  const other = taken[d.name];
                  return (
                    <label key={d.name} className="check" style={{ minHeight: 32, opacity: other ? 0.5 : 1 }}>
                      <input type="checkbox" name="districts" value={d.name} checked={picked.includes(d.name)} disabled={Boolean(other)} onChange={() => toggle(d.name)} />
                      <span>{d.name}{other ? <span className="muted"> · in {other}</span> : null}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="hint">{picked.length} selected</div>
        </div>
      )}
      <div className="row-2">
        <label className="field"><span className="label">Delivery charge (৳)</span><input className="input" name="rate" inputMode="decimal" defaultValue={initial.rate} required data-testid="z-rate" /></label>
        <label className="field"><span className="label">Free over (৳) <span className="opt">(optional)</span></span><input className="input" name="freeOverAmount" inputMode="decimal" defaultValue={initial.freeOverAmount ?? ""} data-testid="z-free" /></label>
      </div>
      <div className="row-2">
        <label className="field"><span className="label">Arrives in (days, from)</span><input className="input" name="etaMinDays" inputMode="numeric" defaultValue={initial.etaMinDays} required /></label>
        <label className="field"><span className="label">to</span><input className="input" name="etaMaxDays" inputMode="numeric" defaultValue={initial.etaMaxDays} required /></label>
      </div>
      {state.error && <div className="err" role="alert" data-testid="zone-error">{state.error}</div>}
      <div className="row" style={{ marginTop: 10 }}>
        <SubmitButton className="btn btn-primary" pending="Saving…">Save zone</SubmitButton>
        <Link href="/settings/shipping" className="btn btn-secondary" prefetch={false}>Cancel</Link>
      </div>
    </form>
  );
}
