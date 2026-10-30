import type { Metadata } from "next";
import Link from "next/link";
import { abandonedTabCounts, can, getAbandonedMetrics, getStoreSettings, listAbandoned, type AbandonedRow, type AbandonedTab } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { SubmitButton } from "@/components/ui";
import { friendlyDate, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { outcomeAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Abandoned checkouts" };

const TABS: { key: AbandonedTab; label: string; alert?: boolean }[] = [
  { key: "to_call", label: "To call", alert: true }, { key: "called", label: "Called" }, { key: "recovered", label: "Recovered" }, { key: "lost", label: "Not interested" },
];
const OUTCOME: Record<string, string> = { WILL_ORDER: "Will order", NO_ANSWER: "No answer", NOT_INTERESTED: "Not interested", ORDER_CREATED: "Order created" };
const SMS: Record<string, string> = { SENT: "Recovery SMS sent", FAILED: "SMS failed", SKIPPED_OPTOUT: "Opted out of SMS", SKIPPED_NO_CREDITS: "No SMS credits left", SKIPPED_LIMIT: "Already texted today" };

/** What to say, in plain Bangla and English, built from the cart so the caller sounds like they know the order. */
function script(storeName: string, r: AbandonedRow) {
  const first = r.lines[0];
  const item = first ? `${first.title}${first.variantTitle && first.variantTitle.toLowerCase() !== "default" ? ` (${first.variantTitle})` : ""}` : "your items";
  return {
    bn: `আসসালামু আলাইকুম${r.name ? `, ${r.name.split(" ")[0]}` : ""}। আমি ${storeName} থেকে বলছি। আপনি আমাদের ওয়েবসাইটে ${item} কার্টে রেখেছিলেন। অর্ডারটি সম্পন্ন করতে কি কোনো সাহায্য লাগবে? আমরা কালই পাঠিয়ে দিতে পারি।`,
    en: `Assalamu alaikum${r.name ? ` ${r.name.split(" ")[0]}` : ""}, I am calling from ${storeName}. You left ${item} in your cart. Can I help you finish the order? We can send it tomorrow.`,
  };
}

function Card({ r, tab, canEdit, canOrder, storeName }: { r: AbandonedRow; tab: AbandonedTab; canEdit: boolean; canOrder: boolean; storeName: string }) {
  const open = ["CAPTURED", "CALL_SCHEDULED", "CALL_CONNECTED"].includes(r.status);
  const sc = script(storeName, r);
  const minutes = Math.round((Date.now() - r.lastEventAt.getTime()) / 60_000);
  return (
    <section className="card" data-testid="abandoned-card" data-status={r.status}>
      <div className="card-head">
        <h2>{r.name ?? "Unknown name"} <span className="num muted" style={{ fontWeight: 400, fontSize: 14 }}>{prettyPhone(r.phone)}</span></h2>
        <b className="num" data-testid="cart-value">{taka(r.total)}</b>
      </div>
      <p className="muted" style={{ margin: "-4px 0 8px", fontSize: 13.5 }}>
        Left {minutes < 60 ? `${minutes} min ago` : friendlyDate(r.lastEventAt)}{r.district ? ` · ${r.district}` : ""}{r.callAttempts ? ` · ${r.callAttempts} ${r.callAttempts === 1 ? "call" : "calls"}` : ""}{r.smsStatus ? ` · ${SMS[r.smsStatus] ?? r.smsStatus}` : ""}
      </p>
      <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
        {r.lines.map((l) => <li key={l.variantId}>{l.title}{l.variantTitle && l.variantTitle.toLowerCase() !== "default" ? ` (${l.variantTitle})` : ""} × {l.quantity}</li>)}
      </ul>
      {r.outcome && <p style={{ fontSize: 13.5 }}>Last call: <b>{OUTCOME[r.outcome] ?? r.outcome}</b></p>}
      {r.notes && <pre className="muted" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, margin: "6px 0 0" }}>{r.notes}</pre>}
      {r.status === "RECOVERED" && r.recoveredOrderId && <p style={{ marginTop: 8 }}><Link href={`/orders/${r.recoveredOrderId}`} className="link" prefetch={false}>Open the order</Link></p>}

      {open && (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="row">
            <a className="btn btn-primary" href={`tel:${r.phone}`}>Call {prettyPhone(r.phone)}</a>
            {canOrder && <Link href={`/orders/new?abandoned=${r.id}`} className="btn btn-secondary" prefetch={false} data-testid="make-order">Make this an order</Link>}
          </div>
          <details>
            <summary className="link" style={{ cursor: "pointer" }}>Suggested call script</summary>
            <p lang="bn" style={{ marginTop: 8 }}>{sc.bn}</p>
            <p className="muted" style={{ marginTop: 6 }}>{sc.en}</p>
          </details>
          {canEdit && (
            <form action={outcomeAction.bind(null, r.id, tab)} className="row" style={{ marginTop: 6 }}>
              <select className="select" name="outcome" defaultValue="WILL_ORDER" aria-label="Outcome of the call">
                <option value="WILL_ORDER">Customer said they will order</option>
                <option value="NO_ANSWER">No answer / phone switched off</option>
                <option value="NOT_INTERESTED">Not interested / cancelled mind</option>
              </select>
              <SubmitButton className="btn btn-secondary btn-sm" pending="Saving…">Save</SubmitButton>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

export default async function Abandoned({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("customers");
  const tab = (TABS.find((t) => t.key === one(sp.tab))?.key ?? "to_call") as AbandonedTab;
  const canEdit = can(s.user.role, "customers", "edit");
  const canOrder = can(s.user.role, "orders", "edit");
  const [rows, counts, m, settings] = await Promise.all([listAbandoned(s.tenantId, s.actor, tab), abandonedTabCounts(s.tenantId, s.actor), getAbandonedMetrics(s.tenantId, s.actor), getStoreSettings(s.tenantId, s.actor).catch(() => null)]);
  const storeName = settings?.storeName ?? s.tenantSubdomain;
  const err = one(sp.err);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Abandoned checkouts" }]}
        title="Abandoned checkouts"
        sub="Customers who typed their number at checkout and did not complete their order. Call high-value carts first."
      />
      <div className="grid grid-4" data-testid="abandoned-stats">
        <div className="stat"><div className="k">Dropped carts, 7 days</div><div className="v num" data-testid="stat-dropped">{m.dropped7d}</div></div>
        <div className="stat"><div className="k">Value left behind</div><div className="v num">{taka(m.valueLeftBehind)}</div></div>
        <div className="stat"><div className="k">Recovery rate</div><div className="v num">{m.recoveryRatePercent == null ? "—" : `${m.recoveryRatePercent}%`}</div></div>
        <div className="stat"><div className="k">Recovered sales</div><div className="v num">{taka(m.recoveredRevenue)}</div></div>
      </div>
      <nav className="tabs" aria-label="Stage" style={{ marginTop: 14 }}>
        {TABS.map((t) => <Link key={t.key} href={`/abandoned?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined} prefetch={false}>{t.label}<span className={`n${t.alert && counts[t.key] > 0 ? " alert" : ""}`}>{counts[t.key]}</span></Link>)}
      </nav>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {one(sp.done) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Call logged.</div>}
      {rows.length === 0 ? <div className="card empty" data-testid="abandoned-empty">{tab === "to_call" ? "Nobody waiting. Every checkout was finished." : "Nothing here."}</div> : <div className="stack">{rows.map((r) => <Card key={r.id} r={r} tab={tab} canEdit={canEdit} canOrder={canOrder} storeName={storeName} />)}</div>}
    </>
  );
}
