import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can, getCustomerDetail } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly, friendlyDate, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { OrderPill } from "@/lib/status";
import { blockAction, saveCustomerAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireAccess("customers");
  const c = await getCustomerDetail(s.tenantId, s.actor, id).catch(() => null);
  if (!c) notFound();
  const canEdit = can(s.user.role, "customers", "edit");
  const err = one(sp.err);

  return (
    <>
      <Link href="/customers" className="back" prefetch={false}>← Customers</Link>
      <div className="page-head">
        <h1>{c.name}</h1>
        {c.isVip && <span className="pill info">VIP</span>}{c.isBlocked && <span className="pill bad">Blocked</span>}
        <div className="actions">
          <a className="btn btn-secondary btn-sm" href={`tel:${c.phone}`}>Call</a>
          <a className="btn btn-secondary btn-sm" href={`https://wa.me/88${c.phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          {can(s.user.role, "orders", "edit") && !c.isBlocked && <Link href="/orders/new" className="btn btn-primary btn-sm" prefetch={false}>Create order</Link>}
        </div>
      </div>
      <p className="muted" style={{ margin: "-6px 0 14px" }}>Customer since {dateOnly(c.since)}{c.address ? ` · ${c.address.area}, ${c.address.district}` : ""}</p>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {one(sp.ok) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Saved.</div>}

      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="k">Total spent</div><div className="v num">{taka(c.stats.totalSpent)}</div></div>
        <div className="stat"><div className="k">Orders</div><div className="v num">{c.stats.orders}</div></div>
        <div className="stat"><div className="k">Average order</div><div className="v num">{taka(c.stats.averageOrder)}</div></div>
        <div className="stat"><div className="k">Delivery success</div><div className="v num">{c.stats.deliverySuccessPercent == null ? "—" : `${c.stats.deliverySuccessPercent}%`}</div></div>
      </div>

      <div className="split">
        <div className="col stack">
          <section className="card">
            <div className="card-head"><h2>Orders</h2></div>
            {c.orders.length === 0 ? <p className="muted">No orders yet.</p> : c.orders.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="row" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", flexWrap: "nowrap" }} prefetch={false} data-testid="customer-order">
                <div style={{ flex: 1, minWidth: 0 }}><b>{o.orderNumber}</b> <span className="muted" style={{ fontSize: 12.5 }}>{friendlyDate(o.createdAt)}</span><div className="muted" style={{ fontSize: 13 }}>{o.summary}</div></div>
                <OrderPill status={o.status} /><b className="num">{taka(o.totalAmount)}</b>
              </Link>
            ))}
          </section>
        </div>

        <div className="col stack">
          <section className="card">
            <h2>Contact</h2>
            <div className="num">{prettyPhone(c.phone)}</div>
            {c.email && <div className="muted">{c.email}</div>}
            {c.address && <div style={{ marginTop: 8 }}>{c.address.line}<div className="muted">{c.address.area}, {c.address.district}</div></div>}
          </section>

          {canEdit && (
            <section className="card">
              <h2>Details, tags and notes</h2>
              <form action={saveCustomerAction.bind(null, c.id)}>
                <label className="field"><span className="label">Name</span><input className="input" name="name" defaultValue={c.name === c.phone ? "" : c.name} required minLength={2} /></label>
                <label className="field"><span className="label">Email <span className="opt">(optional)</span></span><input className="input" name="email" type="email" defaultValue={c.email ?? ""} /></label>
                <label className="field"><span className="label">Tags <span className="opt">(separate with commas)</span></span><input className="input" name="tags" defaultValue={c.tags.join(", ")} placeholder="Eid buyer, VIP" /></label>
                <label className="field"><span className="label">Private note</span><textarea className="textarea" name="notes" defaultValue={c.notes ?? ""} maxLength={1000} placeholder="Prefers a call before delivery" /></label>
                <SubmitButton className="btn btn-primary btn-block">Save</SubmitButton>
              </form>
            </section>
          )}

          {canEdit && (
            <section className="card">
              <h2>Blocked list</h2>
              {c.isBlocked ? (
                <form action={blockAction.bind(null, c.id, false)} className="stack">
                  <p className="muted">Blocked{c.blockReason ? `: ${c.blockReason}` : ""}. New orders from this number are refused.</p>
                  <SubmitButton className="btn btn-secondary btn-block" pending="Saving…">Unblock this customer</SubmitButton>
                </form>
              ) : (
                <details>
                  <summary className="link" style={{ cursor: "pointer" }}>Add to blocked list</summary>
                  <form action={blockAction.bind(null, c.id, true)} className="stack" style={{ marginTop: 12 }}>
                    <label className="field" style={{ marginBottom: 0 }}><span className="label">Reason <span className="opt">(only your team sees this)</span></span><input className="input" name="reason" maxLength={200} placeholder="Refused 3 parcels" /></label>
                    <p className="muted" style={{ fontSize: 13 }}>Stops new orders. The customer is not told why.</p>
                    <SubmitButton className="btn btn-danger btn-block" pending="Saving…">Block this number</SubmitButton>
                  </form>
                </details>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
