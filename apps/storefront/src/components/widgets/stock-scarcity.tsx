"use client";

import type { Lang } from "@/lib/i18n-core";

export function StockScarcitySection({
  headline = "Hurry, low stock!",
  headlineBn = "",
  scarcityText = "Only {count} items left in stock — selling fast!",
  scarcityTextBn = "",
  threshold = 4,
  showProgressBar = true,
  progressPercent = 84,
  urgencyColor = "#EF4444",
  badgeText = "High Demand",
  badgeTextBn = "",
  lang = "en",
  editMarks,
}: {
  headline?: string;
  headlineBn?: string;
  scarcityText?: string;
  scarcityTextBn?: string;
  threshold?: number;
  showProgressBar?: boolean;
  progressPercent?: number;
  urgencyColor?: string;
  badgeText?: string;
  badgeTextBn?: string;
  lang?: Lang;
  editMarks?: Record<string, any>;
}) {
  const isBn = lang === "bn";
  const displayHeadline = isBn && headlineBn ? headlineBn : headline;
  const rawScarcityText = isBn && scarcityTextBn ? scarcityTextBn : scarcityText;
  const displayBadgeText = isBn && badgeTextBn ? badgeTextBn : badgeText;

  const countStr = String(Math.max(1, threshold));
  const formattedText = rawScarcityText.replace(/\{count\}/g, countStr);
  const percent = Math.max(10, Math.min(98, progressPercent));

  return (
    <div className="bt-scarcity-sec" data-testid="stock-scarcity-sec">
      <div className="bt-scarcity-box">
        <div className="bt-scarcity-header">
          <div className="bt-scarcity-title-wrap">
            <span aria-hidden="true">⚡</span>
            <span {...editMarks?.headline} style={{ color: urgencyColor }}>
              {displayHeadline}
            </span>
          </div>
          {displayBadgeText && (
            <span
              className="bt-scarcity-badge"
              style={{
                background: `${urgencyColor}1a`,
                color: urgencyColor,
              }}
              {...editMarks?.badgeText}
            >
              {displayBadgeText}
            </span>
          )}
        </div>

        <p className="bt-scarcity-text" {...editMarks?.scarcityText}>
          {formattedText}
        </p>

        {showProgressBar && (
          <div className="bt-scarcity-progress-track">
            <div
              className="bt-scarcity-progress-bar"
              style={{
                width: `${percent}%`,
                background: urgencyColor,
              }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        )}
      </div>
    </div>
  );
}
