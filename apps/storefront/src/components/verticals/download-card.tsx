"use client";

import React from "react";
import type { Lang } from "@/lib/i18n-core";

export function DownloadCardSection({
  title,
  titleBn,
  description,
  descriptionBn,
  fileUrl,
  fileLabel,
  buttonText,
  buttonTextBn,
  lang,
}: {
  title?: string;
  titleBn?: string;
  description?: string;
  descriptionBn?: string;
  fileUrl?: string;
  fileLabel?: string;
  buttonText?: string;
  buttonTextBn?: string;
  lang: Lang;
}) {
  const heading = lang === "bn" && titleBn ? titleBn : title || (lang === "bn" ? "সিভি ডাউনলোড করুন" : "Download CV / Resume");
  const desc = lang === "bn" && descriptionBn ? descriptionBn : description || (lang === "bn" ? "আমার সম্পূর্ণ অভিজ্ঞতা, শিক্ষা ও অর্জনের সারসংক্ষেপ দেখতে পিডিএফ ডাউনলোড করুন।" : "Get a comprehensive overview of my experience, education and achievements in PDF format.");
  const btn = lang === "bn" && buttonTextBn ? buttonTextBn : buttonText || (lang === "bn" ? "ডাউনলোড PDF" : "Download PDF");
  const label = fileLabel || "PDF Document · 2.4 MB";

  return (
    <section className="wrap" style={{ padding: "40px 0" }}>
      <div
        style={{
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius, 16px)",
          background: "var(--tint-1, #f8fafc)",
          padding: "32px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 20, alignItems: "center", minWidth: 260, flex: 1 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "rgba(239, 68, 68, 0.1)",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.8rem",
              flexShrink: 0,
            }}
          >
            📄
          </div>
          <div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 4px" }}>{heading}</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--muted, #64748b)", margin: "0 0 6px", lineHeight: 1.4 }}>
              {desc}
            </p>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted, #94a3b8)", letterSpacing: "0.02em" }}>
              {label}
            </span>
          </div>
        </div>

        <div>
          <a
            href={fileUrl || "#"}
            download
            style={{
              display: "inline-block",
              background: "var(--btn-bg, #0f172a)",
              color: "var(--btn-fg, #ffffff)",
              padding: "12px 26px",
              borderRadius: "var(--radius, 10px)",
              fontWeight: 700,
              fontSize: "0.95rem",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            }}
          >
            📥 {btn}
          </a>
        </div>
      </div>
    </section>
  );
}
