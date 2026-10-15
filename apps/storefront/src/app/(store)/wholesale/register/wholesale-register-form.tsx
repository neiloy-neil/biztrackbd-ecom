"use client";

import { useState, useTransition } from "react";
import { submitWholesaleApplicationAction } from "./actions";

interface Props {
  lang: "en" | "bn";
  contactPhone?: string | null;
  whatsappNumber?: string | null;
}

export function WholesaleRegisterForm({ lang, contactPhone, whatsappNumber }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    ok: boolean;
    status?: "PENDING" | "APPROVED";
    message?: string;
    error?: string;
  } | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    applicantName: "",
    phone: "",
    whatsappNumber: "",
    businessType: "Physical Boutique / Shop",
    tradeLicense: "",
    taxId: "",
    address: "",
    district: "Dhaka",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    startTransition(async () => {
      const res = await submitWholesaleApplicationAction({
        companyName: form.companyName,
        applicantName: form.applicantName,
        phone: form.phone,
        whatsappNumber: form.whatsappNumber || null,
        businessType: form.businessType,
        tradeLicense: form.tradeLicense || null,
        taxId: form.taxId || null,
        address: form.address || null,
        district: form.district || null,
      });

      if (res.ok) {
        setResult({ ok: true, status: res.status, message: res.message });
      } else {
        setResult({ ok: false, error: res.error });
      }
    });
  };

  if (result?.ok) {
    return (
      <div
        className="card"
        style={{
          padding: 24,
          borderRadius: 12,
          background: "linear-gradient(135deg, rgba(22, 163, 74, 0.08) 0%, rgba(22, 163, 74, 0.02) 100%)",
          border: "1px solid rgba(22, 163, 74, 0.3)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#166534", fontWeight: 700 }}>
          {lang === "bn" ? "আবেদন জমা হয়েছে!" : "Wholesale Application Received!"}
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 14.5, color: "#374151", lineHeight: 1.5 }}>
          {result.message}
        </p>

        <div
          style={{
            background: "#fff",
            padding: 14,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 13.5,
            textAlign: "left",
            margin: "0 auto 16px",
            maxWidth: 420,
          }}
        >
          <div><b>Store / Boutique:</b> {form.companyName}</div>
          <div><b>Contact Person:</b> {form.applicantName}</div>
          <div><b>Phone:</b> {form.phone}</div>
          <div><b>Status:</b> {result.status === "APPROVED" ? "Approved" : "Under Merchant Review"}</div>
        </div>

        {whatsappNumber && (
          <a
            href={`https://wa.me/88${whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
              `Hi, I have submitted a wholesale reseller application for "${form.companyName}". Phone: ${form.phone}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{
              display: "inline-block",
              background: "#25D366",
              borderColor: "#25D366",
              color: "#fff",
              padding: "10px 18px",
              fontWeight: 700,
              textDecoration: "none",
              borderRadius: 8,
            }}
          >
            {lang === "bn" ? "হোয়াটসঅ্যাপে ট্রেড লাইসেন্স পাঠান" : "Send Trade License on WhatsApp →"}
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
      {result?.error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "#fee2e2",
            border: "1px solid #ef4444",
            color: "#991b1b",
            fontSize: 13.5,
          }}
        >
          {result.error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13.5 }}>
            {lang === "bn" ? "দোকান / ব্যবসার নাম *" : "Store / Business Name *"}
          </label>
          <input
            type="text"
            className="input"
            required
            placeholder={lang === "bn" ? "যেমন: আনিকা ফ্যাশন বুটিক" : "e.g. Anika Fashion Boutique"}
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </div>

        <div>
          <label className="label" style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13.5 }}>
            {lang === "bn" ? "ব্যবসার ধরন" : "Business Type"}
          </label>
          <select
            className="input"
            value={form.businessType}
            onChange={(e) => setForm({ ...form, businessType: e.target.value })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="Physical Boutique / Shop">Physical Boutique / Shop</option>
            <option value="Facebook Page / F-Commerce">Facebook Page / F-Commerce</option>
            <option value="Online Website / Store">Online Website / Store</option>
            <option value="Wholesale Distributor">Wholesale Distributor</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13.5 }}>
            {lang === "bn" ? "মালিক / যোগাযোগকারীর নাম *" : "Owner / Contact Person *"}
          </label>
          <input
            type="text"
            className="input"
            required
            placeholder={lang === "bn" ? "আপনার নাম" : "Your full name"}
            value={form.applicantName}
            onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </div>

        <div>
          <label className="label" style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13.5 }}>
            {lang === "bn" ? "মোবাইল নম্বর *" : "Contact Phone Number *"}
          </label>
          <input
            type="tel"
            className="input"
            required
            placeholder="017XXXXXXXX"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13.5 }}>
            {lang === "bn" ? "হোয়াটসঅ্যাপ নম্বর (ঐচ্ছিক)" : "WhatsApp Number (Optional)"}
          </label>
          <input
            type="tel"
            className="input"
            placeholder="01XXXXXXXXX"
            value={form.whatsappNumber}
            onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </div>

        <div>
          <label className="label" style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13.5 }}>
            {lang === "bn" ? "জেলা *" : "District *"}
          </label>
          <input
            type="text"
            className="input"
            required
            placeholder="e.g. Dhaka, Chittagong, Sylhet"
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13.5 }}>
            {lang === "bn" ? "ট্রেড লাইসেন্স নম্বর (ঐচ্ছিক)" : "Trade License No. (Optional)"}
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. TRAD/DSCC/019283"
            value={form.tradeLicense}
            onChange={(e) => setForm({ ...form, tradeLicense: e.target.value })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </div>

        <div>
          <label className="label" style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13.5 }}>
            {lang === "bn" ? "ট্যাক্স / BIN নম্বর (ঐচ্ছিক)" : "Tax ID / BIN (Optional)"}
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g. 001928374-0101"
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </div>
      </div>

      <div>
        <label className="label" style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13.5 }}>
          {lang === "bn" ? "দোকান / ডেলিভারি ঠিকানা" : "Shop / Delivery Address"}
        </label>
        <textarea
          className="input"
          rows={2}
          placeholder={lang === "bn" ? "দোকানের বিস্তারিত ঠিকানা দিন" : "Complete shop address for wholesale dispatch"}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {isPending
            ? lang === "bn"
              ? "আবেদন পাঠানো হচ্ছে…"
              : "Submitting Application…"
            : lang === "bn"
            ? "পাইকারি পার্টনার হিসেবে আবেদন করুন"
            : "Submit Wholesale Partner Application →"}
        </button>
      </div>

      {contactPhone && (
        <div className="muted" style={{ textAlign: "center", fontSize: 12.5, marginTop: 4 }}>
          {lang === "bn" ? "জরুরি সহায়তার জন্য কল করুন:" : "For immediate wholesale inquiries:"}{" "}
          <a href={`tel:${contactPhone}`} style={{ color: "inherit", fontWeight: 600 }}>
            {contactPhone}
          </a>
        </div>
      )}
    </form>
  );
}
