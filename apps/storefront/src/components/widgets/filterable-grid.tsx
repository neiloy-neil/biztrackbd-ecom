"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { WidgetIcon } from "./widget-icons";

export interface FilterableItem {
  title?: string;
  titleBn?: string;
  category?: string;
  categoryBn?: string;
  description?: string;
  descriptionBn?: string;
  price?: string;
  badge?: string;
  badgeBn?: string;
  image?: string;
  ctaText?: string;
  ctaTextBn?: string;
  ctaLink?: string;
}

export function FilterableGridSection({
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
  items?: FilterableItem[];
  lang: "en" | "bn";
  ed: (path: string) => Record<string, string>;
  editing?: boolean;
}) {
  const displayTitle = lang === "bn" && titleBn ? titleBn : title;
  const displaySubtitle = lang === "bn" && subtitleBn ? subtitleBn : subtitle;
  const displayBadge = lang === "bn" && badgeBn ? badgeBn : badge;

  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  // Extract unique categories
  const categories = useMemo(() => {
    const map = new Map<string, { en: string; bn: string }>();
    for (const it of items) {
      if (it.category) {
        const catEn = it.category.trim();
        const catBn = it.categoryBn?.trim() || catEn;
        if (!map.has(catEn.toLowerCase())) {
          map.set(catEn.toLowerCase(), { en: catEn, bn: catBn });
        }
      }
    }
    return Array.from(map.values());
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (activeCategory === "ALL") return items;
    return items.filter(
      (it) => it.category?.trim().toLowerCase() === activeCategory.toLowerCase()
    );
  }, [items, activeCategory]);

  return (
    <section className="bt-filterable-sec">
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

        {/* CATEGORY FILTER PILLS */}
        <div className="bt-filterable-pills-wrap">
          <button
            type="button"
            className={`bt-filterable-pill ${activeCategory === "ALL" ? "is-active" : ""}`}
            onClick={() => setActiveCategory("ALL")}
          >
            {lang === "bn" ? "সবগুলো" : "All"} ({items.length})
          </button>

          {categories.map((cat) => {
            const label = lang === "bn" && cat.bn ? cat.bn : cat.en;
            const count = items.filter(
              (it) => it.category?.trim().toLowerCase() === cat.en.toLowerCase()
            ).length;

            return (
              <button
                key={cat.en}
                type="button"
                className={`bt-filterable-pill ${activeCategory.toLowerCase() === cat.en.toLowerCase() ? "is-active" : ""}`}
                onClick={() => setActiveCategory(cat.en)}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* FILTERABLE CARDS GRID */}
        <div className={`bt-filterable-grid bt-filterable-cols-${columns}`}>
          {filteredItems.map((item, idx) => {
            const itemTitle = lang === "bn" && item.titleBn ? item.titleBn : item.title;
            const itemCat = lang === "bn" && item.categoryBn ? item.categoryBn : item.category;
            const itemDesc = lang === "bn" && item.descriptionBn ? item.descriptionBn : item.description;
            const itemBadge = lang === "bn" && item.badgeBn ? item.badgeBn : item.badge;
            const ctaText = lang === "bn" && item.ctaTextBn ? item.ctaTextBn : item.ctaText;

            return (
              <div key={idx} className="bt-filterable-card" {...ed(`items.${idx}.title`)}>
                {item.image && (
                  <div className="bt-filterable-card-media">
                    <img src={item.image} alt={itemTitle || "Card preview"} loading="lazy" />
                    {itemBadge && <span className="bt-filterable-card-badge">{itemBadge}</span>}
                  </div>
                )}

                <div className="bt-filterable-card-body">
                  <div className="bt-filterable-card-top">
                    {itemCat && <span className="bt-filterable-card-cat">{itemCat}</span>}
                    {item.price && <span className="bt-filterable-card-price">{item.price}</span>}
                  </div>

                  {itemTitle && <h3 className="bt-filterable-card-title">{itemTitle}</h3>}
                  {itemDesc && <p className="bt-filterable-card-desc">{itemDesc}</p>}

                  {ctaText && item.ctaLink && (
                    <div className="bt-filterable-card-cta">
                      <Link href={item.ctaLink} className="btn btn-outline btn-sm">
                        {ctaText}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
