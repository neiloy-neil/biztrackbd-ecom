import Link from "next/link";
import { getUsageMeters, type StaffActor, type UsageMeterRow } from "@biztrackbd/core";

const COLOR: Record<string, string> = {
  ok: "var(--brand)", warning: "var(--warning)", at_limit: "var(--danger)", over: "var(--warning)", exceeded: "var(--danger)", unlimited: "var(--success)",
};

const amount = (r: UsageMeterRow, n: number) => `${n.toLocaleString("en-IN")}${r.unit ? ` ${r.unit}` : ""}`;

function Row({ r }: { r: UsageMeterRow }) {
  const width = Math.min(r.percent ?? 0, 100);
  return (
    <div data-testid={`usage-${r.key}`} data-state={r.state} style={{ marginBottom: 18 }}>
      <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong>{r.label}</strong>
        <span className="muted">{r.limit == null ? `${amount(r, r.used)} used, no limit` : `${amount(r, r.used)} of ${amount(r, r.limit)}`}</span>
      </div>
      {r.limit != null && (
        <div style={{ height: 8, background: "var(--tint)", borderRadius: 99, marginTop: 6 }} role="progressbar" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100} aria-label={r.label}>
          <div style={{ width: `${width}%`, height: 8, borderRadius: 99, background: COLOR[r.state] }} />
        </div>
      )}
      {r.note && (
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>
          {r.note} {r.action && <Link href={r.action.href} className="link" prefetch={false}>{r.action.label} →</Link>}
        </p>
      )}
    </div>
  );
}

/** Every metered item with how much is used, for the plan and usage screen. */
export async function UsageMetersCard({ tenantId, actor }: { tenantId: string; actor: StaffActor }) {
  const m = await getUsageMeters(tenantId, actor);
  return (
    <section className="card" style={{ marginTop: 14 }} data-testid="usage-meters" aria-label="Plan usage">
      {m.rows.map((r) => <Row key={r.key} r={r} />)}
    </section>
  );
}

/** A short banner on the dashboard, only when something is close to its limit. Shows nothing when all is well. */
export async function UsageWarnings({ tenantId, actor }: { tenantId: string; actor: StaffActor }) {
  const m = await getUsageMeters(tenantId, actor).catch(() => null);
  if (!m || m.attention.length === 0) return null;
  const top = m.attention.slice(0, 3);
  return (
    <section className="notice" role="status" data-testid="usage-warnings" style={{ display: "grid", gap: 6 }}>
      {top.map((r) => (
        <div key={r.key}>
          <b>{r.label}:</b> {r.note} {r.action && <Link href={r.action.href} className="link" prefetch={false}>{r.action.label} →</Link>}
        </div>
      ))}
      {m.attention.length > top.length && <Link href="/billing" className="link" prefetch={false}>See all usage →</Link>}
    </section>
  );
}
