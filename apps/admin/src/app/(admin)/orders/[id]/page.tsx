import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { COURIER_STATUS_LABELS, can, getCourierRates, getOrderDetail, listConnectedCouriers, listOrderTags, getStoreSettings, buildWhatsAppOrderLink, type OrderDetail } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { SubmitButton } from "@/components/ui";
import { dateTime, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { CHANNEL, OrderPill, PaymentPill, methodName } from "@/lib/status";
import { blockAction, bookAction, callNoteAction, messageAction, tagsAction, holdAction, noteAction, recordAdvancePaymentAction, refreshCourierAction, refreshFraudAction, releaseHoldAction, returnedAction, shipAction, statusAction, verifyAction } from "./actions";
import { AddressEditor, CopyButton, RejectForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order" };

const EVENT_TONE: Record<string, string> = { PAYMENT_VERIFIED: "pay", PAYMENT_REJECTED: "bad", NOTE: "note" };

/** The one thing to do next, so the owner on a phone is never hunting for the button. */
function nextStep(o: OrderDetail): "verify" | "confirm" | "pack" | "ship" | "deliver" | null {
  if (o.status === "CANCELLED" || o.status === "REFUNDED" || o.status === "RETURNED" || o.status === "DELIVERED") return null;
  if (o.paymentStatus === "PENDING_VERIFICATION") return "verify";
  if (o.status === "PENDING") return "confirm";
  if (o.status === "CONFIRMED") return "pack";
  if (o.status === "PROCESSING") return "ship";
  if (o.status === "SHIPPED") return "deliver";
  return null;
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireAccess("orders");
  const o = await getOrderDetail(s.tenantId, s.actor, id).catch(() => null);
  if (!o) notFound();
  const [couriers, rates, knownTags, settings] = await Promise.all([
    listConnectedCouriers(s.tenantId),
    getCourierRates(s.tenantId, s.actor),
    listOrderTags(s.tenantId, s.actor),
    getStoreSettings(s.tenantId, s.actor).catch(() => null),
  ]);
  const canEdit = can(s.user.role, "orders", "edit");
  const step = canEdit ? nextStep(o) : null;
  const err = one(sp.err);
  const isMfs = o.paymentMethod.startsWith("MANUAL_");
  const canCancel = canEdit && ["PENDING", "CONFIRMED", "PROCESSING"].includes(o.status);
  const canBook = canEdit && (o.status === "CONFIRMED" || o.status === "PROCESSING") && !o.courier.consignmentId;
  const held = o.risk.review === "HELD";
  const open = ["PENDING", "CONFIRMED", "PROCESSING"].includes(o.status);
  const preferred = couriers.find((c) => c.provider === rates.defaultCourier)?.provider ?? couriers[0]?.provider;
  const trust = o.risk.lookup.network;
  const courierName = (p: string) => (p === "MANUAL" ? "Delivered by you" : p === "STEADFAST" ? "Steadfast" : p === "PATHAO" ? "Pathao" : p === "REDX" ? "RedX" : p);

  const storeName = settings?.storeName || s.tenantSubdomain;
  const itemsSummary = o.items.map((i) => `${i.title} (${i.quantity})`).join(", ");
  const waConfirmLink = buildWhatsAppOrderLink({
    phone: o.customerPhone,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    orderTotal: o.totals.total,
    itemsSummary,
    deliveryAddress: o.address.line ? `${o.address.line}, ${o.address.district}` : o.address.district,
    storeName,
    lang: "bn",
    type: "COD_CONFIRM",
  });
  const waShippingLink = buildWhatsAppOrderLink({
    phone: o.customerPhone,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    orderTotal: o.totals.total,
    courierName: o.courier.provider ? courierName(o.courier.provider) : null,
    trackingCode: o.courier.trackingCode,
    trackingUrl: o.courier.trackingUrl,
    storeName,
    lang: "bn",
    type: "SHIPPING_UPDATE",
  });
  const waCashReminderLink = buildWhatsAppOrderLink({
    phone: o.customerPhone,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    orderTotal: o.totals.total,
    storeName,
    lang: "bn",
    type: "CASH_REMINDER",
  });

  return (
    <div className={step ? "has-sticky" : undefined}>
      <PageHeader
        crumbs={[{ label: "Orders", href: "/orders" }, { label: o.orderNumber }]}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span data-testid="order-title">{o.orderNumber}</span>
            <div className="row" style={{ gap: 6 }}>
              <PaymentPill method={o.paymentMethod} status={o.paymentStatus} />
              <OrderPill status={o.status} />
            </div>
          </div>
        }
        sub={`${dateTime(o.createdAt)} · ${CHANNEL[o.channel] ?? o.channel}`}
        actions={
          <>
            {o.status === "PENDING" && (
              <a
                href={waConfirmLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp btn-sm"
                data-testid="wa-confirm-btn"
              >
                WhatsApp Confirm
              </a>
            )}
            {o.status === "SHIPPED" && (
              <a
                href={waShippingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp btn-sm"
                data-testid="wa-tracking-btn"
              >
                Send Tracking
              </a>
            )}
            {(o.status === "CONFIRMED" || o.status === "PROCESSING") && (
              <a
                href={waCashReminderLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp btn-sm"
                data-testid="wa-cash-btn"
              >
                Cash Reminder
              </a>
            )}
            <Link href={`/orders/print?ids=${o.id}&doc=invoice`} target="_blank" className="btn btn-secondary btn-sm" prefetch={false}>Print invoice</Link>
            <Link href={`/orders/print?ids=${o.id}&doc=slip`} target="_blank" className="btn btn-secondary btn-sm" prefetch={false}>Packing slip</Link>
            {o.channel === "TABLE_ORDER" && (
              <Link href={`/orders/print?ids=${o.id}&doc=kitchen_slip&size=thermal`} target="_blank" className="btn btn-secondary btn-sm" prefetch={false} data-testid="print-kot-btn">
                Kitchen slip (KOT)
              </Link>
            )}
          </>
        }
      />
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 14 }} data-testid="order-error">{err}</div>}
      {o.callNote && <div className="notice info" style={{ marginBottom: 14 }} data-testid="call-note-banner"><b>Call note:</b> {o.callNote}</div>}

      <div className="split">
        <div className="col stack">
          <section className="card" data-testid="payment-card">
            <div className="card-head"><h2>Payment</h2></div>
            <dl className="kv">
              <dt>Method</dt><dd>{methodName(o.paymentMethod)}</dd>
              <dt>Amount to receive</dt><dd className="num"><b>{taka(o.totals.total)}</b></dd>
              {isMfs && o.mfs.trxId && (<><dt>TrxID</dt><dd><b data-testid="trxid">{o.mfs.trxId}</b></dd></>)}
              {isMfs && o.mfs.sender && (<><dt>Sent from</dt><dd className="num">{prettyPhone(o.mfs.sender)}</dd></>)}
              {o.mfs.verifiedAt && (<><dt>Confirmed</dt><dd>{dateTime(o.mfs.verifiedAt)}</dd></>)}
            </dl>
            {isMfs && o.mfs.trxId && o.paymentStatus === "PENDING_VERIFICATION" && (
              <div className="stack" style={{ marginTop: 12 }}>
                <div className="row"><CopyButton text={o.mfs.trxId} label="Copy TrxID" /></div>
                <div className="notice info">Open your {methodName(o.paymentMethod)} app and find this TrxID for {taka(o.totals.total)} before you confirm.</div>
                {o.trxReuse.length > 0 && <div className="notice bad" role="alert">This TrxID is also on {o.trxReuse.map((r) => r.orderNumber).join(", ")}. Check carefully.</div>}
              </div>
            )}
            {canEdit && o.paymentStatus === "PENDING_VERIFICATION" && (
              <div className="stack only-desktop" style={{ marginTop: 14 }}>
                <form action={verifyAction.bind(null, o.id)}><SubmitButton className="btn btn-success btn-block btn-lg" pending="Confirming…">I received it. Mark as paid</SubmitButton></form>
                <RejectForm orderId={o.id} />
              </div>
            )}
            {canEdit && o.paymentStatus === "PENDING_VERIFICATION" && (
              <div className="only-mobile" style={{ marginTop: 14 }}><RejectForm orderId={o.id} /></div>
            )}
            {!isMfs && o.paymentStatus === "UNPAID" && <p className="muted" style={{ marginTop: 10, fontSize: 13.5 }}>Customer pays the courier when it arrives.</p>}
          </section>

          <section className="card" data-testid="items-card">
            <div className="card-head"><h2>Items ({o.items.reduce((n, i) => n + i.quantity, 0)})</h2>{canEdit && ["PENDING", "CONFIRMED", "PROCESSING"].includes(o.status) && <Link href={`/orders/${o.id}/items`} className="link" prefetch={false} data-testid="change-items">Change items</Link>}</div>
            {o.items.map((i) => (
              <div key={i.id} className="row" style={{ padding: "8px 0", flexWrap: "nowrap", alignItems: "flex-start" }}>
                <span className="thumb">{i.imageUrl ? /* eslint-disable-line @next/next/no-img-element */ <img src={i.imageUrl} alt="" width={44} height={44} style={{ objectFit: "cover" }} /> : "·"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{i.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{[i.variantTitle && i.variantTitle.toLowerCase() !== "default" ? i.variantTitle : null, i.sku ? `SKU ${i.sku}` : null].filter(Boolean).join(" · ")}</div>
                  <div className="muted num" style={{ fontSize: 13 }}>{taka(i.unitPrice)} × {i.quantity}</div>
                </div>
                <b className="num">{taka(i.total)}</b>
              </div>
            ))}
            <div className="totals" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <div className="r"><span>Subtotal</span><span className="num">{taka(o.totals.subtotal)}</span></div>
              <div className="r"><span>Delivery ({o.address.zone})</span><span className="num">{taka(o.totals.delivery)}</span></div>
              {o.totals.codFee > 0 && <div className="r"><span>Cash on delivery fee</span><span className="num">{taka(o.totals.codFee)}</span></div>}
              {o.totals.discount > 0 && <div className="r"><span>Coupon {o.totals.couponCode}</span><span className="num">− {taka(o.totals.discount)}</span></div>}
              {o.totals.tierDiscount > 0 && <div className="r"><span>VIP discount</span><span className="num">− {taka(o.totals.tierDiscount)}</span></div>}
              {o.totals.referralDiscount > 0 && <div className="r"><span>Friend&apos;s first-order offer</span><span className="num">− {taka(o.totals.referralDiscount)}</span></div>}
              {o.totals.pointsDiscount > 0 && <div className="r"><span>Reward points ({o.totals.pointsUsed})</span><span className="num">− {taka(o.totals.pointsDiscount)}</span></div>}
              <div className="r grand"><span>Total</span><span className="num" data-testid="order-total">{taka(o.totals.total)}</span></div>
              {(o.wholesale?.advancePaid ?? 0) > 0 && (
                <>
                  <div className="r" style={{ color: "var(--brand)" }}>
                    <span>Advance Paid (অগ্রিম পরিশোধিত)</span>
                    <span className="num">− {taka(o.wholesale?.advancePaid ?? 0)}</span>
                  </div>
                  <div className="r" style={{ fontWeight: 700, fontSize: "1.05em", color: "var(--text-ok, #15803d)" }}>
                    <span>COD Payable at Door (কুরিয়ার আদায়)</span>
                    <span className="num">{taka(o.wholesale?.balanceDue ?? o.totals.total)}</span>
                  </div>
                </>
              )}
            </div>

            {canEdit && o.status !== "CANCELLED" && o.status !== "REFUNDED" && o.paymentStatus !== "PAID" && (
              <details style={{ marginTop: 12, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", background: "var(--surface-muted)" }}>
                <summary className="link" style={{ cursor: "pointer", fontWeight: 600 }}>Record Advance Delivery Charge (অগ্রিম ডেলিভারি চার্জ রেকর্ড)</summary>
                <form action={recordAdvancePaymentAction.bind(null, o.id)} className="stack" style={{ marginTop: 10, gap: 8 }}>
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>Taking 100-200 Tk advance via bKash/Nagad confirms customer intent and is automatically deducted from courier COD collection amount.</p>
                  <div className="row" style={{ gap: 8 }}>
                    <label className="field" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                      <span className="label">Amount (BDT)</span>
                      <input className="input" type="number" name="amount" defaultValue={150} min={1} max={o.wholesale?.balanceDue || o.totals.total} required />
                    </label>
                    <label className="field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                      <span className="label">Channel</span>
                      <select className="select" name="method" defaultValue="MANUAL_BKASH">
                        <option value="MANUAL_BKASH">bKash (বিকাশ)</option>
                        <option value="MANUAL_NAGAD">Nagad (নগদ)</option>
                        <option value="MANUAL_ROCKET">Rocket (রকেট)</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                      </select>
                    </label>
                  </div>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="label">Transaction ID / TrxID <span className="opt">(optional)</span></span>
                    <input className="input" name="trxId" maxLength={60} placeholder="e.g. 9X7B8Q2" />
                  </label>
                  <SubmitButton className="btn btn-secondary btn-block" pending="Recording…">Save advance & update COD</SubmitButton>
                </form>
              </details>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Timeline</h2></div>
            <ul className="timeline" data-testid="timeline">
              {o.events.map((e) => (
                <li key={e.id} className={EVENT_TONE[e.type] ?? ""}>
                  <div>{e.message}</div>
                  <div className="when">{e.actorName ? `${e.actorName} · ` : ""}{dateTime(e.createdAt)}</div>
                </li>
              ))}
            </ul>
            {canEdit && (
              <form action={noteAction.bind(null, o.id)} className="row" style={{ marginTop: 6, flexWrap: "nowrap" }}>
                <input className="input" name="note" placeholder="Add a private note for your team" maxLength={500} aria-label="Private note" required />
                <SubmitButton className="btn btn-secondary" pending="…">Post</SubmitButton>
              </form>
            )}
          </section>
        </div>

        <div className="col stack">
          <section className="card" data-testid="risk-card">
            <div className="card-head">
              <h2>Delivery trust</h2>
              <div className="row" style={{ gap: 6 }}>
                {o.risk.firstTime && o.risk.flags.length === 0 ? <span className="pill grey">First-time buyer</span> : <span className={`pill ${o.risk.level === "HIGH" ? "bad" : o.risk.level === "MEDIUM" ? "warn" : "ok"}`} data-testid="risk-level">{o.risk.level === "HIGH" ? "High risk" : o.risk.level === "MEDIUM" ? "Medium risk" : "Trusted"} · {o.risk.score}</span>}
                {canEdit && (
                  <form action={refreshFraudAction.bind(null, o.id)}>
                    <SubmitButton className="btn btn-secondary btn-sm" pending="…">↻</SubmitButton>
                  </form>
                )}
              </div>
            </div>
            <dl className="kv">
              {o.risk.lookup.courier && (
                <>
                  <dt>Steadfast courier</dt>
                  <dd data-testid="risk-courier">
                    <b>{o.risk.lookup.courier.successRatio}%</b> success ({o.risk.lookup.courier.deliveredParcels} of {o.risk.lookup.courier.totalParcels} delivered{o.risk.lookup.courier.cancelledParcels > 0 ? `, ${o.risk.lookup.courier.cancelledParcels} cancelled` : ""})
                  </dd>
                </>
              )}
              <dt>Across all stores</dt>
              <dd data-testid="risk-network">{trust.level === "NEW" ? "No parcels sent to this number yet" : `${trust.delivered} delivered, ${trust.failed} came back${trust.refused ? ` (${trust.refused} refused in the last 60 days)` : ""}${trust.stores > 1 ? `, ${trust.stores} stores` : ""}`}</dd>
              <dt>In your store</dt><dd>{o.risk.lookup.here.orders} {o.risk.lookup.here.orders === 1 ? "order" : "orders"}, {o.risk.lookup.here.delivered} delivered, {o.risk.lookup.here.returned} returned</dd>
            </dl>
            {o.risk.flags.length > 0 && <ul style={{ margin: "10px 0 0", paddingLeft: 18 }} data-testid="risk-flags">{o.risk.flags.map((f) => <li key={f.code}>{f.label}</li>)}</ul>}
            {open && <p className="muted" style={{ marginTop: 10, fontSize: 13.5 }}>{o.risk.level === "HIGH" ? "Pause booking. Call the customer and ask for ৳100 in advance by bKash." : o.risk.level === "MEDIUM" ? "Call the customer before you pack this." : "Safe to pack and ship."}</p>}
            {held && canEdit && (
              <form action={releaseHoldAction.bind(null, o.id)} className="stack" style={{ marginTop: 10 }} data-testid="release-hold">
                <div className="notice bad" role="status">Held for review. A courier cannot be booked until you release it.</div>
                <input className="input" name="note" maxLength={150} placeholder="What did the customer say? (optional)" aria-label="Note" />
                <SubmitButton className="btn btn-primary btn-block" pending="Releasing…">I called them. Release the hold</SubmitButton>
              </form>
            )}
            {held && !canEdit && <div className="notice bad" role="status" style={{ marginTop: 10 }}>Held for review.</div>}
            {!held && canEdit && open && o.risk.level !== "LOW" && (
              <form action={holdAction.bind(null, o.id)} style={{ marginTop: 10 }}><SubmitButton className="btn btn-secondary btn-sm" pending="Holding…">Hold for review</SubmitButton></form>
            )}
            {canEdit && can(s.user.role, "customers", "edit") && !o.risk.lookup.blocked && (o.risk.level !== "LOW" || o.risk.refusedAtDoor) && (
              <details style={{ marginTop: 10 }}>
                <summary className="link" style={{ cursor: "pointer" }}>Block this number</summary>
                <form action={blockAction.bind(null, o.id, o.customerPhone)} className="stack" style={{ marginTop: 10 }}>
                  <input className="input" name="reason" required minLength={3} maxLength={150} placeholder="Why? For example: refused 3 parcels" aria-label="Reason" />
                  <SubmitButton className="btn btn-danger btn-block" pending="Blocking…">Block from ordering in your store</SubmitButton>
                </form>
              </details>
            )}
            {o.risk.lookup.blocked && <p className="muted" style={{ marginTop: 10 }}>This number is blocked in your store.</p>}
          </section>

          <section className="card" data-testid="customer-card">
            <div className="card-head"><h2>Customer</h2>{o.customer?.isBlocked && <span className="pill bad">Blocked</span>}</div>
            <div style={{ fontWeight: 700 }}>{o.customerName}</div>
            <div className="row" style={{ marginTop: 4 }}>
              <a className="link num" href={`tel:${o.customerPhone}`}>{prettyPhone(o.customerPhone)}</a>
              <a className="link" href={waConfirmLink} target="_blank" rel="noopener noreferrer" style={{ color: "#16A34A", fontWeight: 600 }}>WhatsApp Chat</a>
            </div>
            {o.customerEmail && <div className="muted" style={{ fontSize: 13.5 }}>{o.customerEmail}</div>}
            {o.customer && (
              <dl className="kv" style={{ marginTop: 12 }}>
                <dt>Orders</dt><dd>{o.customer.totalOrders}</dd>
                <dt>Delivered</dt><dd>{o.customer.delivered}{o.customer.deliverySuccessPercent != null ? ` (${o.customer.deliverySuccessPercent}% of finished orders)` : ""}</dd>
                <dt>Returned</dt><dd>{o.customer.returned}</dd>
                <dt>Spent</dt><dd className="num">{taka(o.customer.totalSpent)}</dd>
              </dl>
            )}
            {o.customer?.id && can(s.user.role, "customers") && <p style={{ marginTop: 10 }}><Link href={`/customers/${o.customer.id}`} className="link" prefetch={false}>Open customer</Link></p>}
          </section>

          <section className="card" data-testid="labels-card">
            <div className="card-head"><h2>Labels and call note</h2></div>
            {canEdit ? (
              <div className="stack">
                <form action={tagsAction.bind(null, o.id)} className="stack">
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="label">Labels <span className="opt">(separate with commas)</span></span>
                    <input className="input" name="tags" list="known-labels" defaultValue={o.tags.join(", ")} maxLength={200} placeholder="gift, call first" data-testid="labels-input" />
                  </label>
                  <datalist id="known-labels">{knownTags.map((t) => <option key={t.tag} value={t.tag} />)}</datalist>
                  <SubmitButton className="btn btn-secondary btn-sm" pending="Saving…">Save labels</SubmitButton>
                </form>
                <form action={callNoteAction.bind(null, o.id)} className="stack">
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="label">Call note <span className="opt">(shown to whoever packs it)</span></span>
                    <textarea className="textarea" name="callNote" defaultValue={o.callNote ?? ""} maxLength={500} rows={2} placeholder="Said deliver after 6pm" data-testid="call-note-input" />
                  </label>
                  <SubmitButton className="btn btn-secondary btn-sm" pending="Saving…">Save call note</SubmitButton>
                </form>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>{o.tags.length ? o.tags.join(", ") : "No labels."}</p>
            )}
          </section>

          {canEdit && o.customerPhone && (
            <section className="card" data-testid="message-card">
              <div className="card-head"><h2>Message the customer</h2></div>
              <form action={messageAction.bind(null, o.id)} className="stack">
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">SMS to {prettyPhone(o.customerPhone)} <span className="opt">(uses one SMS credit; their reply comes to your own phone)</span></span>
                  <textarea className="textarea" name="text" rows={2} maxLength={200} required placeholder={`Your parcel goes out tomorrow. Please keep ${taka(o.totals.total)} ready.`} data-testid="message-text" />
                </label>
                <SubmitButton className="btn btn-secondary btn-sm" pending="Sending…" data-testid="message-send">Send SMS</SubmitButton>
              </form>
            </section>
          )}

          <section className="card" data-testid="delivery-card">
            <div className="card-head"><h2>Delivery</h2></div>
            <div>{o.address.line}</div>
            <div className="muted">{o.address.area}, {o.address.district} · {o.address.division}</div>
            {o.notes && <div className="notice info" style={{ marginTop: 10 }}>Customer note: {o.notes}</div>}
            {canEdit && o.canEditAddress && <div style={{ marginTop: 10 }}><AddressEditor orderId={o.id} value={{ name: o.customerName, line: o.address.line, area: o.address.area, district: o.address.district, division: o.address.division }} /></div>}
          </section>

          <section className="card" id="courier-card" data-testid="courier-card">
            <div className="card-head"><h2>Courier</h2>{o.courier.status && <span className={`pill ${o.courier.status === "DELIVERED" ? "ok" : o.courier.status === "HOLD" ? "warn" : o.courier.status === "RETURNED" || o.courier.status === "REFUSED" ? "bad" : "info"}`} data-testid="courier-status">{COURIER_STATUS_LABELS[o.courier.status]}</span>}</div>
            {o.courier.provider && (
              <dl className="kv">
                <dt>Courier</dt><dd>{courierName(o.courier.provider)}</dd>
                {o.courier.trackingCode && (<><dt>Tracking</dt><dd data-testid="tracking">{o.courier.trackingUrl ? <a className="link" href={o.courier.trackingUrl} target="_blank" rel="noopener noreferrer">{o.courier.trackingCode}</a> : o.courier.trackingCode}</dd></>)}
                {o.courier.bookedAt && (<><dt>Booked</dt><dd>{dateTime(o.courier.bookedAt)}</dd></>)}
                {o.courier.syncedAt && o.status === "SHIPPED" && (<><dt>Last checked</dt><dd>{dateTime(o.courier.syncedAt)}</dd></>)}
                {o.courier.fee != null && (<><dt>Courier charge</dt><dd className="num">{taka(o.courier.fee)}</dd></>)}
              </dl>
            )}
            {o.courier.consignmentId && o.status === "SHIPPED" && (
              <form action={refreshCourierAction.bind(null, o.id)} style={{ marginTop: 10 }}><SubmitButton className="btn btn-secondary btn-sm" pending="Checking…">Check status now</SubmitButton></form>
            )}
            {canBook && couriers.length > 0 && (
              <form action={bookAction.bind(null, o.id)} className="stack" style={{ marginTop: 4 }} data-testid="book-form">
                <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="label">Book with</legend>
                  <div className="chips">
                    {couriers.map((c) => (
                      <label key={c.provider} className="chip" style={{ cursor: "pointer" }}>
                        <input type="radio" name="provider" value={c.provider} defaultChecked={c.provider === preferred} required /> {c.label}{c.mode === "TEST" ? " (test)" : ""}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="row-2">
                  <label className="field" style={{ marginBottom: 0 }}><span className="label">Weight (kg)</span><input className="input" name="weight" type="number" inputMode="decimal" step="0.1" min="0.1" max="30" defaultValue="0.5" /></label>
                  <label className="field" style={{ marginBottom: 0 }}><span className="label">Note to courier <span className="opt">(optional)</span></span><input className="input" name="note" maxLength={150} defaultValue={o.notes ?? ""} /></label>
                </div>
                <p className="muted" style={{ fontSize: 13 }}>{o.paymentMethod === "COD" && o.paymentStatus !== "PAID" ? `The courier will collect ${taka(o.totals.total)}.` : "Already paid. The courier collects nothing."}</p>
                <SubmitButton className="btn btn-primary btn-block btn-lg" pending="Booking…" disabled={held}>Book courier</SubmitButton>
                {held && <p className="err" role="alert">Release the hold above before booking.</p>}
              </form>
            )}
            {canBook && couriers.length === 0 && (
              <div className="notice info" style={{ marginTop: 4 }}>Connect Steadfast, Pathao or RedX with your own keys to book parcels from here. <Link href="/settings/apps?open=steadfast_courier" className="link" prefetch={false}>Add courier keys</Link></div>
            )}
            {canBook && (
              <details style={{ marginTop: 12 }} data-testid="manual-ship">
                <summary className="link" style={{ cursor: "pointer" }}>Deliver it yourself, or book outside this app</summary>
                <form action={shipAction.bind(null, o.id)} className="stack" style={{ marginTop: 10 }}>
                  <label className="field" style={{ marginBottom: 0 }}><span className="label">Tracking code <span className="opt">(optional)</span></span><input className="input" name="tracking" maxLength={60} /></label>
                  <SubmitButton className="btn btn-secondary btn-block" pending="Saving…">Hand over and mark shipped</SubmitButton>
                </form>
              </details>
            )}
            {!o.courier.provider && !canBook && <p className="muted">Not shipped yet.</p>}
          </section>

          {canCancel && (
            <section className="card">
              <details>
                <summary className="link" style={{ cursor: "pointer" }}>Cancel this order</summary>
                <form action={statusAction.bind(null, o.id, "CANCELLED")} className="stack" style={{ marginTop: 12, gap: 8 }}>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="label">Reason</span>
                    <select className="select" name="reasonKey" defaultValue="Customer requested cancellation">
                      <option value="Customer requested cancellation">Customer requested cancellation (গ্রাহক বাতিল করতে বলেছেন)</option>
                      <option value="Customer unreachable / phone switched off">Customer unreachable / phone switched off (ফোন বন্ধ / রিসিভ করেননি)</option>
                      <option value="Customer refused advance delivery charge">Customer refused advance delivery charge (অগ্রিম ডেলিভারি ফি দেননি)</option>
                      <option value="High courier fraud risk / low delivery ratio">High courier return risk / low delivery ratio (কুরিয়ার রিটার্ন ঝুঁকি)</option>
                      <option value="Duplicate or test order">Duplicate or test order (ডুপ্লিকেট / টেস্ট অর্ডার)</option>
                      <option value="Item out of stock or damaged">Item out of stock or damaged (পণ্য স্টক শেষ)</option>
                      <option value="Other">Other reason (অন্যান্য)</option>
                    </select>
                  </label>
                  <input className="input" name="reasonNote" maxLength={150} placeholder="Additional note (optional)" aria-label="Additional note" />
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>The items go back into stock.</p>
                  <SubmitButton className="btn btn-danger btn-block" pending="Cancelling…">Cancel order</SubmitButton>
                </form>
              </details>
            </section>
          )}
          {canEdit && o.status === "DELIVERED" && (
            <section className="card"><Link href={`/returns/new?order=${o.id}`} className="btn btn-secondary btn-block" prefetch={false} data-testid="start-return">Start a return or exchange</Link></section>
          )}
          {canEdit && (o.status === "SHIPPED" || o.status === "DELIVERED") && (
            <section className="card">
              <div className="row">
                {o.status === "SHIPPED" && <form action={statusAction.bind(null, o.id, "DELIVERED")}><SubmitButton className="btn btn-secondary">Mark delivered</SubmitButton></form>}
              </div>
              <details style={{ marginTop: 10 }}>
                <summary className="link" style={{ cursor: "pointer" }}>The parcel came back</summary>
                <form action={returnedAction.bind(null, o.id)} className="stack" style={{ marginTop: 10 }} data-testid="returned-form">
                  <label className="row" style={{ flexWrap: "nowrap", gap: 8 }}><input type="checkbox" name="refused" style={{ width: 20, height: 20 }} /> The customer refused it at the door</label>
                  <input className="input" name="reason" maxLength={150} placeholder="What happened? (optional)" aria-label="What happened" />
                  <SubmitButton className="btn btn-danger btn-block" pending="Saving…">Mark returned. Items go back in stock</SubmitButton>
                </form>
              </details>
            </section>
          )}
        </div>
      </div>

      {step && (
        <div className="sticky-actions" data-testid="next-step">
          {step === "verify" && <form action={verifyAction.bind(null, o.id)} className="only-mobile" style={{ flex: 1 }}><SubmitButton className="btn btn-success btn-block btn-lg" pending="Confirming…">I received it. Mark as paid</SubmitButton></form>}
          {step === "confirm" && <form action={statusAction.bind(null, o.id, "CONFIRMED")} style={{ flex: 1 }}><SubmitButton className="btn btn-primary btn-block btn-lg" pending="Confirming…">Confirm order</SubmitButton></form>}
          {step === "pack" && <form action={statusAction.bind(null, o.id, "PROCESSING")} style={{ flex: 1 }}><SubmitButton className="btn btn-primary btn-block btn-lg" pending="Saving…">Mark as packed</SubmitButton></form>}
          {step === "ship" && <a href="#courier-card" className="btn btn-primary btn-block btn-lg only-mobile">Book courier or ship</a>}
          {step === "deliver" && <form action={statusAction.bind(null, o.id, "DELIVERED")} style={{ flex: 1 }}><SubmitButton className="btn btn-primary btn-block btn-lg" pending="Saving…">Mark delivered</SubmitButton></form>}
        </div>
      )}
    </div>
  );
}
