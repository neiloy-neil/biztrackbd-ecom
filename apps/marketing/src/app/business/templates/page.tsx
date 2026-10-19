import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedTemplates } from "@biztrackbd/core";
import { TemplateGallery } from "@/components/template-gallery";
import { splitPublishedTemplates } from "@/lib/published-gallery";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Business Website Templates for Clinics, Dining, Corporate & Leaders",
  description:
    "Explore 6 verified business website templates for Bangladeshi restaurants, medical clinics, consulting firms, home services, portfolios, and public figures with lead capture and booking.",
  keywords: [
    "business website templates bangladesh",
    "doctor clinic website template",
    "restaurant qr menu website template bd",
    "corporate website template dhaka",
    "portfolio website template",
    "public figure personal branding template",
    "ওয়েবসাইট টেমপ্লেট বাংলাদেশ",
  ],
  alternates: {
    canonical: `${siteUrl}/business/templates`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/business/templates`,
    siteName: "BizTrackBD",
    title: "Business Website Templates for Clinics, Dining, Corporate & Leaders",
    description:
      "6 conversion-ready website templates for Bangladeshi service businesses, doctors, dining, and public figures.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD Business Templates" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Business Website Templates for Clinics, Dining, Corporate & Leaders",
    description: "6 purpose-built business website templates for Bangladesh with 0% commission.",
    images: [`${siteUrl}/opengraph-image`],
  },
};


const VERTICAL_SHORTCUTS = [
  { label: "Restaurants & Cafés", href: "/business/restaurant-websites", icon: "🍽️" },
  { label: "Doctors & Clinics", href: "/business/doctor-websites", icon: "🩺" },
  { label: "Corporate & B2B", href: "/business/company-website", icon: "🏢" },
  { label: "Home & Tech Services", href: "/business/service-websites", icon: "🔧" },
  { label: "Portfolios & Freelancers", href: "/business/portfolio-websites", icon: "💼" },
  { label: "Public Figures & Leaders", href: "/business/public-profile-websites", icon: "🎙️" },
];

export default async function BusinessTemplatesPage() {
  const published = await listPublishedTemplates().catch(() => []);
  const { extra, businessExtra, hidden } = splitPublishedTemplates(published);

  return (
    <section className="block" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div className="wrap">
        {/* Breadcrumb Hierarchy */}
        <nav
          aria-label="Breadcrumbs"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--ink-3, #667085)",
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <Link href="/" style={{ color: "var(--ink-2, #475467)", textDecoration: "none" }}>
            Home
          </Link>
          <span aria-hidden="true">›</span>
          <Link href="/business" style={{ color: "var(--ink-2, #475467)", textDecoration: "none" }}>
            BizTrackBD Business
          </Link>
          <span aria-hidden="true">›</span>
          <span style={{ color: "var(--ink, #101828)", fontWeight: 600 }}>Templates</span>
        </nav>

        {/* Page Header */}
        <div style={{ maxWidth: 840 }}>
          <span className="eyebrow" style={{ display: "inline-block", marginBottom: 12 }}>
            BizTrackBD Business · Template Directory
          </span>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              letterSpacing: "-1.2px",
              lineHeight: 1.15,
              fontWeight: 800,
              color: "var(--ink, #101828)",
              margin: 0,
            }}
          >
            Business &amp; Professional Website Templates
          </h1>
          <p
            className="lead"
            style={{
              marginTop: 16,
              fontSize: "clamp(16px, 2.5vw, 19px)",
              color: "var(--ink-2, #475467)",
              lineHeight: 1.6,
            }}
          >
            Handcrafted, mobile-first designs engineered specifically for Bangladeshi service enterprises, dining establishments, medical clinics, consulting firms, and public leaders. Complete with digital QR menus, multi-chamber appointment scheduling, WhatsApp inquiry routing, and custom domain configuration.
          </p>

          <div
            style={{
              marginTop: 20,
              padding: "14px 18px",
              borderRadius: "12px",
              background: "#F4F5FB",
              border: "1px solid var(--line, #E2E2EC)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 14.5, color: "var(--ink, #101828)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--accent, #3B5BFD)" }}>Want to test lead and booking management?</strong>{" "}
              Try our admin workspace with realistic Bangladeshi demo bookings, private notes, and status workflows.
            </div>
            <a
              href={demoAdminUrl()}
              className="btn btn-secondary"
              data-testid="business-templates-demo-admin"
              style={{
                fontSize: 13.5,
                padding: "8px 16px",
                whiteSpace: "nowrap",
                fontWeight: 600,
              }}
            >
              Open Admin Demo (No Signup) →
            </a>
          </div>
        </div>

        {/* Vertical Shortcuts Bar */}
        <div style={{ marginTop: 32, marginBottom: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3, #667085)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>
            Explore Vertical Deep-Dives
          </p>
          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              paddingBottom: 8,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {VERTICAL_SHORTCUTS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  borderRadius: 20,
                  background: "#FFFFFF",
                  border: "1px solid var(--line, #E2E2EC)",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--ink, #101828)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Template Gallery Initialized in Business Mode */}
        <TemplateGallery extra={extra} businessExtra={businessExtra} hidden={hidden} initialMode="business" />

        {/* Cross-Link Banner to eCommerce Storefronts & Hybrid */}
        <div
          style={{
            marginTop: 64,
            padding: "32px 28px",
            borderRadius: 16,
            background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 24,
            boxShadow: "0 10px 30px rgba(30, 27, 75, 0.15)",
          }}
        >
          <div style={{ maxWidth: 640 }}>
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 20,
                background: "rgba(255,255,255,0.15)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Looking to Sell Physical Products?
            </span>
            <h3 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, margin: "0 0 8px", color: "#FFFFFF" }}>
              Explore Online Storefront Templates with bKash Checkout
            </h3>
            <p style={{ margin: 0, fontSize: 15, color: "#C7D2FE", lineHeight: 1.6 }}>
              Need multi-product catalogs, size presets, Steadfast and Pathao courier shipping, and Cash on Delivery return protection? Browse our dedicated eCommerce templates or choose Hybrid mode for both retail and bookings.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/templates"
              className="btn"
              style={{
                background: "#FFFFFF",
                color: "#1E1B4B",
                fontWeight: 700,
                fontSize: 14,
                padding: "10px 20px",
                borderRadius: 8,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Browse eCommerce Storefronts →
            </Link>
            <Link
              href="/product"
              style={{
                background: "transparent",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: 14,
                padding: "10px 18px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.3)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Compare Engines &amp; Modes
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
