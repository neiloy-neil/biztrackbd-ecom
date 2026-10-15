"use client";

import type { Lang } from "@/lib/i18n-core";

export interface GuaranteeItem {
  icon: "cod" | "delivery" | "return" | "shield";
  title: string;
  titleBn?: string;
  subtitle: string;
  subtitleBn?: string;
}

const DEFAULT_GUARANTEES: GuaranteeItem[] = [
  {
    icon: "cod",
    title: "Cash on Delivery",
    titleBn: "ক্যাশ অন ডেলিভারি",
    subtitle: "Inspect parcel at your door before paying",
    subtitleBn: "পণ্য হাতে পেয়ে দেখে মূল্য পরিশোধ করুন",
  },
  {
    icon: "delivery",
    title: "Fast 24-48h Delivery",
    titleBn: "দ্রুত ২৪-৪৮ ঘণ্টা ডেলিভারি",
    subtitle: "Express home delivery across all 64 districts",
    subtitleBn: "সারা বাংলাদেশে দ্রুততম হোম ডেলিভারি",
  },
  {
    icon: "return",
    title: "3-Day Easy Return",
    titleBn: "৩ দিনে সহজ রিটার্ন",
    subtitle: "Hassle-free size & product exchange guarantee",
    subtitleBn: "ঝামেলাহীন পণ্য ও সাইজ পরিবর্তনের নিশ্চয়তা",
  },
  {
    icon: "shield",
    title: "100% Original Quality",
    titleBn: "১০০% আসল ও সেরা মান",
    subtitle: "Direct from verified authentic suppliers",
    subtitleBn: "শতভাগ আসল এবং প্রিমিয়াম মানের নিশ্চয়তা",
  },
];

function GuaranteeIcon({ icon }: { icon: GuaranteeItem["icon"] }) {
  switch (icon) {
    case "cod":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <path d="M6 15h2M12 15h6" />
        </svg>
      );
    case "delivery":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case "return":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
  }
}

export function GuaranteeStrip({
  lang = "bn",
  items = DEFAULT_GUARANTEES,
  className = "",
  compact = false,
}: {
  lang?: Lang;
  items?: GuaranteeItem[];
  className?: string;
  compact?: boolean;
}) {
  const isBn = lang === "bn";

  return (
    <div
      className={`lp-guarantee-strip ${compact ? "lp-guarantee-compact" : ""} ${className}`}
      data-testid="lp-guarantee-strip"
      role="region"
      aria-label={isBn ? "নিরাপদ কেনাকাটার নিশ্চয়তা" : "Risk-free Shopping Guarantees"}
    >
      <div className="lp-guarantee-grid">
        {items.map((item, idx) => (
          <div key={idx} className="lp-guarantee-card">
            <div className="lp-guarantee-icon" aria-hidden="true">
              <GuaranteeIcon icon={item.icon} />
            </div>
            <div className="lp-guarantee-text">
              <h4 className="lp-guarantee-title">
                {isBn && item.titleBn ? item.titleBn : item.title}
              </h4>
              <p className="lp-guarantee-subtitle">
                {isBn && item.subtitleBn ? item.subtitleBn : item.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
