"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WidgetIcon } from "./widget-icons";

export interface TestimonialItem {
  name: string;
  nameBn?: string;
  role?: string;
  roleBn?: string;
  location?: string;
  locationBn?: string;
  rating?: number;
  text: string;
  textBn?: string;
  avatar?: string;
  verified?: boolean;
}

export function TestimonialsSliderSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  badge,
  badgeBn,
  layout = "cards",
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
  layout?: "cards" | "minimal" | "single";
  items?: TestimonialItem[];
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;
  const displayBadge = lang === "bn" && badgeBn ? badgeBn : badge;

  const count = items.length;

  const next = useCallback(() => {
    if (count <= 1) return;
    setActiveIdx((prev) => (prev + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    if (count <= 1) return;
    setActiveIdx((prev) => (prev - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    if (editing || isPaused || count <= 1) return;
    timerRef.current = setInterval(next, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [editing, isPaused, count, next]);

  return (
    <section
      className="bt-reviews-sec"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="wrap">
        {(displayBadge || displayTitle || displaySubtitle || editing) && (
          <div className="bt-reviews-head">
            {displayBadge && (
              <div className="bt-reviews-badge-wrap">
                <span className="bt-reviews-stars-icon" aria-hidden="true">★★★★★</span>
                <span className="bt-reviews-badge-text" {...ed("badge")}>
                  {displayBadge}
                </span>
              </div>
            )}
            {displayTitle && <h2 {...ed("title")}>{displayTitle}</h2>}
            {displaySubtitle && <p className="muted" {...ed("subtitle")}>{displaySubtitle}</p>}
          </div>
        )}

        {count > 0 && (
          <div className={`bt-reviews-slider bt-layout-${layout}`}>
            <div className="bt-reviews-track">
              {items.map((rev, idx) => {
                const isActive = idx === activeIdx;
                const name = lang === "bn" && rev.nameBn ? rev.nameBn : rev.name;
                const role = lang === "bn" && rev.roleBn ? rev.roleBn : rev.role;
                const location = lang === "bn" && rev.locationBn ? rev.locationBn : rev.location;
                const text = lang === "bn" && rev.textBn ? rev.textBn : rev.text;
                const rating = Math.min(5, Math.max(1, Number(rev.rating) || 5));

                return (
                  <div
                    key={idx}
                    className={`bt-review-card ${isActive ? "active" : ""}`}
                    aria-hidden={!isActive && count > 1 ? true : undefined}
                  >
                    <div className="bt-review-card-inner">
                      <div className="bt-review-card-top">
                        <div className="bt-review-stars" aria-label={`${rating} stars`}>
                          {"★".repeat(rating)}
                        </div>
                        {rev.verified !== false && (
                          <span className="bt-verified-pill">
                            <WidgetIcon name="check" size={13} />
                            <span>{lang === "bn" ? "ভেরিফায়েড ক্রেতা" : "Verified Buyer"}</span>
                          </span>
                        )}
                      </div>

                      <blockquote className="bt-review-text" {...ed(`items.${idx}.text`)}>
                        &ldquo;{text}&rdquo;
                      </blockquote>

                      <div className="bt-review-author">
                        {rev.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={rev.avatar}
                            alt={name}
                            className="bt-review-avatar"
                            loading="lazy"
                          />
                        ) : (
                          <div className="bt-review-avatar-initials">
                            {name ? name.slice(0, 1).toUpperCase() : "U"}
                          </div>
                        )}

                        <div className="bt-review-meta">
                          <strong className="bt-review-name" {...ed(`items.${idx}.name`)}>
                            {name}
                          </strong>
                          {(role || location) && (
                            <span className="bt-review-sub">
                              {role && <span {...ed(`items.${idx}.role`)}>{role}</span>}
                              {role && location && " · "}
                              {location && <span {...ed(`items.${idx}.location`)}>{location}</span>}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {count > 1 && (
              <div className="bt-reviews-controls">
                <button
                  type="button"
                  className="bt-slider-btn bt-prev-btn"
                  onClick={prev}
                  aria-label="Previous testimonial"
                >
                  &larr;
                </button>

                <div className="bt-slider-dots" role="tablist">
                  {items.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      role="tab"
                      aria-selected={idx === activeIdx}
                      className={`bt-dot ${idx === activeIdx ? "active" : ""}`}
                      onClick={() => setActiveIdx(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="bt-slider-btn bt-next-btn"
                  onClick={next}
                  aria-label="Next testimonial"
                >
                  &rarr;
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
