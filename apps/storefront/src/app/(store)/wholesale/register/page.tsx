import type { Metadata } from "next";
import { getStoreInfo, getWholesaleSettings } from "@biztrackbd/core";
import { getLang } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";
import { WholesaleRegisterForm } from "./wholesale-register-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Wholesale & B2B Reseller Portal",
  description: "Apply for wholesale trade pricing, bulk discounts, and direct reseller partnership.",
};

export default async function WholesaleRegisterPage() {
  const store = await getStore();
  const lang = await getLang(store.locale);
  const [info, wholesaleSettings] = await Promise.all([
    getStoreInfo(store.id),
    getWholesaleSettings(store.id),
  ]);

  if (!wholesaleSettings.wholesaleAllowRegistration) {
    return (
      <div className="wrap" style={{ maxWidth: 640, textAlign: "center", padding: "60px 20px" }}>
        <h1 className="page-title">
          {lang === "bn" ? "পাইকারি আবেদন বর্তমানে বন্ধ আছে" : "Wholesale Registration Currently Closed"}
        </h1>
        <p className="muted">
          {lang === "bn"
            ? "পাইকারি পার্টনারশিপের জন্য অনুগ্রহ করে আমাদের সাথে সরাসরি ফোনে যোগাযোগ করুন।"
            : "Direct dealer applications are currently closed. Please contact us directly by phone for bulk purchases."}
        </p>
        {info.contactPhone && (
          <a href={`tel:${info.contactPhone}`} className="btn btn-primary" style={{ marginTop: 14 }}>
            {info.contactPhone}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 680, padding: "20px 16px 60px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <span
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 20,
            background: "rgba(79, 70, 229, 0.1)",
            color: "#4f46e5",
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 8,
          }}
        >
          {lang === "bn" ? "পাইকারি ও ডিলার পার্টনারশিপ" : "B2B Trade & Wholesale Portal"}
        </span>
        <h1 className="page-title" style={{ margin: "4px 0 8px", fontSize: 26, fontWeight: 800 }}>
          {lang === "bn" ? "পাইকারি রিসেলার হিসেবে যোগ দিন" : "Become an Authorized Bulk Reseller"}
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>
          {lang === "bn"
            ? "আপনার বুটিক, শপ বা এফ-কমার্সের জন্য বিশেষ পাইকারি দাম, ভলিউম ডিসকাউন্ট ও দ্রুত ডেলিভারির সুবিধা পান।"
            : "Unlock trade tier discounts (15% to 35% off), bulk quantity pricing, verified B2B Tax Invoices, and priority courier shipping."}
        </p>
      </div>

      <div
        className="grid grid-3"
        style={{
          gap: 12,
          marginBottom: 24,
          padding: 16,
          background: "var(--bg-subtle, #f9fafb)",
          borderRadius: 12,
          border: "1px solid var(--line, #e5e7eb)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6, color: "var(--ink-2, #6b7280)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {lang === "bn" ? "বিশেষ পাইকারি মূল্য" : "Wholesale Rates"}
          </div>
          <div className="muted" style={{ fontSize: 11.5 }}>
            {lang === "bn" ? "রিটেইল দামের চেয়ে কম" : "Up to 35% trade discount"}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6, color: "var(--ink-2, #6b7280)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {lang === "bn" ? "ক্যাশ অন ডেলিভারি" : "Flexible COD"}
          </div>
          <div className="muted" style={{ fontSize: 11.5 }}>
            {lang === "bn" ? "অগ্রিম জমা দিয়ে বাকিটা COD" : "Deposit + door collection"}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6, color: "var(--ink-2, #6b7280)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {lang === "bn" ? "বাণিজ্যিক চালান" : "Official Challans"}
          </div>
          <div className="muted" style={{ fontSize: 11.5 }}>
            {lang === "bn" ? "BIN/TIN সহ ভ্যাট বিল" : "B2B Invoices & signatures"}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, borderRadius: 12, border: "1px solid var(--line, #e5e7eb)" }}>
        <WholesaleRegisterForm
          lang={lang}
          contactPhone={info.contactPhone}
          whatsappNumber={info.whatsappNumber}
        />
      </div>
    </div>
  );
}
