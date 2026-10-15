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
        background: "linear-gradient(135deg, rgba(79, 70, 229, 0.04) 0%, rgba(79, 70, 229, 0.01) 100%)",
        border: "1px solid rgba(79, 70, 229, 0.2)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>📦</span>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: "#4338ca" }}>
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
              border: "1px solid #e0e7ff",
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
        <Link href="/wholesale/register" style={{ fontSize: 12, color: "#4f46e5", textDecoration: "none", fontWeight: 600 }}>
          {lang === "bn" ? "ডিলার পার্টনারশিপের জন্য আবেদন করুন →" : "Apply for Reseller Trade Account →"}
        </Link>
      </div>
    </div>
  );
}
