import type { Metadata } from "next";
import Link from "next/link";
import { getAccount, getAccountView, getStoreInfo, reviewableItems, signOrderAccess } from "@biztrackbd/core";
import { AccountLogin } from "@/components/account-login";
import { ReviewForm } from "@/components/review-form";
import { RewardsPanel } from "@/components/rewards-panel";
import { getOrigin } from "@/lib/origin";
import { signOut } from "@/app/actions";
import { getLang, makeT, money, num, pickStrings, toBnDigits, type Key } from "@/lib/i18n";
import { LOGIN_STRINGS } from "@/lib/strings";
import { getCustomerSession } from "@/lib/session";
import { getStore, requireCommerce } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

const STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
const tone = (status: string) => (status === "DELIVERED" ? "ok" : status === "CANCELLED" || status === "RETURNED" || status === "REFUNDED" ? "bad" : "warn");

export default async function Account() {
  const store = await getStore();
  await requireCommerce(store.id);
  const lang = await getLang(store.locale);
  const t = makeT(lang);
  const session = await getCustomerSession(store.id);
  const data = session ? await getAccount(store.id, session.customerId) : null;

  if (!session || !data) {
    return <div className="wrap" style={{ paddingBottom: 48 }}><h1 className="page-title">{t("account")}</h1><AccountLogin s={pickStrings(lang, LOGIN_STRINGS)} lang={lang} /></div>;
  }

  const info = await getStoreInfo(store.id);
  const rewards = await getAccountView(store.id, session.customerId);
  const origin = await getOrigin();
  const toReview = (await reviewableItems(store.id, session.customerId)).filter((i) => !i.alreadyReviewed);
  const phone = lang === "bn" ? toBnDigits(data.customer.phone) : data.customer.phone;
  const dateFmt = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });

  return (
    <div className="wrap" style={{ paddingBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "24px 0 8px" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--tint-1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }} aria-hidden="true">{(data.customer.name || "·").trim().slice(0, 2).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{data.customer.name || phone}</div>
          <div className="muted num" style={{ fontSize: 13 }}>{phone}</div>
        </div>
        <form action={signOut}><button className="link-btn" type="submit">{t("signOut")}</button></form>
      </div>

      {rewards && <RewardsPanel view={rewards} lang={lang} t={t} origin={origin} storeName={info.storeName} />}

      <h1 className="page-title" style={{ fontSize: 22, padding: "16px 0 12px" }}>{t("myOrders")}</h1>
      {data.orders.length === 0 ? (
        <div className="empty">{t("noOrders")}</div>
      ) : (
        data.orders.map((o) => {
          const stepIndex = STEPS.indexOf(o.status as (typeof STEPS)[number]);
          const payKey = `pay_${o.paymentStatus}` as Key;
          return (
            <Link key={o.id} href={`/order/${o.id}?k=${encodeURIComponent(signOrderAccess(store.id, o.id))}`} className="order-row" data-testid="account-order">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <b style={{ flex: 1 }}>{lang === "bn" ? toBnDigits(o.orderNumber) : o.orderNumber}</b>
                <span className={`pill ${tone(o.status)}`}>{t(`st_${o.status}` as Key)}</span>
              </div>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>{dateFmt.format(o.createdAt)} · {t("itemsN", { n: num(o.itemCount, lang) })} · {money(o.totalAmount, lang)}</div>
              {o.paymentStatus !== "PAID" && o.status !== "CANCELLED" && <div style={{ fontSize: 13, marginTop: 6, color: "var(--warn)", fontWeight: 600 }}>{t(payKey)}</div>}
              {stepIndex >= 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 10 }} aria-hidden="true">
                  {STEPS.map((_, i) => <i key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stepIndex ? "var(--accent)" : "var(--line)" }} />)}
                </div>
              )}
            </Link>
          );
        })
      )}
      {toReview.length > 0 && (
        <section style={{ marginTop: 28 }} aria-labelledby="rate" data-testid="to-review">
          <h2 id="rate" style={{ fontSize: 20, marginBottom: 12 }}>{t("rateYourItems")}</h2>
          <div className="stack">
            {toReview.map((i) => (
              <ReviewForm key={i.productId} productId={i.productId} title={i.title} done={false}
                text={{ writeReview: t("writeReview"), yourRating: t("yourRating"), reviewTitleOpt: t("reviewTitleOpt"), reviewBody: t("reviewBody"), submitReview: t("submitReview"), reviewThanks: t("reviewThanks"), reviewThanksPending: t("reviewThanksPending"), reviewFailed: t("reviewFailed"), starsN: t("starsN", { n: "{n}" }) }} />
            ))}
          </div>
        </section>
      )}
      {info.contactPhone && <p style={{ marginTop: 20 }}><a className="link-btn" href={`tel:${info.contactPhone}`}>{t("contactStore")}: {info.contactPhone}</a></p>}
    </div>
  );
}
