"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n-core";

export interface SocialProofOrder {
  name: string;
  nameBn?: string;
  location: string;
  locationBn?: string;
  itemText: string;
  itemTextBn?: string;
  timeAgo: string;
  timeAgoBn?: string;
}

const DEFAULT_ORDERS: SocialProofOrder[] = [
  {
    name: "Md. Tanvir",
    nameBn: "মোঃ তানভীর",
    location: "Mirpur, Dhaka",
    locationBn: "মিরপুর, ঢাকা",
    itemText: "ordered 2 pieces via COD",
    itemTextBn: "ক্যাশ অন ডেলিভারিতে ২ পিস অর্ডার করেছেন",
    timeAgo: "2 minutes ago",
    timeAgoBn: "২ মিনিট আগে",
  },
  {
    name: "Nusrat Jahan",
    nameBn: "নুসরাত জাহান",
    location: "Agrabad, Chittagong",
    locationBn: "আগ্রাবাদ, চট্টগ্রাম",
    itemText: "ordered 1 piece",
    itemTextBn: "১ পিস অর্ডার করেছেন",
    timeAgo: "5 minutes ago",
    timeAgoBn: "৫ মিনিট আগে",
  },
  {
    name: "Kamrul Hasan",
    nameBn: "কামরুল হাসান",
    location: "Uttara, Dhaka",
    locationBn: "উত্তরা, ঢাকা",
    itemText: "ordered Combo Pack",
    itemTextBn: "কম্বো প্যাক অর্ডার করেছেন",
    timeAgo: "8 minutes ago",
    timeAgoBn: "৮ মিনিট আগে",
  },
  {
    name: "Sultana Razia",
    nameBn: "সুলতানা রাজিয়া",
    location: "Zindabazar, Sylhet",
    locationBn: "জিন্দাবাজার, সিলেট",
    itemText: "placed an order",
    itemTextBn: "একটি অর্ডার প্লেস করেছেন",
    timeAgo: "12 minutes ago",
    timeAgoBn: "১২ মিনিট আগে",
  },
  {
    name: "Rakibul Islam",
    nameBn: "রাকিবুল ইসলাম",
    location: "Shaheb Bazar, Rajshahi",
    locationBn: "সাহেব বাজার, রাজশাহী",
    itemText: "ordered 3 pieces (Free Delivery)",
    itemTextBn: "৩ পিস (ফ্রি ডেলিভারি) অর্ডার করেছেন",
    timeAgo: "15 minutes ago",
    timeAgoBn: "১৫ মিনিট আগে",
  },
];

export function SocialProofTicker({
  lang = "bn",
  intervalSec = 14,
  orders = DEFAULT_ORDERS,
}: {
  lang?: Lang;
  intervalSec?: number;
  orders?: SocialProofOrder[];
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const isBn = lang === "bn";

  useEffect(() => {
    if (dismissed || orders.length === 0) return;

    // Show initial notification after 3 seconds
    const initialTimer = setTimeout(() => {
      setVisible(true);
    }, 3200);

    return () => clearTimeout(initialTimer);
  }, [dismissed, orders.length]);

  useEffect(() => {
    if (dismissed || !visible || isPaused || orders.length <= 1) return;

    // Auto rotate every intervalSec seconds
    const cycleTimer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % orders.length);
        setVisible(true);
      }, 500);
    }, Math.max(8000, intervalSec * 1000));

    return () => clearInterval(cycleTimer);
  }, [visible, isPaused, dismissed, intervalSec, orders.length]);

  if (dismissed || orders.length === 0 || !visible) return null;

  const current = orders[index]!;
  const name = isBn && current.nameBn ? current.nameBn : current.name;
  const location = isBn && current.locationBn ? current.locationBn : current.location;
  const itemText = isBn && current.itemTextBn ? current.itemTextBn : current.itemText;
  const timeAgo = isBn && current.timeAgoBn ? current.timeAgoBn : current.timeAgo;

  return (
    <div
      className="lp-social-ticker"
      data-testid="lp-social-ticker"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="status"
      aria-live="polite"
    >
      <div className="lp-social-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <polyline points="16 11 18 13 22 9" />
        </svg>
      </div>

      <div className="lp-social-content">
        <div className="lp-social-title">
          <span className="lp-social-name">{name}</span>
          <span className="lp-social-loc">({location})</span>
        </div>
        <p className="lp-social-desc">{itemText}</p>
        <div className="lp-social-meta">
          <span className="lp-social-verified">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            {isBn ? "ভেরিফায়েড অর্ডার" : "Verified Purchase"}
          </span>
          <span className="lp-social-time">· {timeAgo}</span>
        </div>
      </div>

      <button
        type="button"
        className="lp-social-close"
        onClick={() => setDismissed(true)}
        aria-label={isBn ? "বন্ধ করুন" : "Dismiss"}
      >
        ✕
      </button>
    </div>
  );
}
