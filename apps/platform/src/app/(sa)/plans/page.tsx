import type { Metadata } from "next";
import { canPlatform, listPlans } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { savePlanAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plans" };

const LIMITS: [string, string][] = [["products", "Products"], ["ordersPerMonth", "Orders a month"], ["staff", "Staff"], ["storageGb", "Photo storage (GB)"], ["smsCredits", "SMS credits"], ["landingPages", "Landing pages"]];

export default async function Plans({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("plans");
  const plans = await listPlans(s.actor);
  const canEdit = canPlatform(s.user.role, "plans", "edit");
  return (
    <>
      <div className="page-head"><h1>Plans</h1></div>
      <p className="page-sub">Prices and limits live here, not in code. A change applies at once to every store on the plan. Leave a limit blank for unlimited.</p>
      {one(sp.saved) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{one(sp.saved)} saved.</div>}
      {one(sp.err) && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{one(sp.err)}</div>}
      <div className="stack">
        {plans.map((p) => (
          <form key={p.tier} action={savePlanAction.bind(null, p.tier)} className="card stack" data-testid={`plan-${p.tier}`}>
            <div className="card-head"><h2>{p.name}</h2><span className="muted">{p.stores} {p.stores === 1 ? "store" : "stores"}</span></div>
            <div className="row-3">
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Monthly price (৳)</span><input className="input" name="priceMonthly" inputMode="decimal" defaultValue={p.priceMonthly} disabled={!canEdit} required /></label>
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Yearly price (৳)</span><input className="input" name="priceYearly" inputMode="decimal" defaultValue={p.priceYearly} disabled={!canEdit} required /></label>
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Trial days</span><input className="input" name="trialDays" inputMode="numeric" defaultValue={p.trialDays} disabled={!canEdit} required /></label>
            </div>
            <div className="row-3">
              {LIMITS.map(([k, l]) => (
                <label key={k} className="field" style={{ marginBottom: 0 }}><span className="label">{l}</span><input className="input" name={k} inputMode="numeric" defaultValue={(p.limits as Record<string, number | null>)[k] ?? ""} placeholder="Unlimited" disabled={!canEdit} /></label>
              ))}
            </div>
            <label className="row" style={{ flexWrap: "nowrap", gap: 8 }}><input type="checkbox" name="isPublic" defaultChecked={p.isPublic} disabled={!canEdit} style={{ width: 20, height: 20 }} /> Shown on the pricing page and in signup</label>
            {canEdit && <div><SubmitButton className="btn btn-primary" pending="Saving…">Save {p.name}</SubmitButton></div>}
          </form>
        ))}
      </div>
    </>
  );
}
