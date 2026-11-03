"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchVariantWholesaleAction } from "@/app/actions";
import { money, type Lang } from "@/lib/i18n-core";

interface Props {
  variantId: string;
  lang: Lang;
}

export function WholesaleVolumeCard({ variantId, lang }: Props) {
  const [data, setData] = useState<{
    breaks: Array<{ minQuantity: number; price: number; savingsPercent: number }>;
    tierName?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetchVariantWholesaleAction(variantId).then((res) => {
      if (!active) return;
      if (res.ok && res.breaks.length > 0) {
        setData({ breaks: res.breaks, tierName: res.tierName });
      } else {
        setData(null);
      }
    });
    return () => {
      active = false;
    };
  }, [variantId]);

  if (!data || data.breaks.length === 0) return null;

  return (
    <div
      className="card"
      style={{
        margin: "16px 0",
        padding: 16,
        borderRadius: 10,
        background: "linear-gradient(135deg, color-mix(in srgb, var(--accent, #8C5A3C) 4%, transparent) 0%, color-mix(in srgb, var(--accent, #8C5A3C) 1%, transparent) 100%)",
        border: "1px solid color-mix(in srgb, var(--accent, #8C5A3C) 20%, transparent)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--accent-strong, var(--accent, #8C5A3C))" }}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--accent-strong, var(--accent, #8C5A3C))" }}>
            {lang === "bn" ? "পাইকারি / ভলিউম ডিসকাউন্ট" : "Buy More & Save (Bulk Pricing)"}
          </span>
        </div>
        {data.tierName && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 12,
              background: "#dcfce7",
              color: "#166534",
            }}
          >
            {data.tierName} Active
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.breaks.length}, 1fr)`, gap: 8 }}>
        {data.breaks.map((b) => (
          <div
            key={b.minQuantity}
            style={{
              padding: "8px 10px",
              background: "#fff",
              borderRadius: 8,
              border: "1px solid var(--line-2, #E3D9CA)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#3730a3" }}>{b.minQuantity}+ pcs</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#111", margin: "2px 0" }}>{money(b.price, lang)}</div>
            {b.savingsPercent > 0 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>
                {lang === "bn" ? `${b.savingsPercent}% ছাড়` : `Save ${b.savingsPercent}%`}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, textAlign: "right" }}>
        <Link href="/wholesale/register" style={{ fontSize: 12, color: "var(--accent-strong, var(--accent, #8C5A3C))", textDecoration: "none", fontWeight: 600 }}>
          {lang === "bn" ? "ডিলার পার্টনারশিপের জন্য আবেদন করুন →" : "Apply for Reseller Trade Account →"}
        </Link>
      </div>
    </div>
  );
}
