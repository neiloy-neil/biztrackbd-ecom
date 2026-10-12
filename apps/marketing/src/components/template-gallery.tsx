"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { demoAdminUrl } from "@/lib/demo-admin";
import { demoUrl } from "@/components/template-card";

const THEME_HOSTS: Record<string, string> = {
  kapor: "kapor",
  gadgetstudio: "gadgetstudio",
  "mini-bunny": "minibunny",
  axionwear: "axionwear",
  bindu: "bindu",
  berber: "berber",
};

export type CategoryFilter = "all" | "fashion" | "electronics" | "kids" | "streetwear" | "beauty";

export interface GalleryTheme {
  id: string;
  name: string;
  sub: string;
  category: CategoryFilter;
  categoryLabel: string;
  tag1: string;
  tag2: string;
  module: string;
}

export const TEMPLATES_DATA: GalleryTheme[] = [
  {
    id: "kapor",
    name: "Kapor",
    sub: "Warm, editorial fashion store for panjabi, sarees, shirts and lifestyle.",
    category: "fashion",
    categoryLabel: "Fashion",
    tag1: "Fashion",
    tag2: "Panjabi & Sarees",
    module: "Size guide",
  },
  {
    id: "gadgetstudio",
    name: "Gadget Studio",
    sub: "Clean gadgets and electronics store with spec tables and warranty badges.",
    category: "electronics",
    categoryLabel: "Electronics",
    tag1: "Electronics",
    tag2: "Tech Specs",
    module: "Warranty field",
  },
  {
    id: "mini-bunny",
    name: "Mini Bunny",
    sub: "Playful, friendly kids wear and toy store with sizing by age.",
    category: "kids",
    categoryLabel: "Kids",
    tag1: "Kids",
    tag2: "Toys & Apparel",
    module: "Size by age",
  },
  {
    id: "axionwear",
    name: "Axion Wear",
    sub: "High-contrast streetwear and athletic apparel with bold drop highlights.",
    category: "streetwear",
    categoryLabel: "Streetwear",
    tag1: "Streetwear",
    tag2: "Drop Countdown",
    module: "Dark mode",
  },
  {
    id: "bindu",
    name: "Bindu",
    sub: "Polished, calm beauty and skincare storefront with jewel-toned accents.",
    category: "beauty",
    categoryLabel: "Beauty",
    tag1: "Beauty",
    tag2: "Skincare",
    module: "Ingredient tabs",
  },
  {
    id: "berber",
    name: "Berber",
    sub: "Dark, editorial formalwear, blazers, and custom fit suits.",
    category: "fashion",
    categoryLabel: "Fashion",
    tag1: "Formalwear",
    tag2: "Tailoring",
    module: "Bespoke ready",
  },
];

const CATEGORIES: { id: CategoryFilter; label: string; count: number }[] = [
  { id: "all", label: "All", count: 6 },
  { id: "fashion", label: "Fashion", count: 2 },
  { id: "electronics", label: "Electronics", count: 1 },
  { id: "kids", label: "Kids", count: 1 },
  { id: "streetwear", label: "Streetwear", count: 1 },
  { id: "beauty", label: "Beauty", count: 1 },
];

export function TemplateGallery() {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const filtered =
    activeCategory === "all"
      ? TEMPLATES_DATA
      : TEMPLATES_DATA.filter((t) => t.category === activeCategory);

  return (
    <>
      {/* Category Filter Bar matching MktTemplates.dc.html */}
      <div
        style={{
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          background: "#FFFFFF",
          padding: "16px 0",
          margin: "32px 0 40px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 20,
                  background: isActive ? "var(--ink)" : "#FFFFFF",
                  color: isActive ? "#FFFFFF" : "var(--ink-2)",
                  border: isActive ? "1px solid var(--ink)" : "1px solid #D5D5E4",
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
              >
                <span>{cat.label}</span>
                <span
                  style={{
                    opacity: isActive ? 0.8 : 0.65,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
          <div style={{ flexGrow: 1 }} />
          <div style={{ fontSize: 14, color: "var(--ink-2)" }}>
            Sorted by: <strong style={{ color: "var(--ink)" }}>Most used</strong>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div
        className="grid g3"
        style={{ gap: "32px 24px" }}
        data-testid="templates"
      >
        {filtered.map((t) => {
          const host = THEME_HOSTS[t.id] ?? t.id;
          const demoStoreUrl = demoUrl(host);

          return (
            <div
              key={t.id}
              className="card tpl"
              data-testid={`theme-${t.id}`}
              style={{
                borderRadius: 16,
                padding: 18,
                border: "1px solid var(--line)",
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Dual Device Preview Frame */}
              <div
                className="tpl-shot"
                style={{
                  height: 220,
                  borderRadius: 12,
                  overflow: "hidden",
                  position: "relative",
                  background: "var(--soft)",
                  border: "1px solid var(--line)",
                }}
              >
                <Image
                  src={`/templates/${t.id}.webp`}
                  alt={`${t.name} template home page`}
                  fill
                  sizes="(min-width: 900px) 33vw, 100vw"
                  style={{ objectFit: "cover", objectPosition: "top" }}
                />
                <div
                  style={{
                    position: "absolute",
                    right: 12,
                    bottom: -8,
                    width: "28%",
                    height: "75%",
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "2px solid #FFFFFF",
                    boxShadow: "0 6px 16px rgba(26, 26, 78, 0.2)",
                  }}
                >
                  <Image
                    src={`/templates/${t.id}-phone.webp`}
                    alt={`${t.name} mobile preview`}
                    fill
                    sizes="110px"
                    style={{ objectFit: "cover", objectPosition: "top" }}
                  />
                </div>
              </div>

              {/* Title and Description */}
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                  {t.name}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--ink-2)",
                    lineHeight: 1.55,
                    marginTop: 6,
                    minHeight: 44,
                  }}
                >
                  {t.sub}
                </p>
              </div>

              {/* Badges / Tags */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 11,
                    background: "#EFEFF6",
                    color: "var(--ink-2)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {t.tag1}
                </span>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 11,
                    background: "#EFEFF6",
                    color: "var(--ink-2)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {t.tag2}
                </span>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 11,
                    background: "var(--tint)",
                    color: "var(--brand)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {t.module}
                </span>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: "auto",
                  paddingTop: 12,
                  borderTop: "1px solid var(--line)",
                }}
              >
                <a
                  href={demoStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, minHeight: 40, borderRadius: 20 }}
                  data-testid={`demo-${t.id}`}
                >
                  Live demo ↗
                </a>
                <Link
                  href={`/start?theme=${t.id}`}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1.2, minHeight: 40, borderRadius: 20 }}
                  prefetch={false}
                >
                  Use template
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
