"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function ImageComparisonSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  badge,
  badgeBn,
  beforeImage,
  afterImage,
  beforeLabel = "Before",
  beforeLabelBn = "আগে",
  afterLabel = "After",
  afterLabelBn = "পরে",
  orientation = "horizontal",
  initialSplit = "50",
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
  beforeImage?: string;
  afterImage?: string;
  beforeLabel?: string;
  beforeLabelBn?: string;
  afterLabel?: string;
  afterLabelBn?: string;
  orientation?: "horizontal" | "vertical";
  initialSplit?: string;
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;
  const displayBadge = lang === "bn" && badgeBn ? badgeBn : badge;
  const displayBefore = lang === "bn" && beforeLabelBn ? beforeLabelBn : beforeLabel;
  const displayAfter = lang === "bn" && afterLabelBn ? afterLabelBn : afterLabel;

  const [splitPos, setSplitPos] = useState<number>(() => Number(initialSplit) || 50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (orientation === "vertical") {
        const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
        setSplitPos(Math.round((y / rect.height) * 100));
      } else {
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        setSplitPos(Math.round((x / rect.width) * 100));
      }
    },
    [orientation]
  );

  const handleMouseDown = () => setIsDragging(true);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updatePosition(e.clientX, e.clientY);
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        updatePosition(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, updatePosition]);

  const defaultBefore = beforeImage || "https://images.unsplash.com/photo-1512290900672-1f486518a45c?auto=format&fit=crop&w=1200&q=80";
  const defaultAfter = afterImage || "https://images.unsplash.com/photo-1512290900672-1f486518a45c?auto=format&fit=crop&w=1200&q=80&sat=200&con=120";

  return (
    <section className="bt-comparison-sec">
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

        <div
          ref={containerRef}
          className={`bt-comparison-wrap ${orientation === "vertical" ? "bt-comparison-vertical" : ""}`}
          style={{ "--split": `${splitPos}%` } as React.CSSProperties}
          onMouseDown={handleMouseDown}
          onTouchStart={() => setIsDragging(true)}
          role="region"
          aria-label="Image comparison before and after"
        >
          {/* AFTER LAYER (FULL BACKGROUND) */}
          <div className="bt-comparison-layer bt-comparison-after">
            <img src={defaultAfter} alt={displayAfter} loading="lazy" />
            <span className="bt-comparison-pill bt-pill-after" {...ed("afterLabel")}>
              {displayAfter}
            </span>
          </div>

          {/* BEFORE LAYER (CLIPPED SLIDER) */}
          <div
            className="bt-comparison-layer bt-comparison-before"
            style={{
              clipPath:
                orientation === "vertical"
                  ? `polygon(0 0, 100% 0, 100% ${splitPos}%, 0 ${splitPos}%)`
                  : `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)`,
            }}
          >
            <img src={defaultBefore} alt={displayBefore} loading="lazy" />
            <span className="bt-comparison-pill bt-pill-before" {...ed("beforeLabel")}>
              {displayBefore}
            </span>
          </div>

          {/* DRAGGABLE DIVIDER HANDLE */}
          <div
            className="bt-comparison-handle"
            style={{
              left: orientation === "vertical" ? "50%" : `${splitPos}%`,
              top: orientation === "vertical" ? `${splitPos}%` : "50%",
            }}
          >
            <div className="bt-handle-knob">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {orientation === "vertical" ? (
                  <>
                    <polyline points="8 6 12 2 16 6" />
                    <polyline points="8 18 12 22 16 18" />
                  </>
                ) : (
                  <>
                    <polyline points="6 8 2 12 6 16" />
                    <polyline points="18 8 22 12 18 16" />
                  </>
                )}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
