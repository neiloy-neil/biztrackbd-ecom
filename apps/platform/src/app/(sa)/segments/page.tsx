import type { Metadata } from "next";
import Link from "next/link";
import { canPlatform, listCrmTeam, listSegments, runSegment, DomainError, type SegmentFilterInput } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { friendlyDate } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { deleteSegmentAction, saveSegmentAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Segments" };

const HEALTHS = [["CHURNING", "About to leave"], ["AT_RISK", "At risk"], ["NEW", "New"], ["HEALTHY", "Healthy"]] as const;
const PLANS = ["STARTER", "PRO", "BUSINESS"] as const;
const STAGES = [["NEW", "New lead"], ["CONTACTED", "Contacted"], ["DEMO_IN_PROGRESS", "Demo"], ["HOT_LEAD", "Hot lead"], ["CONVERTED", "Converted"], ["LOST", "Lost"]] as const;
const PILL: Record<string, string> = { CHURNING: "bad", AT_RISK: "warn", NEW: "info", HEALTHY: "ok" };
const LABEL: Record<string, string> = Object.fromEntries(HEALTHS);
const field = { height: 40, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8, background: "#fff" } as const;

const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/** The filter the builder form sent in the address, keeping only what was filled in. */
function filterFromQuery(sp: Record<string, string | string[] | undefined>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  const health = many(sp.health), plans = many(sp.plans), stages = many(sp.stages);
  if (health.length) f.health = health;
  if (plans.length) f.plans = plans;
  if (stages.length) f.stages = stages;
  for (const k of ["billing", "assignee", "q"] as const) { const v = one(sp[k])?.trim(); if (v) f[k] = v; }
  for (const k of ["trialEndsInDays", "noLoginDays"] as const) { const v = one(sp[k])?.trim(); if (v) f[k] = Number(v); }
  for (const k of ["noOrders30d", "smsOut"] as const) if (one(sp[k]) === "1") f[k] = true;
  return f;
}

const describe = (f: SegmentFilterInput, owners: Map<string, string>): string => {
  const out: string[] = [];
  if (f.health?.length) out.push(f.health.map((h) => LABEL[h]).join(" or "));
  if (f.billing) out.push(f.billing === "paying" ? "paying" : "on trial");
  if (f.plans?.length) out.push(f.plans.join(" or "));
  if (f.stages?.length) out.push(`stage ${f.stages.join(" or ").toLowerCase().replace(/_/g, " ")}`);
  if (f.assignee) out.push(f.assignee === "none" ? "nobody looking after" : `looked after by ${owners.get(f.assignee) ?? "someone"}`);
  if (f.trialEndsInDays !== undefined) out.push(`trial ends within ${f.trialEndsInDays} days`);
  if (f.noOrders30d) out.push("no orders in 30 days");
  if (f.noLoginDays !== undefined) out.push(`no login for ${f.noLoginDays}+ days`);
  if (f.smsOut) out.push("out of free SMS");
  if (f.q) out.push(`name has "${f.q}"`);
  return out.join(", ") || "every store";
};

export default async function Segments({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("tenants");
  const canEdit = canPlatform(s.user.role, "tenants", "edit");
  const team = await listCrmTeam(s.actor);
  const owners = new Map(team.map((u) => [u.id, u.name]));
  const saved = await listSegments(s.actor);
  const runId = one(sp.run);
  const building = ["health", "plans", "stages", "billing", "assignee", "q", "trialEndsInDays", "noLoginDays", "noOrders30d", "smsOut", "go"].some((k) => sp[k] !== undefined);

  let result: Awaited<ReturnType<typeof runSegment>> | null = null;
  let error = one(sp.err) ?? null;
  try {
    if (runId) result = await runSegment(s.actor, { id: runId });
    else if (building) result = await runSegment(s.actor, { filter: filterFromQuery(sp) });
  } catch (e) {
    if (e instanceof DomainError) error = e.message; else throw e;
  }
  const cur: Record<string, unknown> = result ? (result.filter as Record<string, unknown>) : {};
  const has = (k: string, v: string) => Array.isArray(cur[k]) && (cur[k] as string[]).includes(v);

  return (
    <div className="stack">
      <div className="page-head"><h1>Segments</h1></div>
      <p className="page-sub">Groups of stores to work as a list. Pick filters, see who matches, and save the group to come back to it.</p>
      {error && <div className="notice bad" role="alert">{error}</div>}
      {one(sp.saved) && <div className="notice good" role="status">Segment saved.</div>}
      {one(sp.deleted) && <div className="notice good" role="status">Segment deleted.</div>}

      <section className="card" style={{ padding: 16 }} aria-labelledby="saved-h" data-testid="saved-segments">
        <h2 id="saved-h" style={{ margin: "0 0 10px", fontSize: 17 }}>Saved segments ({saved.length})</h2>
        {saved.length === 0 ? <p className="muted" style={{ margin: 0 }}>None yet. Build one below and save it.</p> : (
          <div style={{ display: "grid", gap: 8 }}>
            {saved.map((g) => (
              <div key={g.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid var(--line)" }} data-testid={`segment-${g.id}`}>
                <div style={{ flex: "1 1 260px" }}>
                  <Link href={`/segments?run=${g.id}`} prefetch={false} style={{ fontWeight: 700, color: "var(--ink)" }}>{g.name}</Link> <span className="pill info">{g.count} stores</span>
                  <div className="muted" style={{ fontSize: 12.5 }}>{describe(g.filter, owners)}</div>
                </div>
                {canEdit && <form action={deleteSegmentAction.bind(null, g.id)}><SubmitButton className="btn btn-secondary btn-sm" pending="…">Delete</SubmitButton></form>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 16 }} aria-labelledby="build-h">
        <h2 id="build-h" style={{ margin: "0 0 10px", fontSize: 17 }}>Build a segment</h2>
        <form style={{ display: "grid", gap: 14 }} data-testid="segment-builder">
          <input type="hidden" name="go" value="1" />
          <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Health</legend>
            {HEALTHS.map(([v, l]) => <label key={v} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="health" value={v} defaultChecked={has("health", v)} />{l}</label>)}
          </fieldset>
          <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Plan</legend>
            {PLANS.map((v) => <label key={v} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="plans" value={v} defaultChecked={has("plans", v)} />{v}</label>)}
          </fieldset>
          <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Stage</legend>
            {STAGES.map(([v, l]) => <label key={v} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="stages" value={v} defaultChecked={has("stages", v)} />{l}</label>)}
          </fieldset>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Billing
              <select name="billing" defaultValue={(cur.billing as string) ?? ""} style={field}><option value="">Any</option><option value="paying">Paying</option><option value="trial">On trial</option></select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Looked after by
              <select name="assignee" defaultValue={(cur.assignee as string) ?? ""} style={field}><option value="">Anyone</option><option value="none">Nobody</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Trial ends within (days)
              <input name="trialEndsInDays" type="number" min={0} max={30} defaultValue={(cur.trialEndsInDays as number | undefined) ?? ""} style={{ ...field, width: 110 }} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>No login for (days)
              <input name="noLoginDays" type="number" min={1} max={365} defaultValue={(cur.noLoginDays as number | undefined) ?? ""} style={{ ...field, width: 110 }} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Name contains
              <input name="q" maxLength={60} defaultValue={(cur.q as string) ?? ""} style={{ ...field, width: 160 }} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="noOrders30d" value="1" defaultChecked={cur.noOrders30d === true} />No orders in 30 days</label>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="smsOut" value="1" defaultChecked={cur.smsOut === true} />Out of free SMS</label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit">Show stores</button>
            {building && <Link href="/segments" className="link" prefetch={false} style={{ alignSelf: "center" }}>Clear</Link>}
          </div>
        </form>
      </section>

      {result && (
        <section className="card" style={{ padding: 0, overflowX: "auto" }} aria-labelledby="result-h" data-testid="segment-result">
          <div style={{ padding: "14px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <h2 id="result-h" style={{ margin: 0, fontSize: 17 }}>{result.name ?? "Preview"}: {result.total} store{result.total === 1 ? "" : "s"}</h2>
            {!runId && canEdit && Object.keys(result.filter).length > 0 && (
              <form action={saveSegmentAction} style={{ display: "flex", gap: 8 }}>
                <input type="hidden" name="filter" value={JSON.stringify(result.filter)} />
                <input name="name" required minLength={2} maxLength={60} placeholder="Name this segment" aria-label="Segment name" style={field} />
                <SubmitButton className="btn btn-secondary btn-sm" pending="Saving…">Save segment</SubmitButton>
              </form>
            )}
          </div>
          {result.rows.length === 0 ? <p className="muted" style={{ padding: "0 16px 16px", margin: 0 }}>No stores match.</p> : (
            <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead><tr style={{ background: "var(--bg)", textAlign: "left", fontSize: 12, color: "var(--ink-3)" }}>
                <th scope="col" style={{ padding: "10px 16px" }}>STORE</th><th scope="col">HEALTH</th><th scope="col">WHY</th><th scope="col">STAGE</th><th scope="col">LOOKED AFTER BY</th><th scope="col" style={{ paddingRight: 16 }}>LAST LOGIN</th>
              </tr></thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.tenantId} style={{ borderTop: "1px solid var(--line)", verticalAlign: "top" }}>
                    <td style={{ padding: "12px 16px" }}><Link href={`/tenants/${r.tenantId}`} prefetch={false} style={{ fontWeight: 700, color: "var(--ink)" }}>{r.name}</Link><div className="muted" style={{ fontSize: 12 }}>{r.subdomain} · {r.planTier} · {r.paying ? "paying" : "trial"}</div></td>
                    <td style={{ paddingTop: 12 }}><span className={`pill ${PILL[r.health]}`}>{LABEL[r.health]}</span></td>
                    <td style={{ paddingTop: 12, maxWidth: 280 }}>{r.reasons.length ? r.reasons.map((x) => <div key={x}>{x}</div>) : <span className="muted">Nothing to flag</span>}</td>
                    <td style={{ paddingTop: 12 }}>{r.leadStage.toLowerCase().replace(/_/g, " ")}</td>
                    <td style={{ paddingTop: 12 }}>{r.assigneeId ? owners.get(r.assigneeId) ?? "Former member" : <span className="muted">Nobody</span>}</td>
                    <td style={{ paddingTop: 12, paddingRight: 16 }}>{r.lastLoginAt ? friendlyDate(r.lastLoginAt) : <span className="muted">Never</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {result.total > result.rows.length && <p className="muted" style={{ padding: "8px 16px 16px", margin: 0 }}>Showing the first {result.rows.length} of {result.total}.</p>}
        </section>
      )}
    </div>
  );
}
