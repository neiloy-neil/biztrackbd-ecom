"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef } from "react";
import { demoUrl } from "@/components/template-card";
import { handleTabListKeyDown, useModalFocusTrap } from "@/lib/a11y";

const THEME_HOSTS: Record<string, string> = {
  kapor: "kapor",
  gadgetstudio: "gadgetstudio",
  "mini-bunny": "minibunny",
  axionwear: "axionwear",
  bindu: "bindu",
  berber: "berber",
  "dhaka-bistro": "dhakabistro",
  "modern-clinic": "modernclinic",
  "apex-corporate": "apexcorp",
  "local-service-pro": "localservice",
  "portfolio-focus": "creativefolio",
};

export type GalleryMode = "ecommerce" | "business";
const GALLERY_MODES: readonly GalleryMode[] = ["ecommerce", "business"];

export type EcommerceCategoryFilter = "all" | "fashion" | "electronics" | "kids" | "streetwear" | "beauty";
export type BusinessCategoryFilter = "all" | "restaurant" | "doctor" | "corporate" | "services" | "portfolio" | "public-figure";

export interface GalleryTheme {
  id: string;
  name: string;
  sub: string;
  category: string;
  categoryLabel: string;
  tag1: string;
  tag2: string;
  module: string;
  mode?: GalleryMode;
  vertical?: string;
  colors?: { accent: string; background: string; text: string };
  previewFeatures?: string[];
  /** A template uploaded by staff: no live demo store, so it is shown from its preview pictures (https links) instead. */
  uploaded?: boolean;
  previewDesktop?: string;
  previewMobile?: string;
}

export const ECOMMERCE_TEMPLATES: GalleryTheme[] = [
  {
    id: "kapor",
    name: "Kapor",
    sub: "Warm, editorial fashion store for panjabi, sarees, shirts, and lifestyle accessories.",
    category: "fashion",
    categoryLabel: "Fashion",
    tag1: "Fashion",
    tag2: "Panjabi & Sarees",
    module: "Size guide",
    mode: "ecommerce",
  },
  {
    id: "gadgetstudio",
    name: "Gadget Studio",
    sub: "Clean gadgets and electronics store with spec tables, EMI calculators, and warranty badges.",
    category: "electronics",
    categoryLabel: "Electronics",
    tag1: "Electronics",
    tag2: "Tech Specs",
    module: "Warranty field",
    mode: "ecommerce",
  },
  {
    id: "mini-bunny",
    name: "Mini Bunny",
    sub: "Playful, friendly kids wear and toy store with sizing by age and gift packaging options.",
    category: "kids",
    categoryLabel: "Kids",
    tag1: "Kids",
    tag2: "Toys & Apparel",
    module: "Size by age",
    mode: "ecommerce",
  },
  {
    id: "axionwear",
    name: "Axion Wear",
    sub: "High-contrast streetwear and athletic apparel with bold drop countdowns and size presets.",
    category: "streetwear",
    categoryLabel: "Streetwear",
    tag1: "Streetwear",
    tag2: "Drop Countdown",
    module: "Dark mode",
    mode: "ecommerce",
  },
  {
    id: "bindu",
    name: "Bindu",
    sub: "Polished, calm beauty and skincare storefront with jewel-toned accents and ingredient highlights.",
    category: "beauty",
    categoryLabel: "Beauty",
    tag1: "Beauty",
    tag2: "Skincare",
    module: "Ingredient tabs",
    mode: "ecommerce",
  },
  {
    id: "berber",
    name: "Berber",
    sub: "Dark, editorial formalwear, bespoke blazers, and custom tailoring with appointment booking.",
    category: "fashion",
    categoryLabel: "Fashion",
    tag1: "Formalwear",
    tag2: "Tailoring",
    module: "Bespoke ready",
    mode: "ecommerce",
  },
];

