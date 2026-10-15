"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchProductDropAction } from "@/app/actions";

interface Props {
  productId: string;
  lang?: "en" | "bn";
}

export function DropPreOrderCard({ productId, lang = "en" }: Props) {
  const [drop, setDrop] = useState<{
    dropId: string;
    title: string;
    slug: string;
    mode: "TEASER_WAITLIST" | "LIVE_PREORDER";
    startsAt: string | Date;
    endsAt?: string | Date | null;
    estimatedShipDate?: string | Date | null;
    depositType: "NONE" | "FIXED" | "PERCENTAGE" | "FULL";
    depositValue: number;
    allocationCap?: number | null;
    claimedUnits: number;
    isLive: boolean;
    isUpcoming: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetchProductDropAction(productId).then((res) => {
      if (active && res.ok && res.drop) {
        setDrop(res.drop as any);
      }
    });
    return () => {
      active = false;
    };
  }, [productId]);

  if (!drop) return null;

  let depositText = lang === "bn" ? "ক্যাশ অন ডেলিভারি (১০০% ক্যাশ)" : "100% Cash on Delivery";
  if (drop.depositType === "FULL") {
    depositText = lang === "bn" ? "১০০% অনলাইন অগ্রিম পেমেন্ট প্রযোজ্য" : "100% Full Prepayment Required";
  } else if (drop.depositType === "FIXED") {
    depositText = lang === "bn" ? `৳${drop.depositValue} অনলাইন অগ্রিম বুকিং · বাকি টাকা ডেলিভারিতে` : `৳${drop.depositValue} Advance Booking · Remainder on Delivery`;
  } else if (drop.depositType === "PERCENTAGE") {
    depositText = lang === "bn" ? `${drop.depositValue}% অনলাইন অগ্রিম · বাকি টাকা ডেলিভারিতে` : `${drop.depositValue}% Advance Booking · Remainder on Delivery`;
  }

  return (
    <div
      className="card"
      style={{
        margin: "14px 0",
        padding: "14px 16px",
        borderRadius: 10,
        background: "linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(2, 132, 199, 0.01) 100%)",
        border: "1px solid rgba(2, 132, 199, 0.25)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "#0284c7" }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#0369a1", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {drop.isLive ? (lang === "bn" ? "সীমিত ড্রপ · প্রি-অর্ডার চলছে" : "Limited Drop · Pre-Order") : (lang === "bn" ? "আসন্ন ড্রপ" : "Upcoming Drop")}
          </span>
        </div>

        <Link href={`/drops/${drop.slug}`} className="link" style={{ fontSize: 12, fontWeight: 600 }}>
          {lang === "bn" ? "ড্রপ পেজ দেখুন →" : "View Drop Showcase →"}
        </Link>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: "4px 0 2px" }}>
        {drop.title}
      </div>

      {drop.estimatedShipDate && (
        <div style={{ fontSize: 12, color: "#059669", marginTop: 2 }}>
          <b>{lang === "bn" ? "আনুমানিক ডেলিভারি সময়:" : "Estimated Dispatch:"}</b> ~{new Date(drop.estimatedShipDate).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}

      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        {depositText}
      </div>
    </div>
  );
}
