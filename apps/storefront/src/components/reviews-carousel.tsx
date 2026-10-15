"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n-core";

export interface ReviewItem {
  name: string;
  location?: string;
  text: string;
  rating?: number;
  photo?: string;
}

export function ReviewsCarousel({
  title,
  titleBn,
  items,
  lang = "bn",
}: {
  title?: string;
  titleBn?: string;
  items: ReviewItem[];
  lang?: Lang;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const isBn = lang === "bn";
  const heading = isBn && titleBn ? titleBn : title || (isBn ? "গ্রাহকদের আসল মতামত ও রিভিউ" : "What Our Customers Say");

  if (!items || items.length === 0) return null;

  const next = () => setActiveIdx((prev) => (prev + 1) % items.length);
  const prev = () => setActiveIdx((prev) => (prev - 1 + items.length) % items.length);

  return (
    <section className="lp-block lp-reviews-section" data-testid="lp-reviews-carousel">
      <div className="wrap">
        <div className="lp-reviews-header">
          <div className="lp-reviews-badge">
            <span className="lp-stars" aria-hidden="true">★★★★★</span>
            <span>{isBn ? "৪.৯/৫ রেটিং (৫০০+ গ্রাহক)" : "4.9/5 Rating (500+ Buyers)"}</span>
          </div>
          <h2 className="lp-reviews-title">{heading}</h2>
        </div>

        {/* Carousel for mobile & tablet, grid for desktop when 3 or fewer */}
        <div className="lp-carousel-container">
          <div className="lp-carousel-track">
            {items.map((rev, i) => {
              const isActive = i === activeIdx;
              const rating = Math.min(5, Math.max(1, Number(rev.rating) || 5));

              return (
                <figure
                  key={i}
                  className={`lp-review-card ${isActive ? "active" : ""}`}
                  aria-hidden={!isActive && items.length > 1 ? undefined : false}
                >
                  <div className="lp-review-card-top">
                    <div className="lp-review-stars" aria-label={`${rating} stars`}>
                      {"★".repeat(rating)}
                    </div>
                    <span className="lp-verified-tag">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                      {isBn ? "ভেরিফায়েড ক্রেতা" : "Verified Buyer"}
                    </span>
                  </div>

                  <blockquote className="lp-review-quote">
                    "{rev.text}"
                  </blockquote>

                  {rev.photo && (
                    <div className="lp-review-photo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rev.photo} alt={rev.name} loading="lazy" />
                    </div>
                  )}

                  <figcaption className="lp-review-author">
                    <div className="lp-author-avatar" aria-hidden="true">
                      {rev.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <b className="lp-author-name">{rev.name}</b>
                      {rev.location && <span className="lp-author-loc">{rev.location}</span>}
                    </div>
                  </figcaption>
                </figure>
              );
            })}
          </div>

          {items.length > 1 && (
            <div className="lp-carousel-controls">
              <button
                type="button"
                className="lp-carousel-btn"
                onClick={prev}
                aria-label={isBn ? "আগের রিভিউ" : "Previous review"}
              >
                ‹
              </button>
              <div className="lp-carousel-dots">
                {items.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    className={`lp-dot ${dotIdx === activeIdx ? "active" : ""}`}
                    onClick={() => setActiveIdx(dotIdx)}
                    aria-label={`Slide ${dotIdx + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                className="lp-carousel-btn"
                onClick={next}
                aria-label={isBn ? "পরের রিভিউ" : "Next review"}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