export const BUSINESS_TEMPLATES_DATA: GalleryTheme[] = [
  {
    id: "dhaka-bistro",
    name: "Dhaka Bistro",
    sub: "Warm, atmospheric restaurant & café theme with digital QR menu, live table tray, and WhatsApp ordering.",
    category: "restaurant",
    categoryLabel: "Restaurant",
    tag1: "Digital QR Menu",
    tag2: "Table Ordering",
    module: "Food & Dining",
    mode: "business",
    vertical: "RESTAURANT",
    colors: { accent: "#D97706", background: "#FFFDF8", text: "#1C1917" },
    previewFeatures: ["Contactless Table QR", "Bilingual Dishes", "Dietary Tags (Halal, Spicy)", "Call Waiter Action"],
  },
  {
    id: "modern-clinic",
    name: "Modern Clinic & Chambers",
    sub: "Clean, authoritative healthcare practice theme with doctor credentials, multi-chamber visiting schedules, and appointments.",
    category: "doctor",
    categoryLabel: "Healthcare",
    tag1: "BMDC Verified",
    tag2: "Multi-Chambers",
    module: "Clinic & Health",
    mode: "business",
    vertical: "DOCTOR_CLINIC",
    colors: { accent: "#0284C7", background: "#F8FAFC", text: "#0F172A" },
    previewFeatures: ["BMDC Credentials", "Dhanmondi & Mirpur Chambers", "Visiting Hours", "Appointment Booking"],
  },
  {
    id: "apex-corporate",
    name: "Apex Corporate Advisory",
    sub: "Authoritative corporate presence for consultancies and B2B firms with practice areas, leadership team, and company profile PDF.",
    category: "corporate",
    categoryLabel: "Corporate",
    tag1: "Practice Areas",
    tag2: "Leadership Team",
    module: "Corporate Trust",
    mode: "business",
    vertical: "BUSINESS_COMPANY",
    colors: { accent: "#1E40AF", background: "#FFFFFF", text: "#111827" },
    previewFeatures: ["Practice Areas", "Leadership Bio Grid", "ISO Certification", "Downloadable Profile"],
  },
  {
    id: "local-service-pro",
    name: "Local Service Pro",
    sub: "High-converting service business website with transparent upfront pricing, coverage map, and instant quote requests.",
    category: "services",
    categoryLabel: "Services",
    tag1: "Upfront Pricing",
    tag2: "Coverage Map",
    module: "Service Pros",
    mode: "business",
    vertical: "SERVICE_PROVIDER",
    colors: { accent: "#0D9488", background: "#F0FDFA", text: "#134E4A" },
    previewFeatures: ["Fixed Service Pricing", "Coverage Map", "Free Quote Form", "30-Day Guarantee"],
  },
  {
    id: "portfolio-focus",
    name: "Portfolio Focus",
    sub: "Minimalist, striking personal portfolio showcasing project case studies, technical stack proficiency, and CV download.",
    category: "portfolio",
    categoryLabel: "Portfolio",
    tag1: "Case Studies",
    tag2: "Skills & Stack",
    module: "Creative & Tech",
    mode: "business",
    vertical: "PERSONAL_PORTFOLIO",
    colors: { accent: "#4F46E5", background: "#FAFAFA", text: "#18181B" },
    previewFeatures: ["Fintech & SaaS Case Studies", "Design System Highlights", "Resume Download", "Direct Contact"],
  },
  {
    id: "public-profile",
    name: "Public Profile & Leader",
    sub: "Distinguished personal branding for authors, speakers, researchers, and public figures with op-ed publications, press kit, and invitation forms.",
    category: "public-figure",
    categoryLabel: "Public Figure",
    tag1: "Media & Press Kit",
    tag2: "Op-Eds & Speaking",
    module: "Leadership & Media",
    mode: "business",
    vertical: "PUBLIC_FIGURE",
    colors: { accent: "#4338CA", background: "#FAFAFA", text: "#1E1B4B" },
    previewFeatures: ["Media Kit & Press Kit", "Op-Ed Column Showcase", "Official Biography", "Keynote Invitation Form"],
  },
];

