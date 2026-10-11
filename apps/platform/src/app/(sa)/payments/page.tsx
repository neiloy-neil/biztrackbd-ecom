import type { Metadata } from "next";
import Link from "next/link";
import { canPlatform, listPayments } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateTime, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { approveAction, rejectAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payments" };

const TABS = [["PENDING", "To check"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"]] as const;

export default async function Payments({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("payments");
  const tab = TABS.find((t) => t[0] === one(sp.tab))?.[0] ?? "PENDING";
  const rows = await listPayments(s.actor, tab);
  const canEdit = canPlatform(s.user.role, "payments", "edit");
  const err = one(sp.err);
  const done = one(sp.done);
  const provider = (p: string) => (p === "BKASH" ? "bKash" : p === "NAGAD" ? "Nagad" : p);

  return (
    <>
      <div className="page-head"><h1>Payments</h1></div>
      <p className="page-sub">Stores that paid by bKash or Nagad. Find the TrxID in our own app, check the amount, then approve. The plan switches on at once.</p>
      <nav className="tabs" aria-label="Status">
        {TABS.map(([k, l]) => <Link key={k} href={`/payments?tab=${k}`} aria-current={k === tab ? "page" : undefined} prefetch={false}>{l}</Link>)}
      </nav>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="payment-error">{err}</div>}
      {done && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{done === "approved" ? "Approved. The plan is live." : "Rejected. The store can see why."}</div>}

      {rows.length === 0 ? <div className="card empty" data-testid="payments-empty">{tab === "PENDING" ? "Nothing waiting. Nice." : "Nothing here."}</div> : (
        <div className="stack">
          {rows.map((p) => (
            <section key={p.id} className="card" data-testid="payment-card">
              <div className="card-head">
                <h2><Link href={`/tenants/${p.tenantId}`} className="link" prefetch={false}>{p.storeName}</Link> <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>· {p.subdomain}</span></h2>
                <span className={`pill ${p.status === "APPROVED" ? "ok" : p.status === "REJECTED" ? "bad" : "warn"}`}>{p.status.toLowerCase()}</span>
              </div>
              <dl className="kv">
                <dt>Plan</dt><dd>{p.plan.charAt(0) + p.plan.slice(1).toLowerCase()} · {p.interval === "YEARLY" ? "1 year" : "1 month"}</dd>
                <dt>Look for</dt><dd><b className="num" data-testid="amount">{taka(p.amount)}</b> by {provider(p.provider)} from <span className="num">{prettyPhone(p.senderNumber)}</span></dd>
                <dt>TrxID</dt><dd><b data-testid="trx">{p.trxId}</b></dd>
                <dt>Sent</dt><dd>{dateTime(p.createdAt)}</dd>
                {p.note && (<><dt>Note</dt><dd>{p.note}</dd></>)}
                {p.rejectionReason && (<><dt>Reason</dt><dd>{p.rejectionReason}</dd></>)}
              </dl>
              {p.senderSeenOnOtherStores > 0 && <div className="notice" style={{ marginTop: 10 }}>This sender number has also paid for {p.senderSeenOnOtherStores} other {p.senderSeenOnOtherStores === 1 ? "store" : "stores"}.</div>}
              {canEdit && p.status === "PENDING" && (
                <div className="stack" style={{ marginTop: 12 }}>
                  <form action={approveAction.bind(null, p.id)}><SubmitButton className="btn btn-success btn-lg" pending="Approving…">Approve and switch the plan on</SubmitButton></form>
                  <details>
                    <summary className="link" style={{ cursor: "pointer" }}>Reject</summary>
                    <form action={rejectAction.bind(null, p.id)} className="stack" style={{ marginTop: 10 }}>
                      <input className="input" name="reason" required minLength={3} maxLength={200} placeholder="Why? The store will see this." aria-label="Reason" />
                      <SubmitButton className="btn btn-danger" pending="Rejecting…">Reject payment</SubmitButton>
                    </form>
                  </details>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
