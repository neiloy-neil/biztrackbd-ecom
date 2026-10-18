"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export interface HotspotPin {
  x?: string;
  y?: string;
  title?: string;
  titleBn?: string;
  price?: string;
  description?: string;
  descriptionBn?: string;
  linkText?: string;
  linkTextBn?: string;
  linkUrl?: string;
}

export function ImageHotspotsSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  badge,
  badgeBn,
  image,
  items = [],
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
  image?: string;
  items?: HotspotPin[];
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;
  const displayBadge = lang === "bn" && badgeBn ? badgeBn : badge;

  const [activePin, setActivePin] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePin(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const defaultImage =
    image ||
    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80";

  return (
    <section className="bt-hotspots-sec">
      <div className="wrap">
        {(displayTitle || displaySubtitle || displayBadge || editing) && (
          <div className="bt-widget-header text-center">
            {displayBadge && (
              <span className="bt-widget-badge" {...ed("badge")}>
                {displayBadge}
              </span>
            )}
            {displayTitle && <h2 {...ed("title")}>{displayTitle}</h2>}
            {displaySubtitle && (
              <p className="muted" {...ed("subtitle")}>
                {displaySubtitle}
              </p>
            )}
          </div>
        )}

        <div ref={containerRef} className="bt-hotspots-stage">
          <img src={defaultImage} alt={displayTitle || "Interactive lookbook"} className="bt-hotspots-img" loading="lazy" />

          {items.map((pin, idx) => {
            const pinTitle = lang === "bn" && pin.titleBn ? pin.titleBn : pin.title;
            const pinDesc = lang === "bn" && pin.descriptionBn ? pin.descriptionBn : pin.description;
            const pinLink = lang === "bn" && pin.linkTextBn ? pin.linkTextBn : pin.linkText;
            const posX = Math.max(5, Math.min(95, Number(pin.x) || 50));
            const posY = Math.max(5, Math.min(95, Number(pin.y) || 50));
            const isActive = activePin === idx;

            return (
              <div
                key={idx}
                className={`bt-hotspot-pin-anchor ${isActive ? "is-active" : ""}`}
                style={{ left: `${posX}%`, top: `${posY}%` }}
              >
                {/* RADAR PULSING BUTTON */}
                <button
                  type="button"
                  className="bt-hotspot-pin-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePin(isActive ? null : idx);
                  }}
                  aria-expanded={isActive}
                  aria-label={pinTitle || `Pin ${idx + 1}`}
                >
                  <span className="bt-hotspot-pulse" aria-hidden="true" />
                  <span className="bt-hotspot-dot" aria-hidden="true">
                    +
                  </span>
                </button>

                {/* FLOATING PRODUCT POPOVER */}
                {isActive && (
                  <div
                    className={`bt-hotspot-popover ${posX > 60 ? "pos-left" : "pos-right"} ${posY > 60 ? "pos-top" : "pos-bottom"}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bt-hotspot-popover-content">
                      <div className="bt-hotspot-popover-header">
                        {pinTitle && <h4 className="bt-hotspot-popover-title">{pinTitle}</h4>}
                        {pin.price && <span className="bt-hotspot-popover-price">{pin.price}</span>}
                      </div>

                      {pinDesc && <p className="bt-hotspot-popover-desc">{pinDesc}</p>}

                      {pinLink && pin.linkUrl && (
                        <Link href={pin.linkUrl} className="bt-hotspot-popover-btn">
                          {pinLink}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
