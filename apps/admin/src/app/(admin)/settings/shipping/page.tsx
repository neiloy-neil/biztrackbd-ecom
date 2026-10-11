import type { Metadata } from "next";
import Link from "next/link";
import { COURIER_PROVIDERS, can, getCourierRates, listConnectedCouriers, listZones } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { deleteZoneAction, saveRatesAction } from "./actions";
import { ZoneForm } from "./zone-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shipping" };

export default async function Shipping({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders");
  const canEdit = can(s.user.role, "orders", "edit");
  const [zones, rates, connected] = await Promise.all([listZones(s.tenantId, s.actor), getCourierRates(s.tenantId, s.actor), listConnectedCouriers(s.tenantId)]);
  const editing = zones.find((z) => z.id === one(sp.edit));
  const creating = one(sp.new) !== undefined;
  // A district can be in one zone only: the form disables districts that already belong to another zone.
  const taken: Record<string, string> = {};
  for (const z of zones) if (z.id !== editing?.id) for (const d of z.districts) if (d !== "*") taken[d] = z.name;
  const covered = zones.some((z) => z.districts.includes("*"));

  return (
    <>
      <div className="page-head"><h1>Delivery charges</h1><div className="actions">{canEdit && <Link href="/settings/shipping?new=1" className="btn btn-primary" prefetch={false} data-testid="new-zone">Add zone</Link>}</div></div>
      <p className="page-sub">Set what customers pay for delivery. The right charge is picked from their district at checkout.</p>
      {one(sp.saved) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Zone saved.</div>}
      {one(sp.deleted) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Zone deleted.</div>}
      {one(sp.rates) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Courier charges saved.</div>}
      {one(sp.err) && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{one(sp.err)}</div>}
      {!covered && zones.length > 0 && <div className="notice" style={{ marginBottom: 12 }}>No zone covers "all other districts". Customers in districts you have not listed cannot order. Add a zone for the rest of the country.</div>}
      {zones.length === 0 && <div className="notice bad" style={{ marginBottom: 12 }}>You have no delivery zones, so customers cannot check out. Add one.</div>}

      <div className="split">
        <div className="col">
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Delivery zones, scrolls sideways on a small screen">
          <table className="table" data-testid="zones-table">
            <thead><tr><th>Zone</th><th>Areas</th><th className="r">Charge</th><th className="r">Free over</th><th>Time</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} data-testid="zone-row">
                  <td><b>{z.name}</b></td>
                  <td className="muted" style={{ maxWidth: 220 }}>{z.districts.includes("*") ? "All other districts" : z.districts.length > 4 ? `${z.districts.slice(0, 4).join(", ")} + ${z.districts.length - 4} more` : z.districts.join(", ")}</td>
                  <td className="r num">{taka(z.rate)}</td><td className="r num">{z.freeOverAmount != null ? taka(z.freeOverAmount) : "—"}</td>
                  <td className="muted">{z.etaMinDays} to {z.etaMaxDays} days</td>
                  {canEdit && <td><Link href={`/settings/shipping?edit=${z.id}`} className="link" prefetch={false}>Edit</Link></td>}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="card" style={{ marginTop: 14 }}>
            <h2>Courier accounts</h2>
            <p className="muted">
              {connected.length > 0 ? `Connected: ${connected.map((c) => c.label).join(", ")}. ` : "No courier connected yet. "}
              Add Steadfast, Pathao or RedX with your own keys in <Link href="/settings/integrations" className="link" prefetch={false}>Integrations</Link>, then book parcels from any order.
            </p>
          </div>
          <form action={saveRatesAction} className="card stack" style={{ marginTop: 14 }} data-testid="rates-form">
            <h2>What your courier charges you</h2>
            <p className="muted" style={{ fontSize: 13.5 }}>This is not what customers pay. We use it to check courier payout statements and to estimate your profit until the real figures arrive.</p>
            <div className="row-3">
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Inside Dhaka (৳)</span><input className="input" name="inside" inputMode="decimal" defaultValue={rates.inside} disabled={!canEdit} required /></label>
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Outside Dhaka (৳)</span><input className="input" name="outside" inputMode="decimal" defaultValue={rates.outside} disabled={!canEdit} required /></label>
              <label className="field" style={{ marginBottom: 0 }}><span className="label">COD fee (%)</span><input className="input" name="codPercent" inputMode="decimal" defaultValue={rates.codPercent} disabled={!canEdit} required /></label>
            </div>
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Courier chosen first on an order</span>
              <select className="select" name="defaultCourier" defaultValue={rates.defaultCourier ?? ""} disabled={!canEdit}>
                <option value="">First one connected</option>
                {COURIER_PROVIDERS.map((c) => <option key={c} value={c}>{c === "STEADFAST" ? "Steadfast" : c === "PATHAO" ? "Pathao" : "RedX"}</option>)}
              </select>
            </label>
            {canEdit && <div><SubmitButton className="btn btn-primary" pending="Saving…">Save courier charges</SubmitButton></div>}
          </form>
        </div>
        <div className="col stack">
          {canEdit && (creating || editing) && (
            <>
              <ZoneForm key={editing?.id ?? "new"} id={editing?.id ?? null} taken={taken}
                initial={editing ? { name: editing.name, districts: editing.districts, rate: editing.rate, freeOverAmount: editing.freeOverAmount, etaMinDays: editing.etaMinDays, etaMaxDays: editing.etaMaxDays } : { name: "", districts: [], rate: 100, freeOverAmount: null, etaMinDays: 2, etaMaxDays: 4 }} />
              {editing && <form action={deleteZoneAction.bind(null, editing.id)} className="card"><SubmitButton className="btn btn-danger" pending="Deleting…">Delete this zone</SubmitButton></form>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
