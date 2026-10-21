"use client";

import { useState } from "react";
import Link from "next/link";
import { trackPlatformEvent } from "@/components/platform-tracker";
import { generateTrackingEventId, getAttributionForPayload } from "@/lib/client-attribution";

export function ContactForm() {
  const [mountedAt] = useState(() => Date.now());
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [v, setV] = useState({
    name: "",
    phone: "",
    email: "",
    topic: "setup",
    message: "",
  });

  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError("Please check the consent box to proceed.");
      return;
    }
    setLoading(true);
    setError(null);

    const eventId = generateTrackingEventId("inq");
    const attr = getAttributionForPayload();

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...v,
          ...attr,
          eventId,
          hp,
          elapsedMs: Date.now() - mountedAt,
          consentGiven: consent,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send message");
      }
      trackPlatformEvent(
        "Lead",
        {
          topic: v.topic,
        },
        { eventId }
      );
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send message. Please message us on WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div
        className="card"
        style={{
          padding: "36px 28px",
          textAlign: "center",
          background: "var(--tint)",
          border: "1.5px solid var(--tint-border)",
          borderRadius: 16,
        }}
        data-testid="contact-success"
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            background: "#11795A",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            margin: "0 auto 16px",
          }}
        >
          ✓
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
          Message sent successfully
        </h3>
        <p style={{ color: "var(--ink-2)", fontSize: 14.5, marginTop: 8, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
          Thank you, <b>{v.name}</b>. Our Dhaka support team will get back to you via WhatsApp or phone ({v.phone}) shortly.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setV({ name: "", phone: "", email: "", topic: "setup", message: "" });
          }}
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 20 }}
        >
          Send another inquiry
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card"
      style={{
        padding: "32px 28px",
        borderRadius: 16,
        border: "1px solid var(--line)",
        background: "#FFFFFF",
        boxShadow: "var(--shadow-sm)",
      }}
      data-testid="contact-form"
    >
      <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px", color: "var(--ink)" }}>
        Send us a direct message
      </h3>
      <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 20 }}>
        Fill out this quick form and an engineer from our Dhaka office will respond directly.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Your name *</span>
          <input
            className="input"
            required
            placeholder="e.g. Tanvir Ahmed"
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
            data-testid="c-name"
          />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Mobile or WhatsApp number *</span>
          <input
            className="input"
            type="tel"
            required
            placeholder="01712345678"
            value={v.phone}
            onChange={(e) => setV({ ...v, phone: e.target.value })}
            data-testid="c-phone"
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Email address *</span>
          <input
            className="input"
            type="email"
            required
            placeholder="tanvir@example.com"
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
            data-testid="c-email"
          />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span className="label">Topic</span>
          <select
            className="input"
            value={v.topic}
            onChange={(e) => setV({ ...v, topic: e.target.value })}
            data-testid="c-topic"
          >
            <option value="setup">Help with store setup</option>
            <option value="courier">Steadfast / Pathao courier connection</option>
            <option value="bkash">bKash / Nagad checkout question</option>
            <option value="shopify">Migrating from Shopify</option>
            <option value="billing">Plan billing & verification</option>
            <option value="enterprise">Enterprise / Custom requirements</option>
          </select>
        </label>
      </div>

      <label className="field" style={{ marginBottom: 16 }}>
        <span className="label">How can we help? *</span>
        <textarea
          className="input"
          required
          rows={4}
          placeholder="Describe what you want to achieve or any problem you ran into..."
          style={{ minHeight: 110, padding: 12, resize: "vertical" }}
          value={v.message}
          onChange={(e) => setV({ ...v, message: e.target.value })}
          data-testid="c-message"
        />
      </label>

      {/* Invisible Honeypot Field */}
      <div style={{ display: "none" }} aria-hidden="true">
        <label htmlFor="b_company_fax">Leave this field blank</label>
        <input
          id="b_company_fax"
          type="text"
          name="b_company_fax"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
      </div>

      {/* Explicit Consent Control */}
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          fontSize: 13,
          color: "var(--ink-2)",
          cursor: "pointer",
          marginBottom: 20,
          lineHeight: 1.5,
        }}
      >
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ marginTop: 2, accentColor: "var(--brand, #11795A)", cursor: "pointer" }}
          data-testid="c-consent"
        />
        <span>
          I agree to BizTrackBD contacting me via WhatsApp, phone, or email regarding this inquiry, and acknowledge the{" "}
          <Link href="/privacy" target="_blank" style={{ color: "var(--brand, #11795A)", textDecoration: "underline" }}>
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {error && (
        <div className="notice bad" role="alert" style={{ marginBottom: 14 }}>
          ⚠️ {error}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={loading}
        style={{ width: "100%", borderRadius: 24 }}
        data-testid="c-submit"
      >
        {loading ? "Sending your message…" : "Send message →"}
      </button>
    </form>
  );
}
