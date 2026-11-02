import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  createOrderDownloadToken,
  customerExchangeVariants,
  customerReturnableItems,
  getOrderTrackingTimeline,
  verifyOrderAccess,
} from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { CheckIcon } from "@/components/icons";
import { tintFor } from "@/components/product-image";
import { PurchaseTracker } from "@/components/tracker";
import { OrderTrackingTimelineComponent } from "@/components/order-tracking-timeline";
import { ReturnStatusTrackerComponent } from "@/components/return-status-tracker";
import { CustomerReturnFormComponent } from "@/components/customer-return-form";
import { PaymentRecoveryCard } from "@/components/payment-recovery-card";
import { getLang, makeT, money, num, toBnDigits } from "@/lib/i18n";
import { getCustomerSession } from "@/lib/session";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";
// An order page is private to whoever holds the link. Never index it, never cache it.
export const metadata: Metadata = { title: "Order placed", robots: { index: false, follow: false }, referrer: "no-referrer" };

function dateRange(from: Date, minDays: number, maxDays: number, lang: "en" | "bn") {
  const add = (d: number) => new Date(from.getTime() + d * 86_400_000);
  const a = add(minDays);
  const b = add(maxDays);
  const fmt = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", timeZone: "Asia/Dhaka" });
  const dayOnly = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", timeZone: "Asia/Dhaka" });
  return a.getMonth() === b.getMonth() ? `${dayOnly.format(a)} ${lang === "bn" ? "থেকে" : "to"} ${fmt.format(b)}` : `${fmt.format(a)} ${lang === "bn" ? "থেকে" : "to"} ${fmt.format(b)}`;
}

