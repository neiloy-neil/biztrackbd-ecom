"use client";

import { useState } from "react";
import Link from "next/link";
import { WidgetIcon } from "./widget-icons";

export interface ContentTabItem {
  id?: string;
  label?: string;
  labelBn?: string;
  icon?: string;
  badge?: string;
  badgeBn?: string;
  title?: string;
  titleBn?: string;
  text?: string;
  textBn?: string;
  image?: string;
  ctaText?: string;
  ctaTextBn?: string;
  ctaLink?: string;
}

export function ContentTabsSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  tabStyle = "pills",
  items = [],
  lang,
  ed,
  editing,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  tabStyle?: "pills" | "underline" | "boxed";
  items?: ContentTabItem[];
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;

  const currentIdx = Math.min(Math.max(0, activeIdx), Math.max(0, items.length - 1));
  const activeItem = items[currentIdx];

  const itTitle = lang === "bn" && activeItem?.titleBn ? activeItem.titleBn : activeItem?.title;
  const itText = lang === "bn" && activeItem?.textBn ? activeItem.textBn : activeItem?.text;
  const itCta = lang === "bn" && activeItem?.ctaTextBn ? activeItem.ctaTextBn : activeItem?.ctaText;

  return (
    <section className="bt-tabs-sec">
      <div className="wrap">
        {(displayTitle || displaySubtitle || editing) && (
          <div className="bt-tabs-head">
            {displayTitle && <h2 {...ed("title")}>{displayTitle}</h2>}
            {displaySubtitle && <p className="muted" {...ed("subtitle")}>{displaySubtitle}</p>}
          </div>
        )}

        {items.length > 0 && (
          <div className={`bt-tabs-nav bt-tabs-style-${tabStyle}`} role="tablist">
            {items.map((tab, idx) => {
              const tabLabel = lang === "bn" && tab.labelBn ? tab.labelBn : tab.label || `Tab ${idx + 1}`;
              const tabBadge = lang === "bn" && tab.badgeBn ? tab.badgeBn : tab.badge;
              const isActive = idx === currentIdx;

              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`bt-tab-btn ${isActive ? "active" : ""}`}
                  onClick={() => setActiveIdx(idx)}
                >
                  {tab.icon && (
                    <span className="bt-tab-icon">
                      <WidgetIcon name={tab.icon} size={18} />
                    </span>
                  )}
                  <span {...ed(`items.${idx}.label`)}>{tabLabel}</span>
                  {tabBadge && (
                    <span className="bt-tab-badge" {...ed(`items.${idx}.badge`)}>
                      {tabBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {activeItem && (
          <div className="bt-tab-pane bt-tab-active" role="tabpanel">
            <div className={`bt-tab-grid ${activeItem.image ? "has-media" : "no-media"}`}>
              <div className="bt-tab-copy">
                {itTitle && <h3 className="bt-tab-title" {...ed(`items.${currentIdx}.title`)}>{itTitle}</h3>}
                {itText && <p className="bt-tab-desc" {...ed(`items.${currentIdx}.text`)}>{itText}</p>}

                {itCta && activeItem.ctaLink && (
                  <div className="bt-tab-action">
                    {activeItem.ctaLink.startsWith("/") ? (
                      <Link href={activeItem.ctaLink} className="btn btn-primary" {...ed(`items.${currentIdx}.ctaText`)}>
                        {itCta} &rarr;
                      </Link>
                    ) : (
                      <a href={activeItem.ctaLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary" {...ed(`items.${currentIdx}.ctaText`)}>
                        {itCta} &rarr;
                      </a>
                    )}
                  </div>
                )}
              </div>

              {activeItem.image && (
                <div className="bt-tab-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeItem.image}
                    alt={itTitle || "Tab media"}
                    className="bt-tab-img"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
