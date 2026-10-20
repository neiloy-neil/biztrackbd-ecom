"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import type { RecentSaleItem, SocialProofSettings } from "@biztrackbd/core";

export function SocialProofToasts({
  feed = [],
  settings,
  lang = "en",
}: {
  feed?: RecentSaleItem[];
  settings?: SocialProofSettings;
  lang?: string;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [paused, setPaused] = useState(false);
  // The made-up sample sale is only for the editor preview. A live store with no sales shows nothing: never a fake "Verified Order".
  const [inEditorPreview, setInEditorPreview] = useState(false);
  useEffect(() => { setInEditorPreview(typeof window !== "undefined" && window.parent !== window); }, []);
  const touchStartX = useRef<number | null>(null);

  const isBn = lang === "bn";
  const isEnabled = settings?.enabled ?? true;
  const position = settings?.position ?? "bottom-left";
  const initialDelay = (settings?.initialDelaySec ?? 4) * 1000;
  const interval = (settings?.intervalSec ?? 14) * 1000;
  const duration = (settings?.displayDurationSec ?? 5) * 1000;
  const showOnMobile = settings?.showOnMobile ?? true;
  const safeAreaBottom = settings?.safeAreaBottomPx ?? 76;

  const activeFeed = feed.length > 0 ? feed : !inEditorPreview ? [] : [
    {
      id: "demo-preview-item",
      buyerName: isBn ? "তানভীর এ." : "Tanvir A.",
      district: isBn ? "ধানমন্ডি, ঢাকা" : "Dhanmondi, Dhaka",
      productTitle: isBn ? "প্রিমিয়াম সুতি পাঞ্জাবি" : "Premium Cotton Panjabi",
      productImage: null,
      productUrl: "#",
      timeAgoText: isBn ? "২ মিনিট আগে" : "2 minutes ago",
      timestamp: Date.now() - 120000,
    },
  ];

  // Listen for builder preview trigger message
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === "bt-preview:trigger-fomo") {
        setDismissed(false);
        setVisible(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Initial display timer
  useEffect(() => {
    if (!isEnabled || dismissed || activeFeed.length === 0) return;

    const timer = setTimeout(() => {
      setVisible(true);
    }, initialDelay);

    return () => clearTimeout(timer);
  }, [isEnabled, dismissed, activeFeed.length, initialDelay]);

  // Visibility and rotation cycle
  useEffect(() => {
    if (!isEnabled || dismissed || activeFeed.length === 0) return;

    if (visible && !paused) {
      // Auto-hide after duration
      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, duration);

      return () => clearTimeout(hideTimer);
    }

    if (!visible && !dismissed) {
      // Wait interval, then show next
      const nextTimer = setTimeout(() => {
        setIndex((prev) => (prev + 1) % activeFeed.length);
        setVisible(true);
      }, interval);

      return () => clearTimeout(nextTimer);
    }
  }, [visible, paused, isEnabled, dismissed, activeFeed.length, duration, interval]);

  if (!isEnabled || dismissed || activeFeed.length === 0 || !visible) return null;

  const current = activeFeed[index] || activeFeed[0]!;

  const posStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 9998,
    maxWidth: 360,
    width: "calc(100% - 28px)",
  };

  if (position === "top-right") {
    posStyle.top = 20;
    posStyle.right = 16;
  } else if (position === "top-left") {
    posStyle.top = 20;
    posStyle.left = 16;
  } else if (position === "bottom-right") {
    posStyle.bottom = 20;
    posStyle.right = 16;
  } else {
    // bottom-left (default)
    posStyle.bottom = 20;
    posStyle.left = 16;
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0]?.clientX ? e.changedTouches[0].clientX - touchStartX.current : 0;
    if (Math.abs(deltaX) > 60) {
      // Swipe dismiss
      setVisible(false);
    }
    touchStartX.current = null;
  };

  return (
    <aside
      className={`bt-fomo-toast bt-fomo-pos-${position}${!showOnMobile ? " bt-fomo-hide-mobile" : ""}`}
      style={{
        ...posStyle,
        "--fomo-safe-bottom": `${safeAreaBottom}px`,
      } as React.CSSProperties}
      data-testid="social-proof-toast"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="status"
      aria-live="polite"
    >
      <div className="bt-fomo-card">
        {current.productImage ? (
          <div className="bt-fomo-img-wrap">
            <img
              src={current.productImage}
              alt={current.productTitle}
              className="bt-fomo-img"
              width={50}
              height={50}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="bt-fomo-icon-wrap" aria-hidden="true">
            🛍️
          </div>
        )}

        <div className="bt-fomo-body">
          <div className="bt-fomo-header">
            <span className="bt-fomo-buyer">{current.buyerName}</span>
            {current.district && (
              <span className="bt-fomo-loc">({current.district})</span>
            )}
          </div>
          <div className="bt-fomo-product">
            {current.productUrl ? (
              <Link href={current.productUrl} className="bt-fomo-link" onClick={() => setVisible(false)}>
                {current.productTitle}
              </Link>
            ) : (
              <span>{current.productTitle}</span>
            )}
          </div>
          <div className="bt-fomo-meta">
            <span className="bt-fomo-badge">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" style={{ display: "inline-block", verticalAlign: "-1px" }}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{isBn ? "ভেরিফায়েড অর্ডার" : "Verified Order"}</span>
            </span>
            <span className="bt-fomo-time">· {current.timeAgoText}</span>
          </div>
        </div>

        <button
          type="button"
          className="bt-fomo-close"
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
          aria-label={isBn ? "বন্ধ করুন" : "Dismiss notification"}
          title={isBn ? "বন্ধ করুন" : "Dismiss"}
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
