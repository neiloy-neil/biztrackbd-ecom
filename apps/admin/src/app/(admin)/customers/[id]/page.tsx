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
import { CustomerActivityTimeline } from "./activity-timeline";
import {
  SendSmsModal,
  AdjustCreditModal,
  AdjustPointsModal,
  AddressModal,
  DeleteAddressButton,
} from "./customer-modals";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer" };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireAccess("customers");
  const c = await getCustomerDetail(s.tenantId, s.actor, id).catch(() => null);
  if (!c) notFound();
  const canEdit = can(s.user.role, "customers", "edit");
  const err = one(sp.err);
  const okKey = one(sp.ok);

  const okMessage =
    okKey === "credit_adjusted"
      ? "Store credit balance updated."
      : okKey === "points_adjusted"
      ? "Loyalty points updated."
      : okKey === "sms_sent"
      ? "Direct SMS message sent."
      : okKey === "address_saved"
      ? "Address saved."
      : okKey === "address_deleted"
      ? "Address removed."
      : okKey
      ? "Saved successfully."
      : null;

  return (
    <>
      <Link href="/customers" className="back" prefetch={false}>← Customers</Link>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>{c.name}</h1>
          {c.isVip && <span className="pill info">VIP</span>}
          {c.isBlocked && <span className="pill bad">Blocked</span>}
          {c.loyalty && (
            <span className="pill" style={{ background: "#F1F5F9", color: "#334155", fontWeight: 700, fontSize: 11.5 }}>
              {c.loyalty.tier}
            </span>
          )}
        </div>
        <div className="actions">
          {canEdit && !c.isBlocked && (
            <SendSmsModal
              customerId={c.id}
              customerName={c.name}
              customerPhone={c.phone}
            />
          )}
          <a className="btn btn-secondary btn-sm" href={`tel:${c.phone}`}>Call</a>
          <a className="btn btn-secondary btn-sm" href={`https://wa.me/88${c.phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          {can(s.user.role, "orders", "edit") && !c.isBlocked && (
            <Link href={`/orders/new?customerId=${c.id}`} className="btn btn-primary btn-sm" prefetch={false}>
              Create order
            </Link>
          )}
        </div>
      </div>
      <p className="muted" style={{ margin: "-6px 0 14px" }}>
        Customer since {dateOnly(c.since)}
        {c.address ? ` · ${c.address.area}, ${c.address.district}` : ""}
      </p>

      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {okMessage && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{okMessage}</div>}

      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <div className="stat">
          <div className="k">Total spent</div>
          <div className="v num">{taka(c.stats.totalSpent)}</div>
        </div>
        <div className="stat">
          <div className="k">Orders</div>
          <div className="v num">{c.stats.orders}</div>
        </div>
        <div className="stat">
          <div className="k">Average order</div>
          <div className="v num">{taka(c.stats.averageOrder)}</div>
        </div>
        <div className="stat">
          <div className="k">Delivery success</div>
          <div
            className="v num"
            style={{
              color:
                c.stats.deliverySuccessPercent == null
                  ? undefined
                  : c.stats.deliverySuccessPercent >= 80
                  ? "#16A34A"
                  : c.stats.deliverySuccessPercent >= 60
                  ? "#D97706"
                  : "#DC2626",
            }}
          >
            {c.stats.deliverySuccessPercent == null ? "—" : `${c.stats.deliverySuccessPercent}%`}
          </div>
        </div>
      </div>

      <div className="split">
        <div className="col stack">
          <section className="card">
            <div className="card-head">
              <h2>Orders ({c.orders.length})</h2>
            </div>
            {c.orders.length === 0 ? (
              <p className="muted">No orders yet.</p>
            ) : (
              c.orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="row"
                  style={{ padding: "10px 0", borderBottom: "1px solid var(--line, #E2E8F0)", flexWrap: "nowrap" }}
                  prefetch={false}
                  data-testid="customer-order"
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{o.orderNumber}</b>{" "}
                    <span className="muted" style={{ fontSize: 12.5 }}>{friendlyDate(o.createdAt)}</span>
                    <div className="muted" style={{ fontSize: 13, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {o.summary}
                    </div>
                  </div>
                  <OrderPill status={o.status} />
                  <b className="num">{taka(o.totalAmount)}</b>
                </Link>
              ))
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Activity Timeline</h2>
            </div>
            <CustomerActivityTimeline items={c.activity} />
          </section>
        </div>

        <div className="col stack">
          {/* Contact & Address Book */}
          <section className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Contact & Addresses</h2>
              {canEdit && <AddressModal customerId={c.id} triggerLabel="+ Add" />}
            </div>
            <div className="num" style={{ fontWeight: 600 }}>{prettyPhone(c.phone)}</div>
            {c.email && <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{c.email}</div>}

            <div style={{ marginTop: 14, borderTop: "1px solid var(--line, #E2E8F0)", paddingTop: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-muted, #64748B)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Saved Addresses ({c.addresses.length})
              </div>
              {c.addresses.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  {c.address ? `${c.address.line}, ${c.address.area}, ${c.address.district}` : "No addresses recorded."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {c.addresses.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: "8px 10px",
                        background: a.isDefault ? "var(--bg-subtle, #F8FAFC)" : "#fff",
                        border: "1px solid var(--line, #E2E8F0)",
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{a.label}</span>
                          {a.isDefault && <span className="pill info" style={{ fontSize: 10, padding: "1px 6px" }}>Default</span>}
                        </div>
                        {canEdit && (
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <AddressModal customerId={c.id} address={a} triggerLabel="Edit" />
                            <DeleteAddressButton customerId={c.id} addressId={a.id} />
                          </div>
                        )}
                      </div>
                      <div style={{ color: "var(--text, #1E293B)", lineHeight: 1.4 }}>{a.address}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {a.upazila ? `${a.upazila}, ` : ""}{a.district}, {a.division}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Credit & Loyalty Card */}
          <section className="card">
            <h2>Credit & Loyalty</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="muted" style={{ fontSize: 13 }}>Store Credit</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{taka(c.storeCredit)}</div>
                </div>
                {canEdit && <AdjustCreditModal customerId={c.id} currentCredit={c.storeCredit} />}
              </div>

              <div style={{ borderTop: "1px solid var(--line, #E2E8F0)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="muted" style={{ fontSize: 13 }}>Loyalty Points</div>
                  <div className="num" style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    {c.loyalty?.availablePoints ?? 0}
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted, #64748B)" }}>pts</span>
                  </div>
                  {c.loyalty && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      Lifetime: {c.loyalty.lifetimePoints} · Tier: {c.loyalty.tier}
                    </div>
                  )}
                </div>
                {canEdit && <AdjustPointsModal customerId={c.id} currentPoints={c.loyalty?.availablePoints ?? 0} />}
              </div>
            </div>
          </section>

          {/* Details, Tags, Marketing & Birthday */}
          {canEdit && (
            <section className="card">
              <h2>Profile & Preferences</h2>
              <form action={saveCustomerAction.bind(null, c.id)} className="stack">
                <label className="field">
                  <span className="label">Name</span>
                  <input className="input" name="name" defaultValue={c.name === c.phone ? "" : c.name} required minLength={2} />
                </label>
                <label className="field">
                  <span className="label">Email <span className="opt">(optional)</span></span>
                  <input className="input" name="email" type="email" defaultValue={c.email ?? ""} />
                </label>
                <label className="field">
                  <span className="label">Tags <span className="opt">(comma separated)</span></span>
                  <input className="input" name="tags" defaultValue={c.tags.join(", ")} placeholder="Eid buyer, VIP" />
                </label>

                {/* Birthday Selector */}
                <div style={{ borderTop: "1px solid var(--line, #E2E8F0)", paddingTop: 10, marginTop: 4 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Birthday <span className="opt">(rewards)</span></div>
                  <div className="grid grid-2" style={{ gap: 10 }}>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span className="label" style={{ fontSize: 11.5 }}>Month</span>
                      <select name="birthMonth" className="input" defaultValue={c.birthMonth ?? ""}>
                        <option value="">None</option>
                        {MONTHS.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span className="label" style={{ fontSize: 11.5 }}>Day</span>
                      <input
                        name="birthDay"
                        className="input num"
                        type="number"
                        min="1"
                        max="31"
                        defaultValue={c.birthDay ?? ""}
                        placeholder="1 - 31"
                      />
                    </label>
                  </div>
                </div>

                {/* Marketing Consents */}
                <div style={{ borderTop: "1px solid var(--line, #E2E8F0)", paddingTop: 10, marginTop: 4 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Marketing Preferences</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" name="smsConsent" defaultChecked={c.smsConsent} />
                      Agreed to receive SMS offers
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" name="emailConsent" defaultChecked={c.emailConsent} />
                      Agreed to receive email offers
                    </label>
                  </div>
                </div>

                <label className="field" style={{ marginTop: 4 }}>
                  <span className="label">Private note</span>
                  <textarea className="textarea" name="notes" defaultValue={c.notes ?? ""} maxLength={1000} placeholder="Prefers a call before delivery" />
                </label>
                <SubmitButton className="btn btn-primary btn-block">Save Profile</SubmitButton>
              </form>
            </section>
          )}

          {/* Blocked list */}
          {canEdit && (
            <section className="card">
              <h2>Blocked List</h2>
              {c.isBlocked ? (
                <form action={blockAction.bind(null, c.id, false)} className="stack">
                  <p className="muted" style={{ fontSize: 13 }}>
                    Blocked{c.blockReason ? `: ${c.blockReason}` : ""}. New orders from this number are automatically refused.
                  </p>
                  <SubmitButton className="btn btn-secondary btn-block" pending="Saving…">Unblock this customer</SubmitButton>
                </form>
              ) : (
                <details>
                  <summary className="link" style={{ cursor: "pointer", fontSize: 13.5 }}>Add to blocked list</summary>
                  <form action={blockAction.bind(null, c.id, true)} className="stack" style={{ marginTop: 12 }}>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span className="label">Reason <span className="opt">(only your team sees this)</span></span>
                      <input className="input" name="reason" maxLength={200} placeholder="Refused parcels repeatedly" />
                    </label>
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
