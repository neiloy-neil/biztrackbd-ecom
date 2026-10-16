"use client";

import React from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n-core";

export function RestaurantHoursLocationSection({
  title,
  titleBn,
  hoursWeekday,
  hoursWeekdayBn,
  hoursWeekend,
  hoursWeekendBn,
  address,
  addressBn,
  googleMapsUrl,
  phone,
  reservationLink = "/reservations",
  lang,
}: {
  title?: string;
  titleBn?: string;
  hoursWeekday?: string;
  hoursWeekdayBn?: string;
  hoursWeekend?: string;
  hoursWeekendBn?: string;
  address?: string;
  addressBn?: string;
  googleMapsUrl?: string;
  phone?: string;
  reservationLink?: string;
  lang: Lang;
}) {
  const heading = lang === "bn" && titleBn ? titleBn : title || (lang === "bn" ? "সময়সূচি ও অবস্থান" : "Hours & Location");
  const weekday = lang === "bn" && hoursWeekdayBn ? hoursWeekdayBn : hoursWeekday || (lang === "bn" ? "শনি - বৃহস্পতি: সকাল ১১:০০ - রাত ১১:০০" : "Sat - Thu: 11:00 AM - 11:00 PM");
  const weekend = lang === "bn" && hoursWeekendBn ? hoursWeekendBn : hoursWeekend || (lang === "bn" ? "শুক্রবার: দুপুর ২:০০ - রাত ১১:৩০" : "Friday: 2:00 PM - 11:30 PM");
  const addr = lang === "bn" && addressBn ? addressBn : address || (lang === "bn" ? "বাড়ি ১২, রোড ৭, ধানমন্ডি, ঢাকা" : "House 12, Road 7, Dhanmondi, Dhaka");

  return (
    <section className="wrap" style={{ padding: "40px 0" }}>
      <div
        style={{
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius, 16px)",
          background: "var(--tint-1, #f8fafc)",
          padding: "36px 32px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 32,
          alignItems: "center",
        }}
      >
        {/* Hours */}
        <div>
          <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 16px" }}>{heading}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.95rem" }}>
            <div>
              <span style={{ fontWeight: 600, display: "block" }}>{lang === "bn" ? "নিয়মিত দিনগুলো" : "Regular Days"}:</span>
              <span style={{ color: "var(--muted, #64748b)" }}>{weekday}</span>
            </div>
            <div>
              <span style={{ fontWeight: 600, display: "block" }}>{lang === "bn" ? "ছুটির দিন / জুমু'আ" : "Weekend & Friday"}:</span>
              <span style={{ color: "var(--muted, #64748b)" }}>{weekend}</span>
            </div>
          </div>
        </div>

        {/* Address & Contact */}
        <div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 12px" }}>{lang === "bn" ? "আমাদের ঠিকানা" : "Find Us"}</h3>
          <p style={{ margin: "0 0 12px", color: "var(--muted, #64748b)", fontSize: "0.95rem", lineHeight: 1.5 }}>
            {addr}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "var(--accent, #d97706)",
                  textDecoration: "underline",
                }}
              >
                {lang === "bn" ? "গুগল ম্যাপে দেখুন ↗" : "View on Google Maps ↗"}
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "var(--fg, #0f172a)",
                }}
              >
                📞 {phone}
              </a>
            )}
          </div>
        </div>

        {/* Action */}
        <div style={{ textAlign: "center" }}>
          <Link
            href={reservationLink}
            style={{
              display: "inline-block",
              background: "var(--btn-bg, #0f172a)",
              color: "var(--btn-fg, #ffffff)",
              padding: "12px 28px",
              borderRadius: "var(--radius, 10px)",
              fontWeight: 700,
              fontSize: "0.98rem",
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            {lang === "bn" ? "টেবিল বুকিং করুন" : "Book a Table"}
          </Link>
        </div>
      </div>
    </section>
  );
}
