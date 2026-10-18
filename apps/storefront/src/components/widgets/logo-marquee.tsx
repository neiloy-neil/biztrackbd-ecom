"use client";

import Link from "next/link";

export interface MarqueeItem {
  name: string;
  image?: string;
  label?: string;
  labelBn?: string;
  link?: string;
}

export function LogoMarqueeSection({
  title,
  titleBn,
  badge,
  badgeBn,
  speed = "normal",
  direction = "left",
  pauseOnHover = true,
  maskEdges = true,
  items = [],
  lang,
  ed,
  editing,
}: {
  title?: string;
  titleBn?: string;
  badge?: string;
  badgeBn?: string;
  speed?: "slow" | "normal" | "fast";
  direction?: "left" | "right";
  pauseOnHover?: boolean;
  maskEdges?: boolean;
  items?: MarqueeItem[];
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displayBadge = lang === "bn" && badgeBn ? badgeBn : badge;

  const speedDuration = speed === "slow" ? "45s" : speed === "fast" ? "18s" : "30s";

  // Duplicate items twice to ensure unbroken infinite looping
  const duplicatedItems = [...items, ...items];

  return (
    <section className="bt-marquee-sec">
      <div className="wrap">
        {(displayTitle || displayBadge || editing) && (
          <div className="bt-widget-header text-center bt-marquee-head">
            {displayBadge && (
              <span className="bt-widget-badge" {...ed("badge")}>
                {displayBadge}
              </span>
            )}
            {displayTitle && <h3 {...ed("title")}>{displayTitle}</h3>}
          </div>
        )}

        <div
          className={`bt-marquee-wrap ${maskEdges ? "bt-marquee-masked" : ""} ${pauseOnHover ? "bt-marquee-pause" : ""}`}
          style={
            {
              "--marquee-duration": speedDuration,
              "--marquee-direction": direction === "right" ? "reverse" : "normal",
            } as React.CSSProperties
          }
        >
          <div className="bt-marquee-track">
            {duplicatedItems.map((item, index) => {
              const displayLabel = lang === "bn" && item.labelBn ? item.labelBn : item.label;
              const content = (
                <div className="bt-marquee-card">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="bt-marquee-img" loading="lazy" />
                  ) : (
                    <div className="bt-marquee-chip">
                      <span className="bt-marquee-name">{item.name}</span>
                      {displayLabel && <span className="bt-marquee-sub">{displayLabel}</span>}
                    </div>
                  )}
                </div>
              );

              return item.link ? (
                <Link
                  key={`${item.name}-${index}`}
                  href={item.link}
                  className="bt-marquee-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {content}
                </Link>
              ) : (
                <div key={`${item.name}-${index}`} className="bt-marquee-link">
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
