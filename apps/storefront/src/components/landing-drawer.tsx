"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n-core";
import { LandingOrderForm, type LandingBump, type LandingOption, type LpStrings } from "./landing-order-form";

export function LandingDrawer({
  slug,
  options,
  bump,
  lang,
  s,
  buttonText,
  utm,
  track = true,
}: {
  slug: string;
  options: LandingOption[];
  bump: LandingBump | null;
  lang: Lang;
  s: LpStrings;
  buttonText: string;
  utm?: { source?: string; campaign?: string; medium?: string };
  track?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isBn = lang === "bn";

  useEffect(() => {
    // Listen for custom trigger event
    const handleCustomTrigger = () => setIsOpen(true);
    window.addEventListener("open-landing-drawer", handleCustomTrigger);

    // Global click listener for [data-open-drawer] or href="#order-drawer"
    const handleDocClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a, button");
      if (!target) return;

      const href = target.getAttribute("href");
      const hasAttr = target.hasAttribute("data-open-drawer");

      if (hasAttr || href === "#order-drawer") {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener("click", handleDocClick);

    return () => {
      window.removeEventListener("open-landing-drawer", handleCustomTrigger);
      document.removeEventListener("click", handleDocClick);
    };
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="lp-drawer-overlay" data-testid="lp-checkout-drawer" role="dialog" aria-modal="true">
      <div className="lp-drawer-backdrop" onClick={() => setIsOpen(false)} aria-hidden="true" />
      <div className="lp-drawer-panel">
        <div className="lp-drawer-header">
          <div className="lp-drawer-title-group">
            <span className="lp-drawer-icon" aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </span>
            <div>
              <h3 className="lp-drawer-title">
                {isBn ? "দ্রুত ক্যাশ অন ডেলিভারি অর্ডার" : "Instant COD Checkout"}
              </h3>
              <p className="lp-drawer-subtitle">
                {isBn ? "কোনো কার্ড বা পেমেন্ট লাগবে না · হাতে পেয়ে টাকা দিন" : "No card needed · Pay upon inspection at your door"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="lp-drawer-close"
            onClick={() => setIsOpen(false)}
            aria-label={isBn ? "বন্ধ করুন" : "Close"}
          >
            ✕
          </button>
        </div>

        <div className="lp-drawer-content">
          <LandingOrderForm
            slug={slug}
            options={options}
            bump={bump}
            lang={lang}
            s={s}
            buttonText={buttonText}
            utm={utm}
            track={track}
            isDrawer={true}
            onOrderSuccess={() => setIsOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
