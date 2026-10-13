import type { Metadata } from "next";
import { getStoreInfo } from "@biztrackbd/core";
import { getLang } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";
import { ContactForm } from "./contact-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact us" };

const T = {
  en: { title: "Contact us", sub: "Ask us anything about an order or a product. We reply by SMS.", call: "Or call us", whatsapp: "WhatsApp" },
  bn: { title: "যোগাযোগ", sub: "অর্ডার বা পণ্য নিয়ে যা জানতে চান লিখুন। আমরা SMS-এ উত্তর দেব।", call: "অথবা ফোন করুন", whatsapp: "হোয়াটসঅ্যাপ" },
} as const;

export default async function Contact() {
  const store = await getStore();
  const lang = await getLang(store.locale);
  const info = await getStoreInfo(store.id);
  const t = T[lang];
  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <h1 className="page-title" style={{ paddingBottom: 4 }}>{t.title}</h1>
      <p style={{ marginTop: 0 }}>{t.sub}</p>
      <ContactForm lang={lang} />
      {(info.contactPhone || info.whatsappNumber) && (
        <p style={{ marginTop: 18 }}>
          {t.call}: {info.contactPhone && <a href={`tel:${info.contactPhone}`}>{info.contactPhone}</a>}
          {info.contactPhone && info.whatsappNumber ? " · " : ""}
          {info.whatsappNumber && <a href={`https://wa.me/88${info.whatsappNumber}`} rel="noopener noreferrer">{t.whatsapp}</a>}
        </p>
      )}
    </div>
  );
}
