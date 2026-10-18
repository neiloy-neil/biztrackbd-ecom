"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { WidgetIcon } from "./widget-icons";

export function PromoPopupSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  badge,
  badgeBn,
  code,
  discountText,
  discountTextBn,
  image,
  ctaText = "Shop Now",
  ctaTextBn = "কেনাকাটা করুন",
  ctaLink = "/products",
  trigger = "delay",
  showPhoneCapture = false,
  lang,
  ed,
  editing,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  badge?: string;
  badgeBn?: string;
  code?: string;
  discountText?: string;
  discountTextBn?: string;
  image?: string;
  ctaText?: string;
  ctaTextBn?: string;
  ctaLink?: string;
  trigger?: "delay" | "scroll" | "immediate";
  showPhoneCapture?: boolean;
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(editing ? false : false);
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState("");
  const [leadSent, setLeadSent] = useState(false);

  const displayTitle = lang === "bn" && titleBn ? titleBn : title || (lang === "bn" ? "বিশেষ ডিসকাউন্ট অফার" : "Special Discount Offer");
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;
  const displayBadge = lang === "bn" && badgeBn ? badgeBn : badge;
  const displayDiscount = lang === "bn" && discountTextBn ? discountTextBn : discountText;
  const displayCta = lang === "bn" && ctaTextBn ? ctaTextBn : ctaText;

  const storageKey = `bt_promo_${code || "dismissed"}`;

  const closePopup = useCallback(() => {
    setIsOpen(false);
    if (!editing && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, String(Date.now()));
      } catch {
        // LocalStorage may be blocked
      }
    }
  }, [editing, storageKey]);

  useEffect(() => {
    if (editing) return;
    try {
      const dismissed = localStorage.getItem(storageKey);
      if (dismissed && Date.now() - Number(dismissed) < 24 * 60 * 60 * 1000) {
        return; // Dismissed within last 24 hours
      }
    } catch {
      // Ignore
    }

    if (trigger === "immediate") {
      setIsOpen(true);
    } else if (trigger === "delay") {
      const timer = setTimeout(() => setIsOpen(true), 3500);
      return () => clearTimeout(timer);
    } else if (trigger === "scroll") {
      const onScroll = () => {
        const scrolled = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        if (scrolled > 0.35) {
          setIsOpen(true);
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
  }, [editing, trigger, storageKey]);

  const copyCode = () => {
    if (!code) return;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return;
    setLeadSent(true);
  };

  return (
    <>
      {/* If in visual editor, show an in-canvas inspector trigger banner */}
      {editing && (
        <div className="bt-popup-editor-strip" data-section-inner="promo-popup">
          <div className="wrap bt-popup-editor-wrap">
            <div className="bt-popup-editor-info">
              <span className="bt-popup-editor-tag">
                <WidgetIcon name="gift" size={16} /> Promo Popup Widget
              </span>
              <span className="bt-popup-editor-summary">
                {displayBadge ? `${displayBadge} — ` : ""}{displayTitle} ({code || "No code"})
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsOpen((prev) => !prev)}
            >
              {isOpen ? "Close Modal Preview" : "Preview Modal"}
            </button>
          </div>
        </div>
      )}

      {/* The Actual Popup Modal */}
      {isOpen && (
        <div className="bt-popup-modal" role="dialog" aria-modal="true">
          <div className="bt-popup-backdrop" onClick={closePopup} />

          <div className="bt-popup-dialog">
            <button
              type="button"
              className="bt-popup-close-btn"
              onClick={closePopup}
              aria-label="Close promotion dialog"
            >
              <WidgetIcon name="x" size={20} />
            </button>

            {image && (
              <div
                className="bt-popup-media"
                style={{ backgroundImage: `url(${image})` }}
              />
            )}

            <div className="bt-popup-content">
              {displayBadge && (
                <span className="bt-popup-badge" {...ed("badge")}>
                  {displayBadge}
                </span>
              )}

              {displayDiscount && (
                <div className="bt-popup-discount" {...ed("discountText")}>
                  {displayDiscount}
                </div>
              )}

              <h3 className="bt-popup-title" {...ed("title")}>
                {displayTitle}
              </h3>

              {displaySubtitle && (
                <p className="bt-popup-desc" {...ed("subtitle")}>
                  {displaySubtitle}
                </p>
              )}

              {code && (
                <div className="bt-popup-code-box">
                  <div className="bt-popup-code-val">
                    <span className="bt-code-label">{lang === "bn" ? "কুপন কোড:" : "Promo Code:"}</span>
                    <strong {...ed("code")}>{code}</strong>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-sm ${copied ? "btn-success" : "btn-secondary"}`}
                    onClick={copyCode}
                  >
                    {copied ? (
                      <>
                        <WidgetIcon name="check" size={14} /> {lang === "bn" ? "কপি হয়েছে!" : "Copied!"}
                      </>
                    ) : (
                      <>
                        <WidgetIcon name="copy" size={14} /> {lang === "bn" ? "কপি করুন" : "Copy"}
                      </>
                    )}
                  </button>
                </div>
              )}

              {showPhoneCapture && !leadSent && (
                <form onSubmit={handlePhoneSubmit} className="bt-popup-form">
                  <input
                    type="tel"
                    placeholder={lang === "bn" ? "আপনার মোবাইল নম্বর (যেমন: 017...)" : "Enter phone number (e.g. 017...)"}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bt-popup-input"
                    required
                  />
                  <button type="submit" className="btn btn-primary btn-block">
                    {lang === "bn" ? "ডিসকাউন্ট গ্রহণ করুন" : "Get My Discount"}
                  </button>
                </form>
              )}

              {showPhoneCapture && leadSent && (
                <div className="bt-popup-success">
                  <WidgetIcon name="check" size={24} />
                  <span>{lang === "bn" ? "ধন্যবাদ! আমরা শীঘ্রই যোগাযোগ করব।" : "Thank you! We received your inquiry."}</span>
                </div>
              )}

              {displayCta && ctaLink && !showPhoneCapture && (
                <div className="bt-popup-cta">
                  {ctaLink.startsWith("/") ? (
                    <Link
                      href={ctaLink}
                      onClick={closePopup}
                      className="btn btn-primary btn-block"
                      {...ed("ctaText")}
                    >
                      {displayCta} &rarr;
                    </Link>
                  ) : (
                    <a
                      href={ctaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closePopup}
                      className="btn btn-primary btn-block"
                      {...ed("ctaText")}
                    >
                      {displayCta} &rarr;
                    </a>
                  )}
                </div>
              )}

              <button
                type="button"
                className="bt-popup-dismiss-link"
                onClick={closePopup}
              >
                {lang === "bn" ? "না, ধন্যবাদ" : "No thanks, I'll pay full price"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
