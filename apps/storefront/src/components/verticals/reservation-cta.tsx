"use client";

import React, { useState } from "react";
import type { Lang } from "@/lib/i18n-core";

export function ReservationCtaSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  notice,
  noticeBn,
  directPhone,
  lang,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  notice?: string;
  noticeBn?: string;
  directPhone?: string;
  lang: Lang;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState("2");
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const heading = lang === "bn" && titleBn ? titleBn : title || (lang === "bn" ? "টেবিল বুকিং রিকোয়েস্ট" : "Table Reservation Request");
  const sub = lang === "bn" && subtitleBn ? subtitleBn : subtitle || (lang === "bn" ? "আপনার পছন্দের সময় ও অতিথির সংখ্যা জানিয়ে রিকোয়েস্ট পাঠান। আমরা নিশ্চিত করব।" : "Submit your preferred date and party size. We will confirm via WhatsApp or Phone.");
  const noteText = lang === "bn" && noticeBn ? noticeBn : notice || (lang === "bn" ? "জরুরি বা ২ ঘণ্টার মধ্যে টেবিল পেতে অনুগ্রহ করে সরাসরি ফোন করুন।" : "For same-day reservations within 2 hours, please call directly.");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return; // Silent drop for bots
    if (Date.now() - renderedAt < 1200) {
      setErrorMsg(lang === "bn" ? "অনুগ্রহ করে ফর্মটি সঠিকভাবে পূরণ করুন।" : "Please take a moment to complete the form.");
      return;
    }
    if (!name.trim() || !phone.trim() || !date || !time) {
      setErrorMsg(lang === "bn" ? "নাম, মোবাইল নম্বর, তারিখ এবং সময় দিন।" : "Please enter your name, phone, date and time.");
      return;
    }

    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/site/booking-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          partySize: Number(guests) || 2,
          preferredDate: date,
          preferredTime: time,
          message: notes.trim(),
          type: "RESERVATION",
          sourceUrl: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || (lang === "bn" ? "অনুরোধ পাঠানো যায়নি। আবার চেষ্টা করুন।" : "Could not submit. Please try again."));
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : (lang === "bn" ? "সমস্যা হয়েছে, অনুগ্রহ করে ফোন করুন।" : "Something went wrong. Please call directly."));
    }
  };

  return (
    <section className="wrap" style={{ padding: "48px 0" }}>
      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius, 16px)",
          padding: "36px 32px",
          background: "var(--bg, #ffffff)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 8px" }}>{heading}</h2>
          <p style={{ fontSize: "0.95rem", color: "var(--muted, #64748b)", margin: 0 }}>{sub}</p>
        </div>

        {status === "success" ? (
          <div
            style={{
              padding: 24,
              background: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: 12,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>✅</div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 6px", color: "#15803d" }}>
              {lang === "bn" ? "বুকিং রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে!" : "Reservation Request Received!"}
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#166534", margin: 0, lineHeight: 1.5 }}>
              {lang === "bn"
                ? `ধন্যবাদ ${name}! আমাদের টিম শীঘ্রই (${phone})-এ যোগাযোগ করে আপনার টেবিল নিশ্চিত করবে।`
                : `Thank you ${name}! Our staff will contact you at ${phone} to confirm your reservation shortly.`}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Honeypot field */}
            <input
              type="text"
              name="website_url_hp"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ display: "none" }}
              tabIndex={-1}
              autoComplete="off"
            />

            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: 6 }}>
                {lang === "bn" ? "আপনার নাম *" : "Your Name *"}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === "bn" ? "যেমন: তানভীর আহমেদ" : "e.g. Tanvir Ahmed"}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius, 8px)",
                  border: "1px solid var(--border, #cbd5e1)",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: 6 }}>
                {lang === "bn" ? "মোবাইল নম্বর (হোয়াটসঅ্যাপ সহ) *" : "Mobile Phone (with WhatsApp) *"}
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={lang === "bn" ? "০১৭XXXXXXXX" : "017XXXXXXXX"}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius, 8px)",
                  border: "1px solid var(--border, #cbd5e1)",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>
                  {lang === "bn" ? "তারিখ *" : "Date *"}
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 10px",
                    borderRadius: "var(--radius, 8px)",
                    border: "1px solid var(--border, #cbd5e1)",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>
                  {lang === "bn" ? "সময় *" : "Time *"}
                </label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 10px",
                    borderRadius: "var(--radius, 8px)",
                    border: "1px solid var(--border, #cbd5e1)",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>
                  {lang === "bn" ? "অতিথি সংখ্যা" : "Guests"}
                </label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 10px",
                    borderRadius: "var(--radius, 8px)",
                    border: "1px solid var(--border, #cbd5e1)",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                    background: "var(--bg, #fff)",
                  }}
                >
                  <option value="1">1 Person</option>
                  <option value="2">2 Persons</option>
                  <option value="3">3 Persons</option>
                  <option value="4">4 Persons</option>
                  <option value="5">5 Persons</option>
                  <option value="6">6 Persons</option>
                  <option value="8">8+ (Group)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: 6 }}>
                {lang === "bn" ? "বিশেষ কোনো অনুরোধ (ঐচ্ছিক)" : "Special Requests (Optional)"}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={lang === "bn" ? "যেমন: জানালার পাশের টেবিল, জন্মদিনের সারপ্রাইজ..." : "e.g. Window side table, birthday celebration..."}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius, 8px)",
                  border: "1px solid var(--border, #cbd5e1)",
                  fontSize: "0.92rem",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {errorMsg && (
              <div style={{ color: "#dc2626", fontSize: "0.88rem", fontWeight: 600 }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              style={{
                width: "100%",
                background: "var(--btn-bg, #0f172a)",
                color: "var(--btn-fg, #ffffff)",
                padding: "14px 20px",
                borderRadius: "var(--radius, 10px)",
                fontWeight: 700,
                fontSize: "1rem",
                border: "none",
                cursor: status === "submitting" ? "not-allowed" : "pointer",
                opacity: status === "submitting" ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {status === "submitting"
                ? (lang === "bn" ? "পাঠানো হচ্ছে..." : "Submitting...")
                : (lang === "bn" ? "টেবিল বুকিং রিকোয়েস্ট পাঠান" : "Submit Reservation Request")}
            </button>

            {noteText && (
              <p style={{ fontSize: "0.82rem", color: "var(--muted, #64748b)", margin: "8px 0 0", textAlign: "center", lineHeight: 1.4 }}>
                ℹ️ {noteText} {directPhone && <a href={`tel:${directPhone}`} style={{ color: "var(--accent, #d97706)", fontWeight: 600 }}>{directPhone}</a>}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
