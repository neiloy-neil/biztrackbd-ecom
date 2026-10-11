import { cookies } from "next/headers";
import { getReferralOffer } from "@biztrackbd/core";
import { money, type Lang, type T } from "@/lib/i18n-core";

/** "Anisa gave you ৳50 off your first order": shown to anyone who arrived through a friend's link. */
export async function ReferralBanner({ tenantId, lang, t }: { tenantId: string; lang: Lang; t: T }) {
  const code = (await cookies()).get("bt_ref")?.value;
  if (!code) return null;
  const offer = await getReferralOffer(tenantId, code);
  if (!offer) return null;
  return <div className="referral-banner" role="note" data-testid="referral-banner">{t("referBanner", { name: offer.referrerName, d: money(offer.discount, lang).replace(/^৳\s?/, "") })}</div>;
}
