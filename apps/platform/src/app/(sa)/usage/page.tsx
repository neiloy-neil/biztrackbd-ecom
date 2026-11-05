import type { Metadata } from "next";
import Link from "next/link";
import { STORE_HEALTHS, STORE_HEALTH_PAGE_SIZE, listStoreHealth, type StoreHealth } from "@biztrackbd/core";
import { Pager } from "@/components/ui";
import { friendlyDate } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store health and usage" };

const LABEL: Record<StoreHealth, string> = { CHURNING: "About to leave", AT_RISK: "At risk", NEW: "New", HEALTHY: "Healthy" };
const PILL: Record<StoreHealth, string> = { CHURNING: "bad", AT_RISK: "warn", NEW: "info", HEALTHY: "ok" };
const PLANS = ["STARTER", "PRO", "BUSINESS"];

const qs = (p: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : "";
};

export default async function UsagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("tenants");
  const healthRaw = one(sp.health);
  const health = (STORE_HEALTHS as string[]).includes(healthRaw ?? "") ? (healthRaw as StoreHealth) : "all";
  const planRaw = one(sp.plan);
  const plan = PLANS.includes(planRaw ?? "") ? planRaw : undefined;
  const q = (one(sp.q) ?? "").trim().slice(0, 60);
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1);
  const v = await listStoreHealth(s.actor, { health, plan, q, page });
  const now = new Date();
  const keep = { plan, q: q || undefined };

  return (
    <div className="stack">
      <div className="page-head"><h1>Store health and usage</h1></div>
      <p className="page-sub">Who is thriving, who is drifting and who is about to leave. Worst first. Built from logins, orders, plan dates and SMS used.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }} data-testid="health-summary">
        {STORE_HEALTHS.map((h) => (
          <Link key={h} href={`/usage${qs({ ...keep, health: health === h ? undefined : h })}`} prefetch={false} className="card" style={{ padding: 14, textDecoration: "none", color: "inherit", outline: health === h ? "2px solid var(--brand)" : undefined }} data-testid={`health-${h}`}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{LABEL[h].toUpperCase()}</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{v.counts[h]}</div>
          </Link>
        ))}
        <div className="card" style={{ padding: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>PAYING / ON TRIAL</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{v.counts.paying} <span className="muted" style={{ fontSize: 18 }}>/ {v.counts.trial}</span></div>
        </div>
      </div>

      <form className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }} role="search">
        <input type="hidden" name="health" value={health === "all" ? "" : health} />
        <input name="q" defaultValue={q} placeholder="Search store name or subdomain" aria-label="Search stores" style={{ height: 40, minWidth: 220, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 8 }} />
        <select name="plan" defaultValue={plan ?? ""} aria-label="Plan" style={{ height: 40, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8 }}>
          <option value="">All plans</option>
          {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" type="submit">Filter</button>
        {(health !== "all" || plan || q) && <Link href="/usage" className="link" prefetch={false}>Clear</Link>}
      </form>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {v.rows.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }} className="muted" data-testid="health-empty">No stores match.</div>
        ) : (
          <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse", fontSize: 13.5 }} data-testid="health-table">
            <thead>
              <tr style={{ background: "var(--bg)", textAlign: "left", fontSize: 12, color: "var(--ink-3)" }}>
                <th scope="col" style={{ padding: "10px 16px" }}>STORE</th>
                <th scope="col">HEALTH</th>
                <th scope="col">WHY</th>
                <th scope="col">LAST LOGIN</th>
                <th scope="col" style={{ textAlign: "right" }}>ORDERS 30D</th>
                <th scope="col" style={{ textAlign: "right" }}>PRODUCTS</th>
                <th scope="col" style={{ textAlign: "right", paddingRight: 16 }}>SMS</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.tenantId} style={{ borderTop: "1px solid var(--line)", verticalAlign: "top" }} data-testid={`health-row-${r.subdomain}`}>
                  <td style={{ padding: "12px 16px" }}>
                    <Link href={`/tenants/${r.tenantId}`} style={{ fontWeight: 700, color: "var(--ink)" }} prefetch={false}>{r.name}</Link>
                    <div className="muted" style={{ fontSize: 12 }}>{r.subdomain} · {r.planTier} · {r.paying ? "paying" : "trial"}</div>
                  </td>
                  <td style={{ paddingTop: 12 }}><span className={`pill ${PILL[r.health]}`}>{LABEL[r.health]}</span></td>
                  <td style={{ paddingTop: 12, maxWidth: 320 }}>{r.reasons.length === 0 ? <span className="muted">Nothing to flag</span> : r.reasons.map((x) => <div key={x}>{x}</div>)}</td>
                  <td style={{ paddingTop: 12 }}>{r.lastLoginAt ? friendlyDate(r.lastLoginAt, now) : <span className="muted">Never</span>}</td>
                  <td className="num" style={{ textAlign: "right", paddingTop: 12 }}>{r.orders30d}</td>
                  <td className="num" style={{ textAlign: "right", paddingTop: 12 }}>{r.productCount}</td>
                  <td className="num" style={{ textAlign: "right", padding: "12px 16px 0 0" }}>{r.smsLimit === null ? r.smsUsed : `${r.smsUsed}/${r.smsLimit}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Pager page={v.page} pageSize={STORE_HEALTH_PAGE_SIZE} total={v.total} path="/usage" params={{ health: health === "all" ? undefined : health, plan, q: q || undefined }} />
    </div>
  );
}