export default async function OrderPlaced({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ k?: string; token?: string; paymentStatus?: string; cancelled?: string; paid?: string }>;
}) {
  const [{ orderId }, sp] = await Promise.all([params, searchParams]);
  const k = sp.k || sp.token;
  const { paymentStatus, cancelled, paid } = sp;
  const store = await getStore();
  const lang = await getLang(store.locale);
  const t = makeT(lang);
  const found = await withTenant(store.id, async (tx) => {
    const order = await tx.order.findFirst({
      relationLoadStrategy: "join",
      where: { id: orderId },
      include: {
        items: {
          include: {
            variant: { select: { imageUrl: true } },
            product: { select: { slug: true, titleBn: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
          },
        },
      },
    });
    if (!order) return null;
    const zone = await tx.shippingZone.findFirst({ where: { name: order.deliveryZone } });
    return { order, zone };
  });
  if (!found) notFound();
  const { order, zone } = found;

  // Open to whoever holds the signed link, or to the signed-in customer who placed it. Everyone else sees a plain 404.
  const session = await getCustomerSession(store.id);
  const auth = { customerId: session?.customerId, token: k };
  if (!verifyOrderAccess(store.id, orderId, k) && !(session && order.customerId === session.customerId)) notFound();

  // Load live tracking timeline and returns eligibility
  const [timeline, returnable] = await Promise.all([
    getOrderTrackingTimeline(store.id, orderId, auth),
    customerReturnableItems(store.id, orderId, auth),
  ]);

  const exchangeVariants = returnable.eligible && !returnable.activeReturn
    ? await customerExchangeVariants(store.id, orderId, auth)
    : [];

  const first = order.customerName.trim().split(/\s+/)[0] ?? "";
  const phone = lang === "bn" ? toBnDigits(order.customerPhone) : order.customerPhone;
  const isMfs = order.paymentMethod !== "COD";
  const mfsName = order.paymentMethod === "MANUAL_BKASH" ? t("bkash") : t("nagad");
  const place = [order.shippingCity, order.shippingDistrict].filter(Boolean).join(", ");

  return (
    <div className="wrap">
      <PurchaseTracker orderId={order.id} token={k} />
      <div className="center-card stack" data-testid="order-success">
        <div className="card" style={{ padding: 22 }}>
          <div className="big-check"><CheckIcon /></div>
          <h1 style={{ fontSize: 24, letterSpacing: -0.4 }}>{t("thanks", { name: first })}</h1>
          <p style={{ marginTop: 8 }}>{t("orderPlaced", { number: lang === "bn" ? toBnDigits(order.orderNumber) : order.orderNumber })}</p>
          <p className="muted" style={{ marginTop: 4 }}>{t("sentDetails", { phone })}</p>
        </div>

        {/* Digital Fulfillment Card OR Physical Courier Tracking Timeline */}
        {order.isDigital ? (
          <div className="card" style={{ borderColor: "#0f766e", background: "#f0fdfa", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span className="pill" style={{ background: "#0f766e", color: "#fff", fontWeight: 700 }}>⚡ {lang === "bn" ? "ডিজিটাল সেবা / পণ্য" : "Digital Service / Goods"}</span>
              <span style={{ fontSize: 13, color: "#0f766e", fontWeight: 600 }}>
                {order.paymentStatus === "PAID"
                  ? (lang === "bn" ? "পেমেন্ট সফল ও নিশ্চিত" : "Payment Verified")
                  : (lang === "bn" ? "পেমেন্ট যাচাই চলছে" : "Payment Pending")}
              </span>
            </div>

            {order.paymentStatus === "PAID" ? (
              <div>
                <p style={{ margin: "4px 0 14px", fontSize: 14, color: "#134e4a", lineHeight: 1.5 }}>
                  {lang === "bn"
                    ? "আপনার ডিজিটাল সেবা বা ডকুমেন্টের অর্ডার সফলভাবে গ্রহণ করা হয়েছে। আমাদের টিম খতিয়ান/রেকর্ড প্রস্তুত হওয়া মাত্রই আপনার মোবাইল ও ইমেইলে পাঠিয়ে দেবে।"
                    : "Your digital service or document order has been placed. Our team will deliver the asset to your phone & email as soon as it is processed."}
                </p>

                {order.items.map((it) => {
                  const downloadUrl = it.digitalDeliveryUrl
                    ? `/d/${createOrderDownloadToken(store.id, order.id, it.id)}`
                    : null;
                  const custom = (it.digitalCustomValues && typeof it.digitalCustomValues === "object") ? (it.digitalCustomValues as Record<string, string>) : null;

                  return (
                    <div key={it.id} style={{ background: "#fff", border: "1px solid #ccfbf1", borderRadius: 8, padding: 14, marginBottom: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: "#0f766e", marginBottom: 6 }}>
                        {it.productTitle}
                      </div>

                      {downloadUrl ? (
                        <div style={{ marginTop: 10 }}>
                          <a
                            href={downloadUrl}
                            className="btn btn-primary btn-round"
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0f766e" }}
                          >
                            ⬇️ {lang === "bn" ? "ডিজিটাল ফাইল ডাউনলোড করুন" : "Download Digital File"}
                          </a>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: "#0d9488", display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                          <span>📄</span>
                          <span>
                            {lang === "bn"
                              ? "আপনার খতিয়ান / জমির রেকর্ড সেবাটি বর্তমানে প্রসেসিং রয়েছে।"
                              : "This digital asset / service is currently being processed."}
                          </span>
                        </div>
                      )}

                      {custom && Object.keys(custom).length > 0 && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #e2e8f0" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                            {lang === "bn" ? "আপনার দেওয়া তথ্য (জমির বিবরণ)" : "Your Submitted Details"}
                          </span>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 6, fontSize: 13 }}>
                            {Object.entries(custom).map(([k, v]) => (
                              <div key={k}>
                                <span style={{ color: "#64748b" }}>{k}: </span>
                                <b>{String(v)}</b>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13.5, color: "#92400e" }}>
                {lang === "bn"
                  ? "আপনার পেমেন্ট যাচাই হওয়ার সাথে সাথে ডিজিটাল সেবাটি সক্রিয় হবে।"
                  : "Your digital service will be processed as soon as payment is confirmed."}
              </p>
            )}
          </div>
        ) : (
          <OrderTrackingTimelineComponent timeline={timeline} lang={lang} />
        )}

        {order.paymentStatus === "PAID" ? (
          <div className="card" style={{ borderColor: "#16a34a", background: "#f0fdf4" }}>
            <h2 style={{ marginBottom: 4, color: "#15803d", fontSize: 16 }}>
              {lang === "bn" ? "পেমেন্ট সফলভাবে সম্পন্ন হয়েছে" : "Payment Received Successfully"}
            </h2>
            <p className="muted" style={{ fontSize: 14 }}>
              {order.mfsTrxId
                ? `${lang === "bn" ? "ট্রানজেকশন আইডি" : "TrxID"}: ${order.mfsTrxId} · ${money(Number(order.totalAmount), lang)}`
                : money(Number(order.totalAmount), lang)}
            </p>
          </div>
        ) : isMfs && order.paymentStatus === "PENDING_VERIFICATION" ? (
          <div className="card" style={{ borderColor: "var(--bkash)", background: "#FFF9FC" }}>
            <h2 style={{ marginBottom: 6 }}>{mfsName}: {t("checkingPayment")}</h2>
            <p className="muted" style={{ fontSize: 14 }}>{t("checkingPaymentS", { trx: order.mfsTrxId ?? "", amount: money(Number(order.totalAmount), lang) })}</p>
          </div>
        ) : order.paymentMethod !== "COD" && order.paymentStatus === "UNPAID" ? (
          <PaymentRecoveryCard
            orderId={order.id}
            token={k}
            lang={lang}
            isCancelledOrFailed={Boolean(cancelled || (paymentStatus && paymentStatus !== "success"))}
            totalAmount={Number(order.totalAmount)}
          />
        ) : (
          <div className="card">
            <p style={{ fontWeight: 600 }}>{t("codSuccess", { amount: money(Number(order.totalAmount), lang) })}</p>
            <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>{t("callToConfirm")}</p>
          </div>
        )}

        <div className="card">
          {order.items.map((i) => {
            const img = i.variant?.imageUrl ?? i.product.images[0]?.url ?? null;
            const title = lang === "bn" && i.product.titleBn ? i.product.titleBn : i.productTitle;
            return (
              <div key={i.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 12, alignItems: "center", padding: "8px 0" }}>
                <div className="pimg" style={{ background: tintFor(i.productId), borderRadius: 8 }}>{img && <Image src={img} alt="" fill sizes="56px" quality={55} />}</div>
                <div><div style={{ fontWeight: 600, fontSize: 14.5 }}>{title}</div><div className="muted" style={{ fontSize: 12.5 }}>{i.variantTitle && i.variantTitle.toLowerCase() !== "default" ? `${i.variantTitle} · ` : ""}{num(i.quantity, lang)}</div></div>
                <div className="num" style={{ fontWeight: 600 }}>{money(Number(i.totalPrice), lang)}</div>
              </div>
            );
          })}
          <div className="totals" style={{ marginTop: 10, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <div className="r"><span>{t("subtotal")}</span><span className="num">{money(Number(order.subtotalAmount), lang)}</span></div>
            {Number(order.discountAmount) > 0 && <div className="r"><span>{t("discount")} {order.couponCode}</span><span className="num">−{money(Number(order.discountAmount), lang)}</span></div>}
            {Number(order.tierDiscountBdt) + Number(order.referralDiscountBdt) + Number(order.loyaltyDiscountBdt) > 0 && <div className="r"><span>{t("memberDiscounts")}</span><span className="num">−{money(Number(order.tierDiscountBdt) + Number(order.referralDiscountBdt) + Number(order.loyaltyDiscountBdt), lang)}</span></div>}
            <div className="r"><span>{order.isDigital ? (lang === "bn" ? "ডেলিভারি চার্জ (ডিজিটাল)" : "Delivery Fee (Digital)") : t("deliveryTo", { place })}</span><span className="num">{Number(order.deliveryCharge) === 0 ? t("free") : money(Number(order.deliveryCharge), lang)}</span></div>
            <div className="r grand"><span>{t("total")}</span><span className="num">{money(Number(order.totalAmount), lang)}</span></div>
          </div>
          {!order.isDigital && zone && <p className="muted" style={{ marginTop: 12, fontSize: 13.5 }}>{t("expectedDelivery")}: <b style={{ color: "var(--ink)" }}>{dateRange(order.createdAt, zone.etaMinDays, zone.etaMaxDays, lang)}</b></p>}
        </div>

        {/* Return Lifecycle: Active Status Card OR Return Request Form (Physical Goods Only) */}
        {!order.isDigital && (returnable.activeReturn ? (
          <ReturnStatusTrackerComponent returnRow={returnable.activeReturn} lang={lang} />
        ) : returnable.eligible ? (
          <CustomerReturnFormComponent
            orderId={order.id}
            token={k}
            returnable={returnable}
            exchangeVariants={exchangeVariants}
            lang={lang}
          />
        ) : null)}

        <div style={{ display: "grid", gap: 10 }}>
          <Link href="/account" className="btn btn-primary btn-block btn-round">{t("trackOrder")}</Link>
          <Link href="/" className="btn btn-ghost btn-block btn-round">{t("continueShopping")}</Link>
        </div>
      </div>
    </div>
  );
}
