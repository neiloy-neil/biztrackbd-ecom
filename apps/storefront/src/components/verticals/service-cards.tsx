"use client";

import React from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n-core";

export interface ServiceItem {
  id: string;
  title: string;
  titleBn?: string;
  description: string;
  descriptionBn?: string;
  startingPrice?: number;
  icon?: string;
  ctaText?: string;
  ctaTextBn?: string;
  ctaLink?: string;
}

const DEFAULT_SAMPLE_SERVICES: ServiceItem[] = [
  {
    id: "s1",
    title: "Commercial & Office AC Maintenance",
    titleBn: "অফিস ও বাণিজ্যিক এসি সার্ভিসিং",
    description: "Full jet-wash cleaning, gas pressure inspection, compressor health audit and fast breakdown repairs.",
    descriptionBn: "জেট ওয়াশ ডিপ ক্লিনিং, গ্যাস প্রেশার চেক ও দ্রুত মেরামতের নির্ভরযোগ্য সার্ভিস।",
    startingPrice: 1200,
    icon: "❄️",
    ctaLink: "/contact",
  },
  {
    id: "s2",
    title: "Electrical & Substation Servicing",
    titleBn: "ইলেকট্রিক্যাল ও সাবস্টেশন সমাধান",
    description: "Certified electricians for load calculation, DB board maintenance, safety earthing and industrial wiring.",
    descriptionBn: "লোড ক্যালকুলেশন, ডিবি বোর্ড রক্ষণাবেক্ষণ ও ফ্যাক্টরি ওয়্যারিংয়ের সার্টিফাইড সেবা।",
    startingPrice: 2500,
    icon: "⚡",
    ctaLink: "/contact",
  },
  {
    id: "s3",
    title: "Corporate Facility Pest Control",
    titleBn: "কর্পোরেট পেস্ট কন্ট্রোল সার্ভিস",
    description: "Odorless herbal treatment for termites, roaches and rodents with 6-month written warranty.",
    descriptionBn: "গন্ধহীন আধুনিক পেস্ট কন্ট্রোল এবং উইপোকা দমনে ৬ মাসের লিখিত ওয়ারেন্টি।",
    startingPrice: 3500,
    icon: "🛡️",
    ctaLink: "/contact",
  },
];

export function ServiceCardsSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  services = DEFAULT_SAMPLE_SERVICES,
  lang,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  services?: ServiceItem[];
  lang: Lang;
}) {
  const heading = lang === "bn" && titleBn ? titleBn : title || (lang === "bn" ? "আমাদের সেবাসমূহ" : "Our Services");
  const sub = lang === "bn" && subtitleBn ? subtitleBn : subtitle || (lang === "bn" ? "নিবেদিত পেশাদারদের দ্বারা দক্ষ ও নির্ভরযোগ্য সমাধান" : "Reliable, high-quality services delivered by certified professionals");
  const list = services && services.length > 0 ? services : DEFAULT_SAMPLE_SERVICES;

  return (
    <section className="wrap" style={{ padding: "48px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 36, maxWidth: 640, margin: "0 auto 36px" }}>
        <h2 style={{ fontSize: "1.9rem", fontWeight: 800, margin: "0 0 8px" }}>{heading}</h2>
        {sub && <p style={{ fontSize: "0.95rem", color: "var(--muted, #64748b)", margin: 0 }}>{sub}</p>}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 24,
        }}
      >
        {list.map((item) => {
          const sTitle = lang === "bn" && item.titleBn ? item.titleBn : item.title;
          const sDesc = lang === "bn" && item.descriptionBn ? item.descriptionBn : item.description;
          const btn = lang === "bn" && item.ctaTextBn ? item.ctaTextBn : item.ctaText || (lang === "bn" ? "কোটেশন চান" : "Get a Quote");

          return (
            <div
              key={item.id}
              style={{
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius, 16px)",
                padding: "28px 24px",
                background: "var(--bg, #ffffff)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
                transition: "transform 0.15s ease",
              }}
            >
              <div>
                {item.icon && (
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      background: "var(--tint-1, #f1f5f9)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.8rem",
                      marginBottom: 16,
                    }}
                  >
                    {item.icon}
                  </div>
                )}

                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 10px" }}>{sTitle}</h3>
                <p style={{ fontSize: "0.92rem", color: "var(--muted, #64748b)", margin: "0 0 16px", lineHeight: 1.5 }}>
                  {sDesc}
                </p>
              </div>

              <div>
                {item.startingPrice && (
                  <div style={{ marginBottom: 16, paddingTop: 12, borderTop: "1px dashed var(--border, #e2e8f0)" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted, #64748b)", display: "block" }}>{lang === "bn" ? "শুরু হচ্ছে" : "Starting from"}</span>
                    <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--accent, #2563eb)" }}>
                      ৳{item.startingPrice.toLocaleString("en-BD")}
                    </span>
                  </div>
                )}

                <Link
                  href={item.ctaLink || "/contact"}
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: "var(--btn-bg, #0f172a)",
                    color: "var(--btn-fg, #ffffff)",
                    padding: "10px 16px",
                    borderRadius: "var(--radius, 8px)",
                    fontWeight: 700,
                    fontSize: "0.92rem",
                    textDecoration: "none",
                  }}
                >
                  {btn}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
