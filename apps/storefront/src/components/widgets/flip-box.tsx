"use client";

import { useState } from "react";
import Link from "next/link";
import { WidgetIcon } from "./widget-icons";

export interface FlipCardItem {
  frontTitle?: string;
  frontTitleBn?: string;
  frontSubtitle?: string;
  frontSubtitleBn?: string;
  frontBadge?: string;
  frontBadgeBn?: string;
  frontImage?: string;
  backTitle?: string;
  backTitleBn?: string;
  backText?: string;
  backTextBn?: string;
  price?: string;
  ctaText?: string;
  ctaTextBn?: string;
  ctaLink?: string;
}

export function FlipBoxSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  badge,
  badgeBn,
  columns = "3",
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
  columns?: "2" | "3" | "4";
  items?: FlipCardItem[];
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;
  const displayBadge = lang === "bn" && badgeBn ? badgeBn : badge;

  // Track flipped state per card on touch devices
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  const toggleFlip = (index: number) => {
    setFlippedCards((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <section className="bt-flip-sec">
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

        <div className={`bt-flip-grid bt-flip-cols-${columns}`}>
          {items.map((card, idx) => {
            const frontTitle = lang === "bn" && card.frontTitleBn ? card.frontTitleBn : card.frontTitle;
            const frontSub = lang === "bn" && card.frontSubtitleBn ? card.frontSubtitleBn : card.frontSubtitle;
            const frontBadge = lang === "bn" && card.frontBadgeBn ? card.frontBadgeBn : card.frontBadge;
            const backTitle = lang === "bn" && card.backTitleBn ? card.backTitleBn : card.backTitle;
            const backText = lang === "bn" && card.backTextBn ? card.backTextBn : card.backText;
            const ctaText = lang === "bn" && card.ctaTextBn ? card.ctaTextBn : card.ctaText;
            const isFlipped = Boolean(flippedCards[idx]);

            return (
              <div
                key={idx}
                className={`bt-flip-card ${isFlipped ? "is-flipped" : ""}`}
                onClick={() => toggleFlip(idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleFlip(idx);
                  }
                }}
                aria-pressed={isFlipped}
                {...ed(`items.${idx}.frontTitle`)}
              >
                <div className="bt-flip-inner">
                  {/* FRONT FACE */}
                  <div className="bt-flip-face bt-flip-front">
                    {card.frontImage && (
                      <div className="bt-flip-img-wrap">
                        <img src={card.frontImage} alt={frontTitle || "Card preview"} loading="lazy" />
                        <div className="bt-flip-overlay" />
                      </div>
                    )}
                    <div className="bt-flip-front-content">
                      <div className="bt-flip-top-row">
                        {frontBadge && <span className="bt-flip-badge">{frontBadge}</span>}
                        <span className="bt-flip-hint">
                          <WidgetIcon name="arrows" size={14} />
                          {lang === "bn" ? "উল্টাতে ক্লিক করুন" : "Hover / Tap"}
                        </span>
                      </div>
                      <div className="bt-flip-front-bottom">
                        {frontTitle && <h3 className="bt-flip-title">{frontTitle}</h3>}
                        {frontSub && <p className="bt-flip-sub">{frontSub}</p>}
                      </div>
                    </div>
                  </div>

                  {/* BACK FACE */}
                  <div className="bt-flip-face bt-flip-back">
                    <div className="bt-flip-back-content">
                      {backTitle && <h3 className="bt-flip-back-title">{backTitle}</h3>}
                      {card.price && <div className="bt-flip-price">{card.price}</div>}
                      {backText && <p className="bt-flip-back-desc">{backText}</p>}

                      {ctaText && card.ctaLink && (
                        <div className="bt-flip-back-cta" onClick={(e) => e.stopPropagation()}>
                          <Link href={card.ctaLink} className="btn btn-primary btn-sm">
                            {ctaText}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