const ECOM_CATEGORIES: { id: EcommerceCategoryFilter; label: string }[] = [
  { id: "all", label: "All Stores" },
  { id: "fashion", label: "Fashion & Apparel" },
  { id: "electronics", label: "Electronics & Tech" },
  { id: "kids", label: "Kids & Toys" },
  { id: "streetwear", label: "Streetwear" },
  { id: "beauty", label: "Beauty & Cosmetics" },
];

const BIZ_CATEGORIES: { id: BusinessCategoryFilter; label: string }[] = [
  { id: "all", label: "All Businesses" },
  { id: "restaurant", label: "Restaurants & Cafés" },
  { id: "doctor", label: "Doctors & Clinics" },
  { id: "corporate", label: "Corporate & B2B" },
  { id: "services", label: "Home & Tech Services" },
  { id: "portfolio", label: "Portfolios & Freelancers" },
  { id: "public-figure", label: "Public Profile & Leaders" },
];

export interface PublishedGalleryTheme extends GalleryTheme {
  colors: { accent: string; background: string; text: string };
}

export function TemplateGallery({
  extra = [],
  businessExtra = [],
  hidden = [],
  initialMode = "ecommerce",
}: {
  extra?: PublishedGalleryTheme[];
  businessExtra?: PublishedGalleryTheme[];
  hidden?: string[]
  initialMode?: GalleryMode;
}) {
  const [activeMode, setActiveMode] = useState<GalleryMode>(initialMode);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Modal Previewer State & Focus Management
  const [previewTemplate, setPreviewTemplate] = useState<GalleryTheme | null>(null);
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLElement | null>(null);

  useModalFocusTrap(
    !!previewTemplate,
    modalRef,
    () => setPreviewTemplate(null),
    triggerButtonRef
  );

  const ecomAll = [...ECOMMERCE_TEMPLATES.filter((t) => !hidden.includes(t.id)), ...extra];
  const bizAll = [...BUSINESS_TEMPLATES_DATA, ...businessExtra.filter((x) => !BUSINESS_TEMPLATES_DATA.some((b) => b.id === x.id))];
  const currentTemplates = activeMode === "ecommerce" ? ecomAll : bizAll;

  const filtered = activeCategory === "all"
    ? currentTemplates
    : currentTemplates.filter((t) => t.category === activeCategory);

  const categories = activeMode === "ecommerce"
    ? ECOM_CATEGORIES.map((c) => ({
        ...c,
        count: c.id === "all" ? ecomAll.length : ecomAll.filter((t) => t.category === c.id).length,
      }))
    : BIZ_CATEGORIES.map((c) => ({
        ...c,
        count: c.id === "all" ? bizAll.length : bizAll.filter((t) => t.category === c.id).length,
      }));

  const handleModeSwitch = (mode: GalleryMode) => {
    setActiveMode(mode);
    setActiveCategory("all");
  };

  const getStartUrl = (t: GalleryTheme) => {
    if (t.mode === "business" && t.vertical) {
      return `/start?template=${t.id}&mode=business&vertical=${t.vertical.toLowerCase()}`;
    }
    return `/start?theme=${t.id}&mode=ecommerce`;
  };

  return (
    <>
      {/* Primary Segmented Mode Switcher: Online Storefronts vs Business & Service Websites */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          margin: "24px 0 16px",
          maxWidth: "100%",
          padding: "0 8px",
          boxSizing: "border-box",
        }}
      >
        <div
          role="tablist"
          aria-label="Template platform mode"
          onKeyDown={(e) => handleTabListKeyDown(e, GALLERY_MODES, activeMode, handleModeSwitch)}
          style={{
            display: "inline-flex",
            maxWidth: "100%",
            background: "#F1F1F8",
            padding: "5px",
            borderRadius: "32px",
            border: "1px solid var(--line, #E2E2EC)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "4px",
          }}
        >
          <button
            id="gallery-tab-ecommerce"
            type="button"
            role="tab"
            aria-selected={activeMode === "ecommerce"}
            aria-controls="gallery-panel-templates"
            tabIndex={activeMode === "ecommerce" ? 0 : -1}
            onClick={() => handleModeSwitch("ecommerce")}
            style={{
              padding: "8px clamp(12px, 3vw, 22px)",
              borderRadius: "28px",
              background: activeMode === "ecommerce" ? "#FFFFFF" : "transparent",
              color: activeMode === "ecommerce" ? "var(--ink, #101828)" : "#667085",
              fontWeight: 700,
              fontSize: "clamp(13px, 2.5vw, 15px)",
              border: "none",
              cursor: "pointer",
              boxShadow: activeMode === "ecommerce" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span aria-hidden="true">🛍️</span> Online Storefronts
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: activeMode === "ecommerce" ? "#EFEFF6" : "#E5E5EE",
                color: "var(--ink, #101828)",
              }}
            >
              {ecomAll.length}
            </span>
          </button>

          <button
            id="gallery-tab-business"
            type="button"
            role="tab"
            aria-selected={activeMode === "business"}
            aria-controls="gallery-panel-templates"
            tabIndex={activeMode === "business" ? 0 : -1}
            onClick={() => handleModeSwitch("business")}
            style={{
              padding: "8px clamp(12px, 3vw, 22px)",
              borderRadius: "28px",
              background: activeMode === "business" ? "#FFFFFF" : "transparent",
              color: activeMode === "business" ? "var(--ink, #101828)" : "#667085",
              fontWeight: 700,
              fontSize: "clamp(13px, 2.5vw, 15px)",
              border: "none",
              cursor: "pointer",
              boxShadow: activeMode === "business" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span aria-hidden="true">🏢</span> Business &amp; Services
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "12px",
                background: "#DCFCE7",
                color: "#166534",
              }}
            >
              5 Verticals
            </span>
          </button>
        </div>
      </div>

      {/* Mode Description Bar */}
      <div
        style={{
          textAlign: "center",
          maxWidth: "680px",
          margin: "0 auto 28px",
          fontSize: "14.5px",
          color: "var(--ink-2, #475467)",
          lineHeight: 1.5,
        }}
      >
        {activeMode === "ecommerce" ? (
          <span>
            Complete retail storefronts featuring product catalogs, variant selectors, bKash &amp; COD checkouts, and courier integration.
          </span>
        ) : (
          <span>
            Specialized business websites featuring <strong>digital QR table menus</strong>, <strong>doctor chamber schedules</strong>, <strong>corporate profiles</strong>, and <strong>booking request forms</strong>.
          </span>
        )}
      </div>

      {/* Category Filter Pills Bar */}
      <div
        style={{
          borderTop: "1px solid var(--line, #E2E2EC)",
          borderBottom: "1px solid var(--line, #E2E2EC)",
          background: "#FFFFFF",
          padding: "14px 0",
          marginBottom: "36px",
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
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  background: isActive ? "var(--ink, #101828)" : "#FFFFFF",
                  color: isActive ? "#FFFFFF" : "var(--ink-2, #475467)",
                  border: isActive ? "1px solid var(--ink, #101828)" : "1px solid #D5D5E4",
                  fontSize: 13.5,
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
                    opacity: isActive ? 0.85 : 0.65,
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
          <div style={{ fontSize: 13.5, color: "var(--ink-2, #475467)" }}>
            Showing: <strong style={{ color: "var(--ink, #101828)" }}>{filtered.length} designs</strong>
          </div>
        </div>
      </div>

      {/* Templates Grid Container */}
      <div
        role="tabpanel"
        id="gallery-panel-templates"
        aria-labelledby={activeMode === "ecommerce" ? "gallery-tab-ecommerce" : "gallery-tab-business"}
        tabIndex={0}
        style={{ outline: "none" }}
      >
        <div
          className="grid g3"
          style={{ gap: "32px 24px" }}
          data-testid="templates"
        >
        {filtered.map((t) => {
          const host = THEME_HOSTS[t.id] ?? t.id;
          const demoStoreUrl = demoUrl(host);
          const startUrl = getStartUrl(t);

          return (
            <div
              key={t.id}
              className="card tpl"
              data-testid={`theme-${t.id}`}
              style={{
                borderRadius: 16,
                padding: 18,
                border: "1px solid var(--line, #E2E2EC)",
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
              }}
            >
              {/* Preview Frame */}
              <div
                className="tpl-shot"
                style={{
                  height: 220,
                  borderRadius: 12,
                  overflow: "hidden",
                  position: "relative",
                  background: t.colors?.background ?? "var(--soft, #F8FAFC)",
                  border: "1px solid var(--line, #E2E2EC)",
                }}
              >
                {t.uploaded && t.previewDesktop ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- staff-uploaded preview on an external https host */}
                    <img src={t.previewDesktop} alt={`${t.name} template home page`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                    {t.previewMobile && (
                      <div style={{ position: "absolute", right: 12, bottom: -8, width: "28%", height: "75%", borderRadius: 10, overflow: "hidden", border: "2px solid #FFFFFF", boxShadow: "0 6px 16px rgba(26, 26, 78, 0.2)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={t.previewMobile} alt={`${t.name} mobile preview`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                      </div>
                    )}
                  </>
                ) : t.colors ? (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: t.colors.background,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: 20,
                      color: t.colors.text,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: t.colors.accent }}>
                          {t.categoryLabel}
                        </span>
                        <h4 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 0", color: t.colors.text }}>
                          {t.name}
                        </h4>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 99,
                          background: t.colors.accent,
                          color: "#FFFFFF",
                        }}
                      >
                        Live Demo
                      </span>
                    </div>

                    {t.previewFeatures && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {t.previewFeatures.slice(0, 3).map((feat, fIdx) => (
                          <div key={fIdx} style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 6, opacity: 0.9 }}>
                            <span style={{ color: t.colors?.accent, fontWeight: 800 }}>✓</span>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 10 }}>
                      <span style={{ fontSize: 11, opacity: 0.7, fontFamily: "monospace" }}>
                        {host}.biztrack.me
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.colors.accent }}>
                        Preview →
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {/* Title and Description */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "var(--ink, #101828)" }}>
                    {t.name}
                  </h3>
                  {t.mode === "business" && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "10px",
                        background: "#ECFDF5",
                        color: "#047857",
                      }}
                    >
                      {t.categoryLabel}
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "var(--ink-2, #475467)",
                    lineHeight: 1.5,
                    marginTop: 6,
                    minHeight: 42,
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
                    color: "var(--ink-2, #475467)",
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
                    color: "var(--ink-2, #475467)",
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
                    background: t.mode === "business" ? "#ECFDF5" : "var(--tint, #F5F3FF)",
                    color: t.mode === "business" ? "#047857" : "var(--brand, #5B4FE8)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {t.module}
                </span>
              </div>

              {/* Action Buttons: Live Demo Modal Preview + Start with Template */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: "auto",
                  paddingTop: 12,
                  borderTop: "1px solid var(--line, #E2E2EC)",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    triggerButtonRef.current = e.currentTarget;
                    setPreviewTemplate(t);
                    setViewportMode("desktop");
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, minHeight: 40, borderRadius: 20, cursor: "pointer" }}
                  data-testid={`demo-${t.id}`}
                >
                  <span aria-hidden="true">👁️</span> Preview
                </button>
                <Link
                  href={startUrl}
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
      </div>

      {/* Interactive Responsive Viewport Modal Previewer */}
      {previewTemplate && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-preview-dialog-title"
          tabIndex={-1}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            flexDirection: "column",
            outline: "none",
          }}
        >
          {/* Top Modal Navigation Bar */}
          <div
            style={{
              height: 56,
              background: "#0F172A",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 20px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            {/* Left: Template Identity */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span id="template-preview-dialog-title" style={{ fontWeight: 800, fontSize: 16 }}>
                {previewTemplate.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: previewTemplate.mode === "business" ? "#059669" : "#2563EB",
                  color: "#FFFFFF",
                }}
              >
                {previewTemplate.categoryLabel}
              </span>
            </div>

            {/* Center: Responsive Viewport Switcher */}
            <div
              role="group"
              aria-label="Responsive preview viewport"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "#1E293B",
                padding: "3px 4px",
                borderRadius: 8,
              }}
            >
              <button
                type="button"
                aria-pressed={viewportMode === "desktop"}
                onClick={() => setViewportMode("desktop")}
                style={{
                  background: viewportMode === "desktop" ? "#334155" : "transparent",
                  color: viewportMode === "desktop" ? "#FFFFFF" : "#94A3B8",
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span aria-hidden="true">🖥️</span> Desktop
              </button>
              <button
                type="button"
                aria-pressed={viewportMode === "tablet"}
                onClick={() => setViewportMode("tablet")}
                style={{
                  background: viewportMode === "tablet" ? "#334155" : "transparent",
                  color: viewportMode === "tablet" ? "#FFFFFF" : "#94A3B8",
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span aria-hidden="true">📱</span> Tablet (768px)
              </button>
              <button
                type="button"
                aria-pressed={viewportMode === "mobile"}
                onClick={() => setViewportMode("mobile")}
                style={{
                  background: viewportMode === "mobile" ? "#334155" : "transparent",
                  color: viewportMode === "mobile" ? "#FFFFFF" : "#94A3B8",
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span aria-hidden="true">📱</span> Mobile (375px)
              </button>
            </div>

            {/* Right: Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {!previewTemplate.uploaded && <a
                href={demoUrl(THEME_HOSTS[previewTemplate.id] ?? previewTemplate.id)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#94A3B8",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "none",
                }}
              >
                Open in new tab ↗
              </a>}

              <Link
                href={getStartUrl(previewTemplate)}
                style={{
                  background: "var(--brand, #5B4FE8)",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "6px 16px",
                  borderRadius: 8,
                  textDecoration: "none",
                }}
              >
                Start with this template →
              </Link>

              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  fontSize: 20,
                  cursor: "pointer",
                  padding: "2px 6px",
                  lineHeight: 1,
                }}
                aria-label={`Close ${previewTemplate.name} preview`}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Center: Live Responsive Iframe Container */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: viewportMode === "desktop" ? "0" : "20px",
              background: "#090D16",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width:
                  viewportMode === "desktop"
                    ? "100%"
                    : viewportMode === "tablet"
                    ? "768px"
                    : "375px",
                height: viewportMode === "desktop" ? "100%" : "calc(100vh - 120px)",
                maxHeight: viewportMode === "desktop" ? "100%" : "812px",
                background: "#FFFFFF",
                borderRadius: viewportMode === "desktop" ? 0 : 16,
                overflow: "hidden",
                boxShadow: viewportMode === "desktop" ? "none" : "0 25px 50px -12px rgba(0,0,0,0.5)",
                border: viewportMode === "desktop" ? "none" : "4px solid #1E293B",
                transition: "width 0.25s ease, height 0.25s ease",
              }}
            >
              {previewTemplate.uploaded ? (
                // eslint-disable-next-line @next/next/no-img-element -- staff-uploaded preview on an external https host
                <img
                  src={(viewportMode === "mobile" ? previewTemplate.previewMobile : previewTemplate.previewDesktop) ?? previewTemplate.previewDesktop ?? previewTemplate.previewMobile ?? ""}
                  alt={`${previewTemplate.name} preview`}
                  style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "top", background: "#F8FAFC" }}
                />
              ) : (
              <iframe
                src={demoUrl(THEME_HOSTS[previewTemplate.id] ?? previewTemplate.id)}
                title={`${previewTemplate.name} live demo`}
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
              />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
