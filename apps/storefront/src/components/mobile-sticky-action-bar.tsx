import React from "react";
import type { Lang } from "@/lib/i18n-core";

export function MobileStickyActionBar({
  phone,
  whatsapp,
  lang,
}: {
  phone?: string | null;
  whatsapp?: string | null;
  lang: Lang;
}) {
  if (!phone && !whatsapp) return null;

  const rawWa = whatsapp?.replace(/[^0-9]/g, "") ?? "";
  const waNumber = rawWa.startsWith("88") ? rawWa : `88${rawWa}`;

  return (
    <div
      className="mobile-sticky-bar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid var(--border, #e2e8f0)",
        padding: "10px 16px env(safe-area-inset-bottom, 10px)",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <style>{`
        @media (min-width: 769px) {
          .mobile-sticky-bar { display: none !important; }
        }
      `}</style>

      {phone && (
        <a
          href={`tel:${phone}`}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "11px 16px",
            borderRadius: "var(--radius, 10px)",
            background: "var(--tint-1, #f1f5f9)",
            color: "var(--fg, #0f172a)",
            fontWeight: 700,
            fontSize: "0.92rem",
            textDecoration: "none",
            border: "1px solid var(--border, #cbd5e1)",
          }}
        >
          <span>📞</span>
          <span>{lang === "bn" ? "সরাসরি কল" : "Call Now"}</span>
        </a>
      )}

      {rawWa && (
        <a
          href={`https://wa.me/${waNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "11px 16px",
            borderRadius: "var(--radius, 10px)",
            background: "#25D366",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "0.92rem",
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(37, 211, 102, 0.3)",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>💬</span>
          <span>{lang === "bn" ? "হোয়াটসঅ্যাপ" : "WhatsApp"}</span>
        </a>
      )}
    </div>
  );
}
