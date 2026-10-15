"use client";

import React, { useState } from "react";
import type { Lang } from "@/lib/i18n-core";

export function ContactFormSection({
  heading,
  headingBn,
  subhead,
  subheadBn,
  buttonText,
  buttonTextBn,
  directPhone,
  directEmail,
  lang,
}: {
  heading?: string;
  headingBn?: string;
  subhead?: string;
  subheadBn?: string;
  buttonText?: string;
  buttonTextBn?: string;
  directPhone?: string;
  directEmail?: string;
  lang: Lang;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [whatsAppUrl, setWhatsAppUrl] = useState<string | null>(null);

  const title = lang === "bn" && headingBn ? headingBn : heading || (lang === "bn" ? "যোগাযোগ করুন" : "Get in Touch");
  const desc = lang === "bn" && subheadBn ? subheadBn : subhead || (lang === "bn" ? "আমাদের বার্তা পাঠান, আমরা দ্রুত আপনার সাথে যোগাযোগ করব।" : "Send us a message and our team will get back to you promptly.");
  const btnLabel = lang === "bn" && buttonTextBn ? buttonTextBn : buttonText || (lang === "bn" ? "বার্তা পাঠান" : "Send Message");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return; // Silent drop for bots
    if (Date.now() - renderedAt < 1200) {
      setErrorMsg(lang === "bn" ? "অনুগ্রহ করে ফর্মটি সঠিকভাবে পূরণ করুন।" : "Please take a moment to complete the form.");
      return;
    }
    if (!name.trim() || (!phone.trim() && !email.trim()) || !message.trim()) {
      setErrorMsg(lang === "bn" ? "অনুগ্রহ করে নাম, ফোন অথবা ইমেইল এবং বার্তা লিখুন।" : "Please provide your name, contact phone or email, and message.");
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/site/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          message: message.trim(),
          type: "CONTACT",
          sourcePage: typeof window !== "undefined" ? window.location.pathname : "",
          locale: lang,
          elapsedMs: Date.now() - renderedAt,
          hp: honeypot,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || (lang === "bn" ? "বার্তা পাঠানো যায়নি। আবার চেষ্টা করুন।" : "Could not send message. Please try again."));
      }

      if (json.data?.whatsAppFollowUpUrl) {
        setWhatsAppUrl(json.data.whatsAppFollowUpUrl);
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : (lang === "bn" ? "সমস্যা হয়েছে, অনুগ্রহ করে সরাসরি ফোন করুন।" : "Something went wrong. Please call directly."));
    }
  };

  return (
    <section className="wrap" style={{ padding: "48px 0" }}>
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius, 16px)",
          padding: "36px 32px",
          background: "var(--bg, #ffffff)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 8px" }}>{title}</h2>
          <p style={{ fontSize: "0.95rem", color: "var(--muted, #64748b)", margin: 0 }}>{desc}</p>
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
              {lang === "bn" ? "আপনার বার্তা সফলভাবে পাঠানো হয়েছে!" : "Message Sent Successfully!"}
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#166534", margin: "0 0 16px", lineHeight: 1.5 }}>
              {lang === "bn"
                ? `ধন্যবাদ ${name}! আমরা আপনার বার্তা পেয়েছি এবং দ্রুত আপনার সাথে যোগাযোগ করব।`
                : `Thank you ${name}! We have received your message and will respond shortly.`}
            </p>
            {whatsAppUrl && (
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  backgroundColor: "#25D366",
                  color: "#FFFFFF",
                  borderRadius: "var(--radius, 8px)",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)",
                }}
              >
                <span>💬</span>
                {lang === "bn" ? "হোয়াটসঅ্যাপে সরাসরি চ্যাট করুন" : "Chat on WhatsApp Directly"}
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Honeypot field */}
            <input
              type="text"
              name="company_website_hp"
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: 6 }}>
                  {lang === "bn" ? "মোবাইল নম্বর *" : "Phone Number *"}
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
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
                  {lang === "bn" ? "ইমেইল (ঐচ্ছিক)" : "Email (Optional)"}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 600, marginBottom: 6 }}>
                {lang === "bn" ? "আপনার বার্তা / প্রজেক্ট বিবরণ *" : "Your Message / Project Details *"}
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={lang === "bn" ? "আপনার প্রয়োজন বা জিজ্ঞাসা এখানে লিখুন..." : "Describe your inquiry or project requirements here..."}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius, 8px)",
                  border: "1px solid var(--border, #cbd5e1)",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  borderRadius: 8,
                  fontSize: "0.88rem",
                  border: "1px solid #fecaca",
                }}
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: "var(--accent, #0f172a)",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--radius, 8px)",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: status === "submitting" ? "not-allowed" : "pointer",
                opacity: status === "submitting" ? 0.7 : 1,
                marginTop: 6,
              }}
            >
              {status === "submitting" ? (lang === "bn" ? "পাঠানো হচ্ছে..." : "Sending...") : btnLabel}
            </button>

            {(directPhone || directEmail) && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border, #f1f5f9)",
                  textAlign: "center",
                  fontSize: "0.88rem",
                  color: "var(--muted, #64748b)",
                }}
              >
                {directPhone && (
                  <p style={{ margin: "2px 0" }}>
                    📞 {lang === "bn" ? "সরাসরি ফোন করুন:" : "Direct Phone:"}{" "}
                    <a href={`tel:${directPhone}`} style={{ color: "var(--accent, #0f172a)", fontWeight: 600, textDecoration: "none" }}>
                      {directPhone}
                    </a>
                  </p>
                )}
                {directEmail && (
                  <p style={{ margin: "2px 0" }}>
                    ✉️ {lang === "bn" ? "ইমেইল:" : "Email:"}{" "}
                    <a href={`mailto:${directEmail}`} style={{ color: "var(--accent, #0f172a)", fontWeight: 600, textDecoration: "none" }}>
                      {directEmail}
                    </a>
                  </p>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
