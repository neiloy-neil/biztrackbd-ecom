import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can, getCustomerDetail } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
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

  const deliveryClass =
    c.stats.deliverySuccessPercent == null
      ? ""
      : c.stats.deliverySuccessPercent >= 80
      ? "stat-success"
      : c.stats.deliverySuccessPercent >= 60
      ? "stat-warn"
      : "stat-danger";

  return (
    <>
      <PageHeader
        title={c.name}
        crumbs={[
          { label: "Customers", href: "/customers" },
          { label: c.name },
        ]}
        badge={
          <>
            {c.isVip && <span className="pill info">VIP</span>}
            {c.isBlocked && <span className="pill bad">Blocked</span>}
            {c.loyalty && (
              <span className="pill text-bold text-xs">
                {c.loyalty.tier}
              </span>
            )}
          </>
        }
        sub={`Customer since ${dateOnly(c.since)}${c.address ? ` · ${c.address.area}, ${c.address.district}` : ""}`}
        actions={
          <>
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
          </>
        }
      />

      {err && <div className="notice bad mb-md" role="alert">{err}</div>}
      {okMessage && <div className="notice good mb-md" role="status">{okMessage}</div>}

      <div className="grid grid-4 mb-md">
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
          <div className={`v num ${deliveryClass}`}>
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
                  className="row border-bottom nowrap py-xs"
                  prefetch={false}
                  data-testid="customer-order"
                >
                  <div className="flex-1 min-w-0">
                    <b>{o.orderNumber}</b>{" "}
                    <span className="muted text-xs">{friendlyDate(o.createdAt)}</span>
                    <div className="muted text-sm text-ellipsis">
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
            <div className="flex-between mb-md">
              <h2 className="m-0">Contact & Addresses</h2>
              {canEdit && <AddressModal customerId={c.id} triggerLabel="+ Add" />}
            </div>
            <div className="num text-bold">{prettyPhone(c.phone)}</div>
            {c.email && <div className="muted text-sm mt-xs">{c.email}</div>}

            <div className="border-top pt-sm mt-md">
              <div className="text-xs text-bold text-muted uppercase tracking-wide mb-xs">
                Saved Addresses ({c.addresses.length})
              </div>
              {c.addresses.length === 0 ? (
                <p className="muted text-sm">
                  {c.address ? `${c.address.line}, ${c.address.area}, ${c.address.district}` : "No addresses recorded."}
                </p>
              ) : (
                <div className="stack gap-sm">
                  {c.addresses.map((a) => (
                    <div
                      key={a.id}
                      className={`card-subtle ${a.isDefault ? "active" : ""}`}
                    >
                      <div className="flex-between mb-xs">
                        <div className="flex-center-y gap-xs">
                          <span className="text-bold text-xs">{a.label}</span>
                          {a.isDefault && <span className="pill info text-xs">Default</span>}
                        </div>
                        {canEdit && (
                          <div className="flex-center-y gap-sm">
                            <AddressModal customerId={c.id} address={a} triggerLabel="Edit" />
                            <DeleteAddressButton customerId={c.id} addressId={a.id} />
                          </div>
                        )}
                      </div>
                      <div className="text-sm">{a.address}</div>
                      <div className="muted text-xs">
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
            <div className="stack gap-md">
              <div className="flex-between">
                <div>
                  <div className="muted text-sm">Store Credit</div>
                  <div className="num num-lg">{taka(c.storeCredit)}</div>
                </div>
                {canEdit && <AdjustCreditModal customerId={c.id} currentCredit={c.storeCredit} />}
              </div>

              <div className="border-top pt-sm flex-between">
                <div>
                  <div className="muted text-sm">Loyalty Points</div>
                  <div className="num num-lg flex-center-y gap-xs">
                    {c.loyalty?.availablePoints ?? 0}
                    <span className="text-sm text-muted text-normal">pts</span>
                  </div>
                  {c.loyalty && (
                    <div className="muted text-xs mt-xs">
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
                <div className="border-top pt-sm mt-xs">
                  <div className="text-xs text-bold mb-xs">Birthday <span className="opt">(rewards)</span></div>
                  <div className="grid grid-2 gap-sm">
                    <label className="field mb-0">
                      <span className="label text-xs">Month</span>
                      <select name="birthMonth" className="input" defaultValue={c.birthMonth ?? ""}>
                        <option value="">None</option>
                        {MONTHS.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field mb-0">
                      <span className="label text-xs">Day</span>
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
                <div className="border-top pt-sm mt-xs">
                  <div className="text-xs text-bold mb-xs">Marketing Preferences</div>
                  <div className="stack gap-xs text-sm">
                    <label className="check-label">
                      <input type="checkbox" name="smsConsent" defaultChecked={c.smsConsent} />
                      Agreed to receive SMS offers
                    </label>
                    <label className="check-label">
                      <input type="checkbox" name="emailConsent" defaultChecked={c.emailConsent} />
                      Agreed to receive email offers
                    </label>
                  </div>
                </div>

                <label className="field mt-xs">
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
                  <p className="muted text-sm">
                    Blocked{c.blockReason ? `: ${c.blockReason}` : ""}. New orders from this number are automatically refused.
                  </p>
                  <SubmitButton className="btn btn-secondary btn-block" pending="Saving…">Unblock this customer</SubmitButton>
                </form>
              ) : (
                <details>
                  <summary className="link cursor-pointer text-sm">Add to blocked list</summary>
                  <form action={blockAction.bind(null, c.id, true)} className="stack mt-md">
                    <label className="field mb-0">
                      <span className="label">Reason <span className="opt">(only your team sees this)</span></span>
                      <input className="input" name="reason" maxLength={200} placeholder="Refused parcels repeatedly" />
                    </label>
                    <p className="muted text-sm">Stops new orders. The customer is not told why.</p>
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
