import type { AccountView } from "@biztrackbd/core";
import { fmt, num, type Lang, type T } from "@/lib/i18n-core";
import { saveBirthdayAction } from "@/app/(store)/account/birthday-action";
import { ShareReferral } from "./share-referral";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

const TYPE_KEY = { EARN_PURCHASE: "ledgerEarn", REDEEM_PURCHASE: "ledgerRedeem", REFERRAL_BONUS: "ledgerBonus", MANUAL_ADJUSTMENT: "ledgerManual", TIER_BONUS: "ledgerBonus", EXPIRED: "ledgerExpired" } as const;

/** Points, VIP level, history and the referral link, on the customer's account page (docs/26 section 6). */
export function RewardsPanel({ view, lang, t, origin, storeName }: { view: AccountView; lang: Lang; t: T; origin: string; storeName: string }) {
  const tier = view.tier;
  const date = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
  const link = `${origin}/ref/${view.referralCode}`;
  return (
    <section className="card" style={{ marginTop: 16 }} aria-labelledby="rewards" data-testid="rewards">
      {view.enabled && (
        <>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <h2 id="rewards" style={{ fontSize: 20 }}>{t("rewardsTitle")}</h2>
              <div style={{ fontSize: 26, fontWeight: 800 }} data-testid="points-balance">{t("pointsCount", { n: num(view.available, lang) })}</div>
              <div className="muted" style={{ fontSize: 13.5 }}>{t("pointsWorth", { v: num(view.worthBdt, lang) })}{view.pending > 0 ? ` · ${t("pointsPendingN", { n: num(view.pending, lang) })}` : ""}</div>
            </div>
            <span className="pill ok" data-testid="tier-badge">{t("tierMember", { tier: tier.label })}</span>
          </div>
          {view.next ? (
            <div style={{ marginTop: 14 }}>
              <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.next.progressPercent} aria-label={t("tierProgress", { n: view.next.remainingBdt, next: view.next.tier.label })}><i style={{ width: `${view.next.progressPercent}%` }} /></div>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 6 }} data-testid="tier-progress">{t("tierProgress", { n: num(view.next.remainingBdt, lang), next: view.next.tier.label })}</div>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13.5, marginTop: 10 }}>{t("tierTop")}</div>
          )}
          <div style={{ marginTop: 14 }}>
            <b style={{ fontSize: 14 }}>{t("tierPerks")}</b>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
              <li>{t("perkMultiplier", { x: tier.multiplier })}</li>
              {tier.discountPercent > 0 && <li>{t("perkDiscount", { p: tier.discountPercent })}</li>}
              {tier.freeDelivery && <li>{t("perkFreeDelivery")}</li>}
            </ul>
          </div>
          {view.expiryMonths > 0 && <p className="muted" style={{ fontSize: 13, marginTop: 12 }} data-testid="expiry-note">{t("expiryNote", { m: num(view.expiryMonths, lang) })}</p>}
          {view.birthdayVoucher > 0 && (
            <div style={{ marginTop: 14 }} data-testid="birthday">
              <b style={{ fontSize: 14 }}>{t("birthdayTitle")}</b>
              {view.birth ? (
                <p className="muted" style={{ fontSize: 13.5, margin: "4px 0 0" }} data-testid="birthday-saved">{t("birthdaySaved", { d: `${num(view.birth.day, lang)} ${(lang === "bn" ? MONTHS_BN : MONTHS)[view.birth.month - 1]}` })} · {t("birthdayOnce")}</p>
              ) : (
                <form action={saveBirthdayAction} style={{ marginTop: 4 }}>
                  <p className="muted" style={{ fontSize: 13.5, margin: "0 0 8px" }}>{t("birthdayText", { v: num(view.birthdayVoucher, lang) })}</p>
                  <div className="row" style={{ gap: 8 }}>
                    <select className="select" name="month" aria-label={t("birthdayMonth")} defaultValue="" required style={{ width: "auto" }}>
                      <option value="" disabled>{t("birthdayMonth")}</option>
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{(lang === "bn" ? MONTHS_BN : MONTHS)[i]}</option>)}
                    </select>
                    <input className="input" name="day" type="number" min={1} max={31} inputMode="numeric" placeholder={t("birthdayDay")} aria-label={t("birthdayDay")} required style={{ width: 90 }} />
                    <button className="btn btn-secondary" type="submit">{t("birthdaySave")}</button>
                  </div>
                </form>
              )}
            </div>
          )}
          <h3 style={{ fontSize: 16, margin: "18px 0 6px" }}>{t("pointsHistory")}</h3>
          {view.ledger.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>{t("ledgerEmpty")}</p>
          ) : (
            <ul className="ledger" data-testid="ledger" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {view.ledger.map((l) => (
                <li key={l.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: 14 }}>
                  <span style={{ flex: 1 }}>
                    {t(TYPE_KEY[l.type as keyof typeof TYPE_KEY] ?? "ledgerManual")} <span className="muted">· {date.format(l.createdAt)}{l.status === "PENDING" ? ` · ${t("ledgerPending")}` : l.status === "VOIDED" ? ` · ${t("ledgerVoided")}` : ""}</span>
                  </span>
                  <b className="num" style={{ color: l.status === "VOIDED" ? "var(--muted)" : l.points < 0 ? "var(--danger)" : "var(--success)", textDecoration: l.status === "VOIDED" ? "line-through" : undefined }}>{l.points > 0 ? "+" : ""}{num(l.points, lang)}</b>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {view.referralEnabled && (
        <div style={{ marginTop: view.enabled ? 20 : 0 }} data-testid="referral-panel">
          <h2 style={{ fontSize: 18 }}>{t("referTitle")}</h2>
          <p className="muted" style={{ fontSize: 14, margin: "4px 0 10px" }}>{t("referText", { d: num(view.referralOffer.discount, lang), p: num(view.referralOffer.reward, lang) })}</p>
          <ShareReferral link={link} message={fmt(lang === "bn" ? "{store}-এ আমার পছন্দের কেনাকাটা! এই লিংকে প্রথম অর্ডারে পাবেন ৳{d} ছাড়:" : "I shop at {store}. You get ৳{d} off your first order with this link:", { store: storeName, d: view.referralOffer.discount })} labels={{ copy: t("copyLink"), copied: t("copied"), whatsapp: t("shareWhatsapp"), yourLink: t("yourReferralLink") }} />
          {view.referrals.total > 0 && <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{view.referrals.total} · {view.referrals.rewarded}</p>}
        </div>
      )}
    </section>
  );
}
