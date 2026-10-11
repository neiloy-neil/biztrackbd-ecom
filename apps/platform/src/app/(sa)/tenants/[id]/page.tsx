import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ACCESS_LABELS, canPlatform, getTenantDetail } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly, dateTime, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { extendAction, planAction, quarantineAction, reactivateAction, suspendAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store" };

const DONE: Record<string, string> = { suspended: "Store switched off.", reactivated: "Store switched back on.", extended: "Trial extended.", plan: "Plan changed.", approved: "Flagged store approved." };

export default async function Tenant({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireAccess("tenants");
  const t = await getTenantDetail(s.actor, id).catch(() => null);
  if (!t) notFound();
  const canSuspend = canPlatform(s.user.role, "suspend", "edit");
  const canAdjust = canPlatform(s.user.role, "adjust", "edit");
  const a = t.access;
  const err = one(sp.err);
  const done = one(sp.done);

  return (
    <>
      <Link href="/tenants" className="back" prefetch={false}>← Stores</Link>
      <div className="page-head">
        <h1 data-testid="tenant-title">{t.name}</h1>
        <div className="row"><span className={`pill ${a.state === "ACTIVE" || a.state === "TRIAL" ? "ok" : a.state === "GRACE" ? "warn" : "bad"}`} data-testid="tenant-state">{ACCESS_LABELS[a.state]}</span>{t.quarantined && <span className="pill warn">Flagged for review</span>}</div>
      </div>
      <p className="page-sub">{t.subdomain} · {t.tier.charAt(0) + t.tier.slice(1).toLowerCase()} plan · since {dateOnly(t.createdAt)}</p>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {done && DONE[done] && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{DONE[done]}</div>}
      {t.suspendedReason && <div className="notice bad" style={{ marginBottom: 12 }} data-testid="suspended-note">Switched off: {t.suspendedReason}</div>}

      <div className="split">
        <div className="col stack">
          <section className="card">
            <div className="card-head"><h2>Owner</h2></div>
            <dl className="kv"><dt>Name</dt><dd>{t.ownerName ?? "—"}</dd><dt>Email</dt><dd>{t.ownerEmail ?? "—"}</dd><dt>Phone</dt><dd>{t.ownerPhone ? prettyPhone(t.ownerPhone) : "—"}</dd></dl>
          </section>
          <section className="card" data-testid="usage-card">
            <div className="card-head"><h2>Usage</h2></div>
            <dl className="kv">
              <dt>Products</dt><dd className="num">{t.usage.products}</dd>
              <dt>Staff</dt><dd className="num">{t.usage.staff}</dd>
              <dt>Orders this month</dt><dd className="num">{t.usage.ordersThisMonth}</dd>
              <dt>All orders</dt><dd className="num">{t.usage.ordersTotal}</dd>
              <dt>Delivered sales, 30 days</dt><dd className="num">{taka(t.usage.gmv30Days)}</dd>
              <dt>Photo storage</dt><dd className="num">{t.usage.storageMb} MB</dd>
            </dl>
            {t.domains.length > 0 && <p className="muted" style={{ marginTop: 10, fontSize: 13.5 }}>Domains: {t.domains.map((d) => `${d.domain}${d.verified ? "" : " (not verified)"}`).join(", ")}</p>}
          </section>
          <section className="card">
            <div className="card-head"><h2>Payments</h2></div>
            {t.proofs.length === 0 ? <p className="muted">No payments yet.</p> : (
              <table className="table" style={{ boxShadow: "none" }}>
                <tbody>{t.proofs.map((p) => <tr key={p.id}><td>{dateOnly(p.createdAt)}<div className="muted" style={{ fontSize: 12.5 }}>{p.provider} · {p.trxId}</div></td><td>{p.plan} · {p.interval === "YEARLY" ? "year" : "month"}</td><td className="r num">{taka(p.amount)}</td><td><span className={`pill ${p.status === "APPROVED" ? "ok" : p.status === "REJECTED" ? "bad" : "warn"}`}>{p.status.toLowerCase()}</span></td></tr>)}</tbody>
              </table>
            )}
          </section>
        </div>

        <div className="col stack">
          <section className="card" data-testid="subscription-card">
            <div className="card-head"><h2>Subscription</h2></div>
            <dl className="kv">
              <dt>State</dt><dd>{ACCESS_LABELS[a.state]}</dd>
              <dt>{a.state === "TRIAL" ? "Trial ends" : "Paid until"}</dt><dd>{dateOnly(a.paidThrough)}{a.daysLeft !== null ? ` (${a.daysLeft} days)` : a.overdueDays ? ` (${a.overdueDays} days ago)` : ""}</dd>
              {t.subscription && t.subscription.amount > 0 && (<><dt>Last payment</dt><dd className="num">{taka(t.subscription.amount)} · {t.subscription.interval === "YEARLY" ? "year" : "month"}</dd></>)}
            </dl>
            {canAdjust && (
              <div className="stack" style={{ marginTop: 12 }}>
                <form action={planAction.bind(null, t.id)} className="row" style={{ flexWrap: "nowrap" }}>
                  <select className="select" name="tier" defaultValue={t.tier} aria-label="Plan">{["STARTER", "PRO", "BUSINESS"].map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}</select>
                  <SubmitButton className="btn btn-secondary" pending="…">Change plan</SubmitButton>
                </form>
                {(!t.subscription || t.subscription.amount === 0) && (
                  <form action={extendAction.bind(null, t.id)} className="row" style={{ flexWrap: "nowrap" }}>
                    <input className="input" type="number" name="days" min={1} max={60} defaultValue={7} aria-label="Days to add" style={{ width: 90 }} />
                    <SubmitButton className="btn btn-secondary" pending="…">Extend trial (days)</SubmitButton>
                  </form>
                )}
              </div>
            )}
          </section>

          {t.quarantined && canSuspend && (
            <section className="card" data-testid="quarantine-card">
              <div className="card-head"><h2>Brand review</h2></div>
              <p className="muted" style={{ marginBottom: 10 }}>{t.quarantineReason}</p>
              <form className="stack">
                <input className="input" name="note" required minLength={3} maxLength={200} placeholder="What you checked" aria-label="Review note" />
                <div className="row">
                  <SubmitButton formAction={quarantineAction.bind(null, t.id, "APPROVE")} className="btn btn-success" pending="…">Approve</SubmitButton>
                  <SubmitButton formAction={quarantineAction.bind(null, t.id, "SUSPEND")} className="btn btn-danger" pending="…">Suspend store</SubmitButton>
                </div>
              </form>
            </section>
          )}

          {canSuspend && (
            <section className="card">
              <div className="card-head"><h2>{t.suspendedReason ? "Switched off" : "Switch off"}</h2></div>
              {t.suspendedReason ? (
                <form action={reactivateAction.bind(null, t.id)}><SubmitButton className="btn btn-primary" pending="…">Switch back on</SubmitButton></form>
              ) : (
                <form action={suspendAction.bind(null, t.id)} className="stack">
                  <input className="input" name="reason" required minLength={5} maxLength={250} placeholder="Reason. The owner will see it." aria-label="Reason" />
                  <SubmitButton className="btn btn-danger" pending="…">Suspend store</SubmitButton>
                </form>
              )}
            </section>
          )}

          <section className="card">
            <div className="card-head"><h2>What we did</h2></div>
            {t.audit.length === 0 ? <p className="muted">Nothing yet.</p> : (
              <ul className="timeline">{t.audit.map((e) => <li key={e.id}><div>{e.action.toLowerCase().replace(/_/g, " ")}</div><div className="when">{e.actorId === "SYSTEM" ? "System" : e.actorId} · {dateTime(e.createdAt)}</div></li>)}</ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
