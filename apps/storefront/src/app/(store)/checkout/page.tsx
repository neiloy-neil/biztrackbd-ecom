import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getAccountView, getLoyaltyPublic, getReferralOffer, getStoreInfo, getStoreUddoktaPayConfig, resolveRecovery } from "@biztrackbd/core";
import { CheckoutForm } from "@/components/checkout-form";
import { PausedCard } from "@/components/paused-notice";
import { getLang, makeT, pickStrings } from "@/lib/i18n";
import { getCustomerSession } from "@/lib/session";
import { CHECKOUT_STRINGS, LOYALTY_STRINGS } from "@/lib/strings";
import { getStore, requireCommerce } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

const ERRORS = {
  en: {
    phone: "Enter a valid mobile number, like 1712-345678", name: "Enter your full name", email: "Enter a valid email or leave it empty",
    upazila: "Choose your upazila or thana", address: "Enter your house, road and area", mfsSender: "Enter the number you sent money from",
    trxId: "Enter the TrxID from the SMS (8 to 12 letters and numbers)",
  },
  bn: {
    phone: "সঠিক মোবাইল নম্বর দিন, যেমন 1712-345678", name: "আপনার পুরো নাম লিখুন", email: "সঠিক ইমেইল দিন অথবা ফাঁকা রাখুন",
    upazila: "উপজেলা বা থানা বেছে নিন", address: "বাড়ি, রাস্তা ও এলাকা লিখুন", mfsSender: "যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি লিখুন",
    trxId: "SMS থেকে TrxID লিখুন (৮ থেকে ১২টি অক্ষর ও সংখ্যা)",
  },
} as const;

export default async function Checkout({ searchParams }: { searchParams: Promise<{ recover?: string }> }) {
  const { recover } = await searchParams;
  const store = await getStore();
  await requireCommerce(store.id);
  const lang = await getLang(store.locale);
  const info = await getStoreInfo(store.id);
  // The owner paused orders: show the "short break" notice instead of a form that could not be sent.
  if (info.ordersPaused) {
    return (
      <div className="wrap">
        <h1 className="page-title" style={{ paddingBottom: 4 }}>{lang === "bn" ? "চেকআউট" : "Checkout"}</h1>
        <PausedCard info={info} t={makeT(lang)} />
      </div>
    );
  }
  // The secret in the SMS link restores the cart that customer left. Anything else is ignored.
  const pub = await getLoyaltyPublic(store.id);
  const session = await getCustomerSession(store.id);
  const view = session ? await getAccountView(store.id, session.customerId) : null;
  const refCode = (await cookies()).get("bt_ref")?.value;
  const offer = refCode ? await getReferralOffer(store.id, refCode) : null;
  const restored = recover ? await resolveRecovery(store.id, recover).catch(() => null) : null;
  const uddoktaConfig = await getStoreUddoktaPayConfig(store.id).catch(() => null);
  return (
    <div className="wrap">
      <h1 className="page-title" style={{ paddingBottom: 4 }}>{lang === "bn" ? "চেকআউট" : "Checkout"}</h1>
      <CheckoutForm
        lang={lang}
        s={pickStrings(lang, CHECKOUT_STRINGS)}
        errorsText={ERRORS[lang]}
        recover={restored}
        loyalty={{ s: pickStrings(lang, LOYALTY_STRINGS), pointsOn: pub.enabled, signedIn: Boolean(session), available: view?.available ?? 0, worth: view?.worthBdt ?? 0, referralCode: offer?.code ?? "", referralOn: pub.referralEnabled }}
        pay={{ bkashNumber: info.bkashNumber, bkashKind: info.bkashKind, nagadNumber: info.nagadNumber, nagadKind: info.nagadKind, paymentNote: info.paymentNote, uddoktapayEnabled: Boolean(uddoktaConfig?.apiKey) }}
      />
    </div>
  );
}
