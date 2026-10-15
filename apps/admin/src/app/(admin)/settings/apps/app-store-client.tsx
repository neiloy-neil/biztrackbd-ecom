"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { AppCategory, AppStoreItemView, AppStoreOverview, IntegrationView } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import {
  removeIntegrationAction,
  saveCourierAction,
  saveLoyaltyAction,
  savePaymentGatewayAction,
  saveSmsGatewayAction,
  saveTrackingPixelsAction,
  saveWhatsAppWidgetAction,
  setModuleAction,
  testCourierAction,
} from "./actions";

interface StoreSettingsData {
  whatsappNumber?: string | null;
  metaPixelId?: string | null;
  googleAnalyticsId?: string | null;
  googleTagManagerId?: string | null;
  tiktokPixelId?: string | null;
  metaDomainVerification?: string | null;
  googleSiteVerification?: string | null;
  googleOAuthClientId?: string | null;
  googleOAuthClientSecret?: string | null;
  googleMerchantCenterId?: string | null;
  loyaltyEnabled?: boolean;
  loyaltySpendPerPoint?: number;
  loyaltyPointsPerBlock?: number;
  loyaltyBdtPerBlock?: number;
  loyaltyMaxCartPercent?: number;
  referralEnabled?: boolean;
  refereeDiscountBdt?: number;
  refereeMinCartBdt?: number;
  referrerRewardPoints?: number;
  vipSilverMin?: number;
  vipGoldMin?: number;
  vipPlatinumMin?: number;
  vipGoldDiscount?: number;
  vipPlatinumDiscount?: number;
  loyaltyExpiryMonths?: number;
  birthdayVoucherBdt?: number;
}

interface Props {
  overview: AppStoreOverview;
  canEdit: boolean;
  storeSettings?: StoreSettingsData | null;
  integrations: IntegrationView[];
  webhookTokens: Record<string, string>;
  origin: string;
  storefrontOrigin?: string;
  storeSubdomain: string;
  initialOpen?: string;
}

const CATEGORIES: { key: AppCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "All Apps" },
  { key: "MARKETING", label: "Marketing & Tracking" },
  { key: "COURIERS", label: "Couriers & Logistics" },
  { key: "GROWTH", label: "Growth & Loyalty" },
  { key: "AUTOMATION", label: "Automation & Protection" },
  { key: "COMMERCE", label: "Commerce & Payments" },
];

function AppIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "meta":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#0668E1" />
          <path d="M16.5 8C14.7 8 13.3 9.1 12 10.8C10.7 9.1 9.3 8 7.5 8C4.5 8 2.5 10.4 2.5 13.5C2.5 16.6 4.7 19 7.5 19C9.3 19 10.7 17.9 12 16.2C13.3 17.9 14.7 19 16.5 19C19.3 19 21.5 16.6 21.5 13.5C21.5 10.4 19.5 8 16.5 8ZM7.5 16.8C5.7 16.8 4.3 15.3 4.3 13.5C4.3 11.7 5.7 10.2 7.5 10.2C8.9 10.2 10.1 11.2 11.1 12.8C10.1 14.8 8.9 16.8 7.5 16.8ZM16.5 16.8C15.1 16.8 13.9 14.8 12.9 12.8C13.9 11.2 15.1 10.2 16.5 10.2C18.3 10.2 19.7 11.7 19.7 13.5C19.7 15.3 18.3 16.8 16.5 16.8Z" fill="white" />
        </svg>
      );
    case "google":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#EA4335" />
          <path d="M12 5C8.1 5 5 8.1 5 12C5 15.9 8.1 19 12 19C15.5 19 18.4 16.5 18.9 13.2H12V10.8H21.4C21.5 11.2 21.5 11.6 21.5 12C21.5 17.2 17.2 21.5 12 21.5C6.8 21.5 2.5 17.2 2.5 12C2.5 6.8 6.8 2.5 12 2.5C14.5 2.5 16.8 3.5 18.5 5.1L16.7 6.9C15.5 5.7 13.8 5 12 5Z" fill="white" />
        </svg>
      );
    case "tiktok":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#010101" />
          <path d="M16.5 7.5C15.4 7.5 14.4 7 13.7 6.2V13.8C13.7 16.1 11.8 18 9.5 18C7.2 18 5.3 16.1 5.3 13.8C5.3 11.5 7.2 9.6 9.5 9.6C9.9 9.6 10.2 9.7 10.6 9.8V12.1C10.3 12 9.9 11.9 9.5 11.9C8.5 11.9 7.6 12.8 7.6 13.8C7.6 14.8 8.5 15.7 9.5 15.7C10.5 15.7 11.4 14.8 11.4 13.8V4.5H13.7C13.7 5.7 14.7 6.7 15.9 6.7H16.5V7.5Z" fill="#25F4EE" />
        </svg>
      );
    case "truck":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="1" y="3" width="15" height="13" rx="2" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case "pathao":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#E21B22" />
          <path d="M12 6L6 17H18L12 6Z" fill="white" />
        </svg>
      );
    case "redx":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#D32F2F" />
          <path d="M7 7L17 17M17 7L7 17" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "gift":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 12 20 22 4 22 4 12" />
          <rect x="2" y="7" width="20" height="5" />
          <line x1="12" y1="22" x2="12" y2="7" />
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
        </svg>
      );
    case "shield":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#25D366" />
          <path d="M17.5 14.4c-.3-.1-1.6-.8-1.8-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 .1-.2.2-.4.2-.7.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.7.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.8 5.1.8.3 1.4.6 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z" fill="white" />
        </svg>
      );
    case "catalog":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case "credit-card":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      );
    case "tag":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <path d="M7 7h.01" />
        </svg>
      );
    case "layout":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      );
    case "star":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      );
  }
}

export function AppStoreClient({
  overview,
  canEdit,
  storeSettings,
  integrations,
  webhookTokens,
  origin,
  storefrontOrigin,
  storeSubdomain,
  initialOpen,
}: Props) {
  const [category, setCategory] = useState<AppCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(initialOpen ?? null);

  // Modal form states
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Close modal on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveModal(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Filter apps
  const filteredApps = useMemo(() => {
    return overview.apps.filter((app) => {
      const matchCat = category === "ALL" || app.category === category;
      if (!matchCat) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        app.label.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [overview.apps, category, search]);

  const countsByCategory = useMemo(() => {
    const map: Record<string, number> = { ALL: overview.apps.length };
    for (const app of overview.apps) {
      map[app.category] = (map[app.category] ?? 0) + 1;
    }
    return map;
  }, [overview.apps]);

  // Integration records helper
  const getIntegration = (prov: string, mode: "TEST" | "LIVE" = "LIVE") =>
    integrations.find((i) => i.provider === prov && i.mode === mode);

  // Active App item
  const currentApp = useMemo(() => {
    return overview.apps.find((a) => a.key === activeModal);
  }, [overview.apps, activeModal]);

  // Live catalog feed URL points to the storefront (or admin route if storefront not set)
  const liveFeedUrl = `${storefrontOrigin || origin}/api/catalog/facebook`;

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* 1. Header Overview & Ecosystem Status */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          background: "linear-gradient(135deg, var(--card-bg, #fff) 0%, rgba(124, 58, 237, 0.05) 100%)",
          border: "1px solid var(--border, #e5e7eb)",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary, #6366f1)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Unified Ecosystem
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
            {overview.totalActive} Apps & Integrations Active
          </div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
            {overview.allowance == null
              ? "All premium addons unlocked on Business Plan."
              : `${overview.usedAddons} of ${overview.allowance} premium addons active on ${overview.planTier} Plan.`}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/billing" className="btn btn-secondary btn-sm" prefetch={false}>
            Plans & Billing
          </Link>
        </div>
      </div>

      {/* 2. Search & Category Filters */}
      <div className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 280px" }}>
            <input
              type="search"
              className="input"
              placeholder="Search apps by name, courier, or keyword (e.g. Facebook, Steadfast, Loyalty, WhatsApp)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search apps"
              style={{ width: "100%" }}
            />
          </div>
          {search && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearch("")}>
              Clear
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="chips" style={{ overflowX: "auto", paddingBottom: 4 }}>
          {CATEGORIES.map((c) => {
            const count = countsByCategory[c.key] ?? 0;
            const active = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                className={`chip ${active ? "active" : ""}`}
                onClick={() => setCategory(c.key)}
                style={{
                  cursor: "pointer",
                  fontWeight: active ? 700 : 500,
                  background: active ? "var(--primary, #6366f1)" : undefined,
                  color: active ? "#fff" : undefined,
                }}
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Apps Grid */}
      {filteredApps.length === 0 ? (
        <div className="card text-center" style={{ padding: "40px 20px" }}>
          <p className="muted">No apps found matching &quot;{search}&quot; in this category.</p>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => { setSearch(""); setCategory("ALL"); }}>
            View all apps
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
          data-testid="apps-grid"
        >
          {filteredApps.map((app) => {
            const isInstalled = app.status === "ACTIVE";
            const needsSetup = app.status === "NEEDS_SETUP";
            const isLocked = app.status === "LOCKED";
            const isComingSoon = app.status === "COMING_SOON";

            return (
              <div
                key={app.key}
                className="card"
                data-testid={`app-card-${app.key}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: 18,
                  border: isInstalled ? "1px solid rgba(16, 185, 129, 0.4)" : undefined,
                  background: isInstalled ? "rgba(16, 185, 129, 0.015)" : undefined,
                }}
              >
                <div>
                  {/* Top Bar: Icon + Title + Status */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--bg-subtle, #f3f4f6)",
                          border: "1px solid var(--border, #e5e7eb)",
                          flexShrink: 0,
                        }}
                      >
                        <AppIcon icon={app.icon} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setFormMsg(null);
                              setTestResult(null);
                              setActiveModal(app.key);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              font: "inherit",
                              fontWeight: 700,
                              color: "inherit",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            {app.label}
                          </button>
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                          {app.categoryLabel}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {isInstalled && <span className="pill ok">Active</span>}
                      {needsSetup && <span className="pill warn">Setup Needed</span>}
                      {isLocked && <span className="pill bad">Plan Lock</span>}
                      {app.status === "AVAILABLE" && <span className="pill info">Available</span>}
                      {isComingSoon && <span className="pill grey">Coming Soon</span>}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="muted" style={{ fontSize: 13, margin: "14px 0 12px", lineHeight: 1.45 }}>
                    {app.description}
                  </p>

                  {/* Badge & Tier */}
                  <div className="row" style={{ gap: 6, marginBottom: 16 }}>
                    {app.badge && (
                      <span className="pill grey" style={{ fontSize: 11, fontWeight: 600 }}>
                        {app.badge}
                      </span>
                    )}
                    <span
                      className="pill grey"
                      style={{
                        fontSize: 11,
                        background: app.tier === "INCLUDED" ? "rgba(16, 185, 129, 0.1)" : "rgba(124, 58, 237, 0.1)",
                        color: app.tier === "INCLUDED" ? "#059669" : "#7C3AED",
                      }}
                    >
                      {app.tierLabel}
                    </span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div
                  style={{
                    borderTop: "1px solid var(--border, #e5e7eb)",
                    paddingTop: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Link href={`/settings/apps/${app.key}`} className="link" prefetch={false} style={{ fontSize: 13, fontWeight: 600 }}>
                    Details & Docs →
                  </Link>

                  <div className="row" style={{ gap: 8 }}>
                    {/* Toggle form for plan addon and toggleable modules */}
                    {(app.tier === "ADDON" || app.key === "customer_returns" || app.key === "product_reviews") && app.built && canEdit && !isLocked && (
                      <form action={setModuleAction.bind(null, app.key, !app.enabled)}>
                        <SubmitButton className="btn btn-secondary btn-sm" pending="…">
                          {app.enabled ? "Turn Off" : "Turn On"}
                        </SubmitButton>
                      </form>
                    )}

                    {isLocked ? (
                      <Link href="/billing" className="btn btn-secondary btn-sm" prefetch={false}>
                        Upgrade
                      </Link>
                    ) : app.built ? (
                      app.configureHref && !app.configureHref.startsWith("/settings/apps") ? (
                        <Link
                          href={app.configureHref}
                          className="btn btn-primary btn-sm"
                          prefetch={false}
                        >
                          {isInstalled ? "Configure →" : "Set Up →"}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setFormMsg(null);
                            setTestResult(null);
                            setActiveModal(app.key);
                          }}
                        >
                          {isInstalled ? "Configure" : "Set Up"}
                        </button>
                      )
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>
                        Soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL OVERLAY SYSTEM */}
      {activeModal && currentApp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 640,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              border: "1px solid var(--border, #e5e7eb)",
              padding: 0,
              position: "relative",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border, #e5e7eb)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--bg-subtle, #f9fafb)",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#fff",
                    border: "1px solid var(--border, #e5e7eb)",
                    flexShrink: 0,
                  }}
                >
                  <AppIcon icon={currentApp.icon} />
                </div>
                <div>
                  <h2 id="modal-title" style={{ fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                    {currentApp.label}
                  </h2>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {currentApp.categoryLabel}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveModal(null)}
                aria-label="Close dialog"
                style={{ padding: "4px 10px", fontSize: 15 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: "24px" }} className="stack">
              {formMsg?.ok && (
                <div className="notice good" role="status" style={{ marginBottom: 16 }}>
                  Configuration saved successfully.
                </div>
              )}
              {formMsg?.error && (
                <div className="notice bad" role="alert" style={{ marginBottom: 16 }}>
                  {formMsg.error}
                </div>
              )}
              {testResult && (
                <div className={`notice ${testResult.ok ? "good" : "bad"}`} style={{ marginBottom: 16 }}>
                  {testResult.ok ? "✓ Connection test successful! Keys verified." : `✕ Connection test failed: ${testResult.error}`}
                </div>
              )}

              {/* SPECIFIC APP MODAL BODIES */}

              {/* 1. FACEBOOK CATALOG */}
              {activeModal === "facebook_catalog" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Your store generates an automated live XML/RSS catalog product feed in official Meta Commerce format. Use this feed for Facebook Dynamic Product Ads (DPA) and Instagram Shopping.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Live Product Feed URL
                    </label>
                    <div className="row" style={{ marginTop: 6, gap: 8 }}>
                      <input
                        type="text"
                        readOnly
                        value={liveFeedUrl}
                        className="input"
                        style={{ flex: 1, fontFamily: "monospace", fontSize: 13, background: "#fff" }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(liveFeedUrl);
                          setCopiedFeed(true);
                          setTimeout(() => setCopiedFeed(false), 2500);
                        }}
                      >
                        {copiedFeed ? "Copied! ✓" : "Copy URL"}
                      </button>
                      <a
                        href={liveFeedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                      >
                        Verify XML ↗
                      </a>
                    </div>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(6, 104, 225, 0.2)", background: "rgba(6, 104, 225, 0.03)" }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#0668E1" }}>
                      Meta Commerce Manager Setup Guide:
                    </h4>
                    <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li>Open <b>Meta Commerce Manager</b> and select your Catalog.</li>
                      <li>Go to <b>Catalog &gt; Data Sources</b> and click <b>Add Products</b>.</li>
                      <li>Select <b>Data Feed (Scheduled Feed)</b> and set update frequency to <b>Hourly or Daily</b>.</li>
                      <li>Paste the copied live feed URL above into the feed address field and click <b>Save</b>.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* 2. STEADFAST COURIER */}
              {activeModal === "steadfast_courier" && (() => {
                const row = getIntegration("STEADFAST", "LIVE");
                const webhookUrl = webhookTokens.STEADFAST ? `${origin}/api/webhooks/courier/${webhookTokens.STEADFAST}` : null;

                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        const res = await saveCourierAction("STEADFAST", "LIVE", {
                          apiKey: String(fd.get("apiKey") ?? ""),
                          secretKey: String(fd.get("secretKey") ?? ""),
                          baseUrl: String(fd.get("baseUrl") ?? ""),
                        });
                        setFormMsg(res);
                      });
                    }}
                    className="stack"
                    style={{ gap: 14 }}
                  >
                    <p style={{ fontSize: 13.5 }}>
                      Connect your Steadfast / Packzy account for 1-click order booking, real-time balance inquiries, and cross-merchant fraud rate checks.
                    </p>

                    <div>
                      <label className="label">API Key</label>
                      <input
                        type="text"
                        name="apiKey"
                        placeholder={row?.secretsSet?.apiKey ? "•••••••••••• (Leave blank to keep saved)" : "Enter Steadfast Api-Key"}
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <label className="label">Secret Key</label>
                      <input
                        type="password"
                        name="secretKey"
                        placeholder={row?.secretsSet?.secretKey ? "•••••••••••• (Leave blank to keep saved)" : "Enter Steadfast Secret-Key"}
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <label className="label">API Base URL (Optional)</label>
                      <input
                        type="text"
                        name="baseUrl"
                        defaultValue={row?.config?.baseUrl ?? "https://portal.packzy.com/api/v1"}
                        className="input"
                        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
                      />
                      <span className="muted" style={{ fontSize: 12 }}>
                        Default: https://portal.packzy.com/api/v1
                      </span>
                    </div>

                    {webhookUrl && (
                      <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 12 }}>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Steadfast Webhook URL</label>
                        <div className="row" style={{ marginTop: 4, gap: 8 }}>
                          <input
                            type="text"
                            readOnly
                            value={webhookUrl}
                            className="input"
                            style={{ flex: 1, fontFamily: "monospace", fontSize: 12, background: "#fff" }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(webhookUrl);
                              setCopiedWebhook(true);
                              setTimeout(() => setCopiedWebhook(false), 2500);
                            }}
                          >
                            {copiedWebhook ? "Copied! ✓" : "Copy"}
                          </button>
                        </div>
                        <span className="muted" style={{ fontSize: 11.5, marginTop: 4, display: "block" }}>
                          Paste this in your Steadfast merchant portal under API Webhook settings.
                        </span>
                      </div>
                    )}

                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={isPending || !row?.secretsSet?.apiKey}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await testCourierAction("STEADFAST", "LIVE");
                            setTestResult(res);
                          });
                        }}
                      >
                        {isPending ? "Testing…" : "Test Connection"}
                      </button>

                      <button type="submit" className="btn btn-primary" disabled={isPending}>
                        {isPending ? "Saving…" : "Save Steadfast Keys"}
                      </button>
                    </div>
                  </form>
                );
              })()}

              {/* 3. PATHAO COURIER */}
              {activeModal === "pathao_courier" && (() => {
                const row = getIntegration("PATHAO", "LIVE");
                const webhookUrl = webhookTokens.PATHAO ? `${origin}/api/webhooks/courier/${webhookTokens.PATHAO}` : null;

                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        const res = await saveCourierAction("PATHAO", "LIVE", {
                          clientId: String(fd.get("clientId") ?? ""),
                          clientSecret: String(fd.get("clientSecret") ?? ""),
                          username: String(fd.get("username") ?? ""),
                          password: String(fd.get("password") ?? ""),
                          storeId: String(fd.get("storeId") ?? ""),
                          baseUrl: String(fd.get("baseUrl") ?? ""),
                        });
                        setFormMsg(res);
                      });
                    }}
                    className="stack"
                    style={{ gap: 14 }}
                  >
                    <p style={{ fontSize: 13.5 }}>
                      Official Pathao Hermes API integration. Automates parcel creation, city/zone routing, and dynamic rate estimates.
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label className="label">Client ID</label>
                        <input
                          type="text"
                          name="clientId"
                          placeholder={row?.secretsSet?.clientId ? "•••••• (Saved)" : "Pathao Client ID"}
                          className="input"
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div>
                        <label className="label">Client Secret</label>
                        <input
                          type="password"
                          name="clientSecret"
                          placeholder={row?.secretsSet?.clientSecret ? "•••••• (Saved)" : "Pathao Client Secret"}
                          className="input"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label className="label">Username (Email)</label>
                        <input
                          type="text"
                          name="username"
                          placeholder={row?.secretsSet?.username ? "•••••• (Saved)" : "merchant@pathao.com"}
                          className="input"
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div>
                        <label className="label">Password</label>
                        <input
                          type="password"
                          name="password"
                          placeholder={row?.secretsSet?.password ? "•••••• (Saved)" : "Password"}
                          className="input"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">Pickup Store ID</label>
                      <input
                        type="text"
                        name="storeId"
                        defaultValue={row?.config?.storeId ?? ""}
                        placeholder="Pathao store ID (e.g. 12345)"
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    {webhookUrl && (
                      <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 12 }}>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Pathao Webhook URL</label>
                        <div className="row" style={{ marginTop: 4, gap: 8 }}>
                          <input
                            type="text"
                            readOnly
                            value={webhookUrl}
                            className="input"
                            style={{ flex: 1, fontFamily: "monospace", fontSize: 12, background: "#fff" }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(webhookUrl);
                              setCopiedWebhook(true);
                              setTimeout(() => setCopiedWebhook(false), 2500);
                            }}
                          >
                            {copiedWebhook ? "Copied! ✓" : "Copy"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={isPending || !row?.secretsSet?.clientId}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await testCourierAction("PATHAO", "LIVE");
                            setTestResult(res);
                          });
                        }}
                      >
                        {isPending ? "Testing…" : "Test Connection"}
                      </button>

                      <button type="submit" className="btn btn-primary" disabled={isPending}>
                        {isPending ? "Saving…" : "Save Pathao Keys"}
                      </button>
                    </div>
                  </form>
                );
              })()}

              {/* 4. REDX COURIER */}
              {activeModal === "redx_courier" && (() => {
                const row = getIntegration("REDX", "LIVE");

                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        const res = await saveCourierAction("REDX", "LIVE", {
                          accessToken: String(fd.get("accessToken") ?? ""),
                          pickupStoreId: String(fd.get("pickupStoreId") ?? ""),
                          baseUrl: String(fd.get("baseUrl") ?? ""),
                        });
                        setFormMsg(res);
                      });
                    }}
                    className="stack"
                    style={{ gap: 14 }}
                  >
                    <p style={{ fontSize: 13.5 }}>
                      RedX OpenAPI integration for parcel creation, tracking, and pickup store synchronization.
                    </p>

                    <div>
                      <label className="label">API Access Token</label>
                      <input
                        type="password"
                        name="accessToken"
                        placeholder={row?.secretsSet?.accessToken ? "•••••••••••• (Leave blank to keep saved)" : "Enter RedX API Token"}
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <label className="label">Pickup Store ID (Optional)</label>
                      <input
                        type="text"
                        name="pickupStoreId"
                        defaultValue={row?.config?.pickupStoreId ?? ""}
                        placeholder="e.g. 123"
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={isPending || !row?.secretsSet?.accessToken}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await testCourierAction("REDX", "LIVE");
                            setTestResult(res);
                          });
                        }}
                      >
                        {isPending ? "Testing…" : "Test Connection"}
                      </button>

                      <button type="submit" className="btn btn-primary" disabled={isPending}>
                        {isPending ? "Saving…" : "Save RedX Keys"}
                      </button>
                    </div>
                  </form>
                );
              })()}

              {/* 5. META PIXEL & CAPI */}
              {activeModal === "meta_pixel_capi" && (() => {
                const capi = getIntegration("META_CAPI", "LIVE");

                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        const res = await saveTrackingPixelsAction({
                          metaPixelId: String(fd.get("metaPixelId") ?? ""),
                          capiAccessToken: String(fd.get("capiAccessToken") ?? ""),
                          metaDomainVerification: String(fd.get("metaDomainVerification") ?? ""),
                        });
                        setFormMsg(res);
                      });
                    }}
                    className="stack"
                    style={{ gap: 14 }}
                  >
                    <div className="notice info" style={{ fontSize: 13 }}>
                      <b>Direct Key Setup:</b> No Facebook App approval or Meta Business Verification required. Enter your Pixel ID and Access Token directly.
                    </div>

                    <div>
                      <label className="label">Meta Pixel ID</label>
                      <input
                        type="text"
                        name="metaPixelId"
                        defaultValue={storeSettings?.metaPixelId ?? ""}
                        placeholder="e.g. 123456789012345"
                        className="input"
                        style={{ width: "100%" }}
                      />
                      <span className="muted" style={{ fontSize: 12 }}>
                        Find this in Meta Events Manager &gt; Data Sources.
                      </span>
                    </div>

                    <div>
                      <label className="label">Conversions API (CAPI) Access Token</label>
                      <input
                        type="password"
                        name="capiAccessToken"
                        placeholder={capi?.secretsSet?.accessToken ? "•••••••••••• (Leave blank to keep saved)" : "EAAB..."}
                        className="input"
                        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
                      />
                      <span className="muted" style={{ fontSize: 12 }}>
                        In Meta Events Manager &gt; Settings &gt; Set up directly &gt; Generate access token.
                      </span>
                    </div>

                    <div>
                      <label className="label">Meta Domain Verification Meta-Tag (Optional)</label>
                      <input
                        type="text"
                        name="metaDomainVerification"
                        defaultValue={storeSettings?.metaDomainVerification ?? ""}
                        placeholder="e.g. abcdef0123456789"
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <button type="submit" className="btn btn-primary" disabled={isPending} style={{ width: "100%" }}>
                        {isPending ? "Saving…" : "Save Meta Pixel & CAPI Settings"}
                      </button>
                    </div>
                  </form>
                );
              })()}

              {/* 6. GOOGLE CLOUD SUITE, ANALYTICS & TAG MANAGER */}
              {activeModal === "google_analytics" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    startTransition(async () => {
                      const res = await saveTrackingPixelsAction({
                        googleAnalyticsId: String(fd.get("googleAnalyticsId") ?? ""),
                        googleTagManagerId: String(fd.get("googleTagManagerId") ?? ""),
                        googleSiteVerification: String(fd.get("googleSiteVerification") ?? ""),
                        googleMerchantCenterId: String(fd.get("googleMerchantCenterId") ?? ""),
                      });
                      setFormMsg(res);
                    });
                  }}
                  className="stack"
                  style={{ gap: 14 }}
                >
                  <div>
                    <label className="label">Google Analytics 4 Measurement ID</label>
                    <input
                      type="text"
                      name="googleAnalyticsId"
                      defaultValue={storeSettings?.googleAnalyticsId ?? ""}
                      placeholder="e.g. G-XXXXXXXXXX"
                      className="input"
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label className="label">Google Tag Manager Container ID</label>
                    <input
                      type="text"
                      name="googleTagManagerId"
                      defaultValue={storeSettings?.googleTagManagerId ?? ""}
                      placeholder="e.g. GTM-XXXXXXX"
                      className="input"
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label className="label">Google Search Console Verification (Token or Meta Tag)</label>
                    <input
                      type="text"
                      name="googleSiteVerification"
                      defaultValue={storeSettings?.googleSiteVerification ?? ""}
                      placeholder='e.g. abc123xyz or <meta name="google-site-verification" content="..." />'
                      className="input"
                      style={{ width: "100%" }}
                    />
                    <span className="hint" style={{ fontSize: 12, color: "var(--ink-3, #6B6B8D)", marginTop: 4, display: "block" }}>
                      Paste the Google Search Console HTML tag / token here to inject it into your store &lt;head&gt;. If using the HTML file method, your store handles it automatically—just click Verify in Search Console.
                    </span>
                  </div>

                  <div>
                    <label className="label">Google Merchant Center Account ID</label>
                    <input
                      type="text"
                      name="googleMerchantCenterId"
                      defaultValue={storeSettings?.googleMerchantCenterId ?? ""}
                      placeholder="e.g. 539120384"
                      className="input"
                      style={{ width: "100%" }}
                    />
                    <span className="hint" style={{ fontSize: 12, color: "var(--ink-3, #6B6B8D)", marginTop: 4, display: "block" }}>
                      Feed URL: <code>{storefrontOrigin}/api/feed/google.xml</code>
                    </span>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button type="submit" className="btn btn-primary" disabled={isPending} style={{ width: "100%" }}>
                      {isPending ? "Saving…" : "Save Google Suite"}
                    </button>
                  </div>
                </form>
              )}

              {/* 7. TIKTOK PIXEL */}
              {activeModal === "tiktok_pixel" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    startTransition(async () => {
                      const res = await saveTrackingPixelsAction({
                        tiktokPixelId: String(fd.get("tiktokPixelId") ?? ""),
                      });
                      setFormMsg(res);
                    });
                  }}
                  className="stack"
                  style={{ gap: 14 }}
                >
                  <div>
                    <label className="label">TikTok Pixel ID</label>
                    <input
                      type="text"
                      name="tiktokPixelId"
                      defaultValue={storeSettings?.tiktokPixelId ?? ""}
                      placeholder="e.g. CXXXXXXXXXXXXXXX"
                      className="input"
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button type="submit" className="btn btn-primary" disabled={isPending} style={{ width: "100%" }}>
                      {isPending ? "Saving…" : "Save TikTok Pixel"}
                    </button>
                  </div>
                </form>
              )}

              {/* 8. STOREFRONT WHATSAPP FLOATING CHAT WIDGET */}
              {activeModal === "whatsapp_widget" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    startTransition(async () => {
                      const res = await saveWhatsAppWidgetAction({
                        whatsappNumber: String(fd.get("whatsappNumber") ?? ""),
                      });
                      setFormMsg(res);
                    });
                  }}
                  className="stack"
                  style={{ gap: 16 }}
                >
                  <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                    Show a clean floating WhatsApp button in the corner of your storefront. When shoppers click, it instantly opens WhatsApp with your number ready to chat.
                  </p>

                  <div>
                    <label className="label">WhatsApp Mobile Number</label>
                    <input
                      type="text"
                      name="whatsappNumber"
                      defaultValue={storeSettings?.whatsappNumber ?? ""}
                      placeholder="e.g. 01712345678 (Leave blank to hide widget)"
                      className="input"
                      style={{ width: "100%", fontSize: 15 }}
                    />
                    <span className="muted" style={{ fontSize: 12 }}>
                      Supports all Bangladeshi mobile numbers (Grameenphone, Banglalink, Robi, Teletalk).
                    </span>
                  </div>

                  {/* Visual preview */}
                  <div
                    className="card"
                    style={{
                      background: "var(--bg-subtle, #f9fafb)",
                      padding: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Storefront Floating Button Preview</div>
                      <div className="muted" style={{ fontSize: 12 }}>Positioned at bottom right of all store pages.</div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#25D366",
                        color: "#fff",
                        padding: "8px 14px",
                        borderRadius: 9999,
                        fontWeight: 600,
                        fontSize: 13,
                        boxShadow: "0 4px 12px rgba(37, 211, 102, 0.4)",
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 13.85 2.5 15.58 3.39 17.07L2.05 22L7.11 20.68C8.55 21.52 10.22 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.04 16.47C16.83 17.06 15.82 17.61 15.34 17.68C14.86 17.75 14.24 17.77 12.28 16.96C9.77 15.93 8.16 13.38 8.03 13.21C7.91 13.04 7.02 11.86 7.02 10.63C7.02 9.4 7.65 8.8 7.88 8.55C8.11 8.3 8.41 8.24 8.58 8.24C8.75 8.24 8.92 8.24 9.06 8.25C9.21 8.26 9.41 8.2 9.61 8.68C9.82 9.19 10.32 10.42 10.38 10.55C10.44 10.68 10.49 10.84 10.39 11.02C10.3 11.2 10.22 11.3 10.08 11.46C9.94 11.62 9.79 11.81 9.67 11.95C9.53 12.1 9.38 12.26 9.55 12.55C9.72 12.84 10.31 13.8 11.17 14.57C12.28 15.56 13.19 15.87 13.51 16C13.83 16.13 14.02 16.1 14.21 15.88C14.4 15.66 14.88 15.09 15.07 14.81C15.26 14.53 15.45 14.57 15.72 14.67C15.99 14.77 17.43 15.48 17.72 15.63C18.01 15.78 18.2 15.85 18.27 15.97C18.34 16.09 18.34 16.66 17.04 16.47Z" />
                      </svg>
                      <span>WhatsApp</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button type="submit" className="btn btn-primary" disabled={isPending} style={{ width: "100%" }}>
                      {isPending ? "Saving…" : "Save WhatsApp Widget"}
                    </button>
                  </div>
                </form>
              )}

              {/* 9. LOYALTY & VIP TIERS */}
              {activeModal === "loyalty_vip" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    startTransition(async () => {
                      const res = await saveLoyaltyAction({
                        enabled: fd.get("enabled") === "on",
                        referralEnabled: fd.get("referralEnabled") === "on",
                        spendPerPoint: Number(fd.get("spendPerPoint") ?? 100),
                        pointsPerBlock: Number(fd.get("pointsPerBlock") ?? 10),
                        bdtPerBlock: Number(fd.get("bdtPerBlock") ?? 10),
                        maxCartPercent: Number(fd.get("maxCartPercent") ?? 30),
                        refereeDiscount: Number(fd.get("refereeDiscount") ?? 50),
                        refereeMinCart: Number(fd.get("refereeMinCart") ?? 500),
                        referrerReward: Number(fd.get("referrerReward") ?? 100),
                        vipSilverMin: Number(fd.get("vipSilverMin") ?? 5000),
                        vipGoldMin: Number(fd.get("vipGoldMin") ?? 15000),
                        vipPlatinumMin: Number(fd.get("vipPlatinumMin") ?? 35000),
                        vipGoldDiscount: Number(fd.get("vipGoldDiscount") ?? 5),
                        vipPlatinumDiscount: Number(fd.get("vipPlatinumDiscount") ?? 10),
                        expiryMonths: Number(fd.get("expiryMonths") ?? 0),
                        birthdayVoucher: Number(fd.get("birthdayVoucher") ?? 100),
                      });
                      setFormMsg(res);
                    });
                  }}
                  className="stack"
                  style={{ gap: 16 }}
                >
                  <div className="card" style={{ background: "rgba(124, 58, 237, 0.04)", border: "1px solid rgba(124, 58, 237, 0.2)", padding: 14 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
                      <input
                        type="checkbox"
                        name="enabled"
                        defaultChecked={storeSettings?.loyaltyEnabled ?? false}
                        style={{ width: 18, height: 18 }}
                      />
                      <span>Enable Loyalty Reward Points at Checkout</span>
                    </label>
                    <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
                      When turned on, shoppers earn points on delivered orders and can redeem them for cash discounts at checkout.
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="label">Spend per 1 Point (BDT)</label>
                      <input
                        type="number"
                        name="spendPerPoint"
                        defaultValue={storeSettings?.loyaltySpendPerPoint ?? 100}
                        min={1}
                        className="input"
                        style={{ width: "100%" }}
                      />
                      <span className="muted" style={{ fontSize: 12 }}>Default: ৳100 = 1 point</span>
                    </div>

                    <div>
                      <label className="label">Points Redemption Rate</label>
                      <input
                        type="number"
                        name="bdtPerBlock"
                        defaultValue={storeSettings?.loyaltyBdtPerBlock ?? 10}
                        min={1}
                        className="input"
                        style={{ width: "100%" }}
                      />
                      <input type="hidden" name="pointsPerBlock" value={10} />
                      <span className="muted" style={{ fontSize: 12 }}>10 points = ৳10 discount</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label className="label">Max Cart % Points Can Pay</label>
                      <input
                        type="number"
                        name="maxCartPercent"
                        defaultValue={storeSettings?.loyaltyMaxCartPercent ?? 30}
                        min={1}
                        max={100}
                        className="input"
                        style={{ width: "100%" }}
                      />
                      <span className="muted" style={{ fontSize: 12 }}>Default: 30% of cart</span>
                    </div>

                    <div>
                      <label className="label">Points Expiry (Months)</label>
                      <input
                        type="number"
                        name="expiryMonths"
                        defaultValue={storeSettings?.loyaltyExpiryMonths ?? 0}
                        min={0}
                        max={60}
                        className="input"
                        style={{ width: "100%" }}
                      />
                      <span className="muted" style={{ fontSize: 12 }}>0 = Never expire</span>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>VIP Tier Thresholds (12-Month Spend)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="label" style={{ fontSize: 12 }}>Silver Min (৳)</label>
                        <input
                          type="number"
                          name="vipSilverMin"
                          defaultValue={storeSettings?.vipSilverMin ?? 5000}
                          className="input"
                          style={{ width: "100%", fontSize: 13 }}
                        />
                        <span className="muted" style={{ fontSize: 11 }}>1.25x points</span>
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 12 }}>Gold Min (৳)</label>
                        <input
                          type="number"
                          name="vipGoldMin"
                          defaultValue={storeSettings?.vipGoldMin ?? 15000}
                          className="input"
                          style={{ width: "100%", fontSize: 13 }}
                        />
                        <input type="hidden" name="vipGoldDiscount" value={storeSettings?.vipGoldDiscount ?? 5} />
                        <span className="muted" style={{ fontSize: 11 }}>1.5x pts + 5% off</span>
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 12 }}>Platinum Min (৳)</label>
                        <input
                          type="number"
                          name="vipPlatinumMin"
                          defaultValue={storeSettings?.vipPlatinumMin ?? 35000}
                          className="input"
                          style={{ width: "100%", fontSize: 13 }}
                        />
                        <input type="hidden" name="vipPlatinumDiscount" value={storeSettings?.vipPlatinumDiscount ?? 10} />
                        <span className="muted" style={{ fontSize: 11 }}>2x + 10% + Free Ship</span>
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 14 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                      <input
                        type="checkbox"
                        name="referralEnabled"
                        defaultChecked={storeSettings?.referralEnabled ?? false}
                        style={{ width: 16, height: 16 }}
                      />
                      <span>Refer-a-Friend Viral Discounts</span>
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                      <div>
                        <label className="label" style={{ fontSize: 12 }}>Friend Gets Off (৳)</label>
                        <input
                          type="number"
                          name="refereeDiscount"
                          defaultValue={storeSettings?.refereeDiscountBdt ?? 50}
                          className="input"
                          style={{ width: "100%", fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: 12 }}>Referrer Earns (Pts)</label>
                        <input
                          type="number"
                          name="referrerReward"
                          defaultValue={storeSettings?.referrerRewardPoints ?? 100}
                          className="input"
                          style={{ width: "100%", fontSize: 13 }}
                        />
                      </div>
                    </div>
                    <input type="hidden" name="refereeMinCart" value={storeSettings?.refereeMinCartBdt ?? 500} />
                    <input type="hidden" name="birthdayVoucher" value={storeSettings?.birthdayVoucherBdt ?? 100} />
                  </div>

                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <Link href="/marketing/loyalty" className="link" prefetch={false} style={{ fontSize: 13 }}>
                      View Customer Points Ledger & Leaderboard →
                    </Link>
                    <button type="submit" className="btn btn-primary" disabled={isPending}>
                      {isPending ? "Saving…" : "Save Loyalty Settings"}
                    </button>
                  </div>
                </form>
              )}

              {/* 10. UNIFIED FRAUD SHIELD */}
              {activeModal === "fraud_shield" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                    Unified multi-layer defense engine protects your store from fake cash-on-delivery orders and return parcel charges.
                  </p>

                  <div className="card" style={{ background: "rgba(5, 150, 105, 0.05)", border: "1px solid rgba(5, 150, 105, 0.2)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#059669" }}>
                      Active Risk Formula (0 - 100 Score):
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
                      <li><b>50% Weight:</b> Verified Steadfast courier delivery completion percentage.</li>
                      <li><b>30% Weight:</b> Cross-merchant BizTrack platform trust network.</li>
                      <li><b>20% Weight:</b> Repeat customer order history on your store.</li>
                    </ul>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <Link href="/fraud" className="btn btn-primary" style={{ flex: 1, textAlign: "center" }} prefetch={false}>
                      Go to Fraud & Risk Panel →
                    </Link>
                  </div>
                </div>
              )}

              {/* 11. SMS GATEWAY AGGREGATOR */}
              {activeModal === "sms_alerts" && (() => {
                const row = getIntegration("SMS_BYO", "LIVE");

                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        const res = await saveSmsGatewayAction({
                          apiKey: String(fd.get("apiKey") ?? ""),
                          senderId: String(fd.get("senderId") ?? ""),
                          provider: String(fd.get("provider") ?? "greenweb"),
                        });
                        setFormMsg(res);
                      });
                    }}
                    className="stack"
                    style={{ gap: 14 }}
                  >
                    <p style={{ fontSize: 13.5 }}>
                      Send transactional SMS order confirmation and status updates using your own Greenweb, Reve, or Elitbuzz account.
                    </p>

                    <div>
                      <label className="label">SMS Aggregator Provider</label>
                      <select name="provider" defaultValue={row?.config?.provider ?? "greenweb"} className="input" style={{ width: "100%" }}>
                        <option value="greenweb">Greenweb SMS</option>
                        <option value="reve">Reve Systems SMS</option>
                        <option value="elitbuzz">Elitbuzz Technologies</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">API Key / Token</label>
                      <input
                        type="password"
                        name="apiKey"
                        placeholder={row?.secretsSet?.apiKey ? "•••••••••••• (Leave blank to keep saved)" : "Enter SMS API token"}
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <label className="label">Sender ID (Masking Name, Optional)</label>
                      <input
                        type="text"
                        name="senderId"
                        defaultValue={row?.config?.senderId ?? ""}
                        placeholder="e.g. BIZTRACK"
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <button type="submit" className="btn btn-primary" disabled={isPending} style={{ width: "100%" }}>
                        {isPending ? "Saving…" : "Save SMS Gateway"}
                      </button>
                    </div>
                  </form>
                );
              })()}

              {/* 12. SSLCOMMERZ */}
              {activeModal === "sslcommerz_pay" && (() => {
                const row = getIntegration("SSLCOMMERZ", "LIVE");

                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        const res = await savePaymentGatewayAction("SSLCOMMERZ", "LIVE", {
                          storeId: String(fd.get("storeId") ?? ""),
                          storePassword: String(fd.get("storePassword") ?? ""),
                        });
                        setFormMsg(res);
                      });
                    }}
                    className="stack"
                    style={{ gap: 14 }}
                  >
                    <div>
                      <label className="label">SSLCOMMERZ Store ID</label>
                      <input
                        type="text"
                        name="storeId"
                        defaultValue={row?.config?.storeId ?? ""}
                        placeholder="Your Store ID"
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <label className="label">Store Password</label>
                      <input
                        type="password"
                        name="storePassword"
                        placeholder={row?.secretsSet?.storePassword ? "•••••••••••• (Leave blank to keep saved)" : "Store password"}
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <button type="submit" className="btn btn-primary" disabled={isPending} style={{ width: "100%" }}>
                        {isPending ? "Saving…" : "Save SSLCOMMERZ Keys"}
                      </button>
                    </div>
                  </form>
                );
              })()}

              {/* 13. UDDOKTAPAY */}
              {activeModal === "uddoktapay_pay" && (() => {
                const row = getIntegration("UDDOKTAPAY", "LIVE");

                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        const res = await savePaymentGatewayAction("UDDOKTAPAY", "LIVE", {
                          apiKey: String(fd.get("apiKey") ?? ""),
                          baseUrl: String(fd.get("baseUrl") ?? ""),
                        });
                        setFormMsg(res);
                      });
                    }}
                    className="stack"
                    style={{ gap: 14 }}
                  >
                    <div>
                      <label className="label">UddoktaPay API Key</label>
                      <input
                        type="password"
                        name="apiKey"
                        placeholder={row?.secretsSet?.apiKey ? "•••••••••••• (Leave blank to keep saved)" : "Enter API Key"}
                        className="input"
                        style={{ width: "100%" }}
                      />
                    </div>

                    <div>
                      <label className="label">Base URL (Optional)</label>
                      <input
                        type="text"
                        name="baseUrl"
                        defaultValue={row?.config?.baseUrl ?? "https://pay.uddoktapay.com/api/checkout-v2"}
                        className="input"
                        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
                      />
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <button type="submit" className="btn btn-primary" disabled={isPending} style={{ width: "100%" }}>
                        {isPending ? "Saving…" : "Save UddoktaPay Keys"}
                      </button>
                    </div>
                  </form>
                );
              })()}

              {/* 14. WHATSAPP COMMERCE SUITE */}
              {activeModal === "whatsapp_commerce" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Send automated Cash-on-Delivery order confirmations, delivery tracking updates, abandoned cart recoveries, and customer support via WhatsApp.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active for this store" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, "whatsapp_commerce", !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-2" style={{ gap: 10 }}>
                    <Link href="/marketing/whatsapp" className="btn btn-primary" style={{ textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open WhatsApp Automation Manager →
                    </Link>
                    <Link href="/inbox" className="btn btn-secondary" style={{ textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open Live Support Desk Inbox →
                    </Link>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(37, 211, 102, 0.25)", background: "rgba(37, 211, 102, 0.04)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#16A34A" }}>
                      Key Features Included:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li><b>Linked Device QR Pairing:</b> Connect any WhatsApp number without Meta Cloud API verification.</li>
                      <li><b>2-Way Confirmation Bot:</b> Customer taps [Confirm Order] or [Cancel] directly in WhatsApp.</li>
                      <li><b>Out-for-Delivery Cash Preparation:</b> Alerts customer when parcel is picked up by Steadfast/Pathao with exact BDT total.</li>
                      <li><b>Live Desk:</b> Chat with shoppers directly from your admin panel.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 15. PRODUCT BUNDLES & ORDER BUMPS */}
              {activeModal === "product_bundles" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Increase your store&apos;s Average Order Value (AOV). Offer &quot;Frequently Bought Together&quot; combo packages with percentage discounts and high-converting 1-click checkout order bumps.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active on storefront" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, "product_bundles", !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div>
                    <Link href="/marketing/bundles" className="btn btn-primary" style={{ display: "block", textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open Bundles &amp; Order Bumps Studio →
                    </Link>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(245, 158, 11, 0.25)", background: "rgba(245, 158, 11, 0.04)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#D97706" }}>
                      Upsell Tools Available:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li><b>Frequently Bought Together:</b> Multi-item packages displayed below the product page with 1-click add-all.</li>
                      <li><b>Checkout Order Bumps:</b> Impulse addons (e.g. socks, accessories, gift wrap) on the checkout form.</li>
                      <li><b>Unified Inventory:</b> Automatic deduction of individual product and variant stocks when bundles sell.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 16. LANDING PAGE & SALES FUNNELS */}
              {activeModal === "landing_builder" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Build high-converting, single-product sales landing pages (/l/[slug]) with integrated cash-on-delivery order forms, urgency countdown timers, and dedicated conversion tracking.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active for this store" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, "landing_builder", !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div>
                    <Link href="/landing" className="btn btn-primary" style={{ display: "block", textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open Landing Page Funnel Studio →
                    </Link>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(139, 92, 246, 0.25)", background: "rgba(139, 92, 246, 0.04)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#7C3AED" }}>
                      Conversion Highlights:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li><b>Zero Distraction:</b> Removes header navigation and footer clutter for 100% ad focus.</li>
                      <li><b>Built-in COD Order Form:</b> Name, phone, and full address capture in 1 screen.</li>
                      <li><b>Meta Pixel &amp; CAPI:</b> Seamless tracking for Facebook and TikTok ad optimization.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 17. CUSTOMER RETURNS & REVERSE LOGISTICS */}
              {activeModal === "customer_returns" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Manage customer returns and exchanges professionally. Provide self-service return requests, log courier return tracking codes, inspect items upon receipt, and record refunds or store credits.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active for this store" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, "customer_returns", !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div>
                    <Link href="/returns" className="btn btn-primary" style={{ display: "block", textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open Customer Returns Manager →
                    </Link>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(59, 130, 246, 0.25)", background: "rgba(59, 130, 246, 0.04)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#2563EB" }}>
                      Returns Workflow:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li><b>Review &amp; Approve:</b> Customers request returns with order number and phone number.</li>
                      <li><b>Courier Tracking:</b> Log return tracking numbers when Steadfast/Pathao brings the parcel back.</li>
                      <li><b>Restocking Control:</b> Flag damaged goods or automatically restock inventory on approval.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 18. PRODUCT REVIEWS & SOCIAL PROOF */}
              {activeModal === "product_reviews" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Collect authentic verified buyer photo reviews and 5-star ratings. Moderate submissions, reply to customer feedback, and display rich social proof across product pages.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active on storefront" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, "product_reviews", !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div>
                    <Link href="/reviews" className="btn btn-primary" style={{ display: "block", textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open Product Reviews Moderation →
                    </Link>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(245, 158, 11, 0.25)", background: "rgba(245, 158, 11, 0.04)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#D97706" }}>
                      Social Proof Highlights:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li><b>Verified Buyer Badges:</b> Only customers with delivered orders can submit reviews.</li>
                      <li><b>Photo Uploads:</b> Customers can attach photos of real received items.</li>
                      <li><b>Merchant Replies:</b> Public replies from store staff displayed under reviews.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 19. WHOLESALE & B2B PRICING SUITE */}
              {activeModal === "wholesale_b2b" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Empower your store to sell in bulk to boutique shops and resellers alongside retail shoppers. Configure tiered volume quantity breaks, pre-approved reseller trade tiers, storewide MOQs, bank transfer checkout, and professional B2B Tax Invoices & Delivery Challans.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active for this store" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, "wholesale_b2b", !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div>
                    <Link href="/products/wholesale" className="btn btn-primary" style={{ display: "block", textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open Wholesale & B2B Management Hub →
                    </Link>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(79, 70, 229, 0.25)", background: "rgba(79, 70, 229, 0.04)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#4F46E5" }}>
                      B2B Suite Capabilities:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li><b>Public Volume Breaks:</b> &quot;Buy 6+ save 15%, 12+ save 25%&quot; open to general shoppers.</li>
                      <li><b>Approved Reseller Accounts:</b> Trade license / BIN verification with 1-click approvals.</li>
                      <li><b>Dual Minimums Engine:</b> Enforce product MOQs and storewide B2B minimum cart totals.</li>
                      <li><b>B2B Documents:</b> Printable Tax Invoices & Delivery Challans with authorized signatures.</li>
                      <li><b>Flexible Payments:</b> Direct bank deposit details and partial advance deposit support.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 20. POS & BARCODE STUDIO */}
              {activeModal === "pos_barcode" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Omnichannel retail counter cashier terminal, barcode scanning, thermal receipt roll printing (58mm/80mm), and real-time inventory deduction across physical and online sales.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active for this store" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, "pos_barcode", !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-2" style={{ gap: 10 }}>
                    <Link href="/pos" className="btn btn-primary" style={{ textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open POS Terminal →
                    </Link>
                    <Link href="/products/barcodes" className="btn btn-secondary" style={{ textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open Barcode Studio →
                    </Link>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(59, 130, 246, 0.25)", background: "rgba(59, 130, 246, 0.04)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#2563EB" }}>
                      POS Capabilities Included:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li><b>High-Speed Cashier Desk:</b> Instant variant search, barcode camera scanning, and walk-in customer checkout.</li>
                      <li><b>Thermal Printing:</b> Clean 58mm and 80mm ESC/POS receipt slips with Bengali shop headers.</li>
                      <li><b>Barcode Label Generation:</b> Bulk print Code-128 sticker labels for all variants in one click.</li>
                      <li><b>Split Payments:</b> Accept Cash, bKash/Nagad, and Card payments at the counter.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 21. STORE ASSISTANT & CONTENT TOOLS */}
              {activeModal === "ai_suite" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Automated store assistant and content tools. Generates bilingual product descriptions, extracts structured addresses from chat messages, and assists shoppers 24/7.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active for this store" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, "ai_suite", !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div>
                    <Link href="/settings/ai" className="btn btn-primary" style={{ display: "block", textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open Assistant Settings →
                    </Link>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(139, 92, 246, 0.25)", background: "rgba(139, 92, 246, 0.04)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#7C3AED" }}>
                      Included Features:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li><b>Description Generator:</b> Generates titles, bullet points, and SEO descriptions.</li>
                      <li><b>Address Parser:</b> Extract recipient addresses from customer chat text into structured fields.</li>
                      <li><b>Storefront Assistant:</b> Responds to common shopper inquiries regarding stock, sizing, and policies.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 22. MARKETING COMMAND CENTER */}
              {activeModal === "marketing_campaigns" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Engage and retain customers with targeted SMS broadcasts, promotional flash sales, and storefront announcement banners.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active for this store" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, "marketing_campaigns", !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div>
                    <Link href="/marketing/campaigns" className="btn btn-primary" style={{ display: "block", textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open Marketing Command Center →
                    </Link>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(16, 185, 129, 0.25)", background: "rgba(16, 185, 129, 0.04)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#059669" }}>
                      Campaign Tools:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li><b>Broadcast SMS:</b> Send segmented bulk SMS messages to previous buyers.</li>
                      <li><b>Storefront Flash Banners:</b> Display sticky urgency bars with countdown timers.</li>
                      <li><b>Customer Segmentation:</b> Target VIPs, repeat buyers, or dormant customers.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 23. ABANDONED CART RECOVERY */}
              {activeModal === "abandoned_cart" && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    Recover up to 25% of uncompleted checkouts automatically. Trigger automated reminders via WhatsApp and SMS with 1-click restored cart links.
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active for this store" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, "abandoned_cart", !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  <div>
                    <Link href="/abandoned" className="btn btn-primary" style={{ display: "block", textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                      Open Abandoned Carts Desk →
                    </Link>
                  </div>

                  <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.25)", background: "rgba(239, 68, 68, 0.04)", padding: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#DC2626" }}>
                      Recovery Features:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                      <li><b>2-Stage Timing:</b> Send first reminder after 1 hour and follow-up with incentive coupon after 24 hours.</li>
                      <li><b>1-Click Restore:</b> Customers tap the link on mobile and land directly on checkout with items restored.</li>
                      <li><b>WhatsApp Priority:</b> Sends via WhatsApp first to save SMS costs.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* UNIVERSAL FALLBACK FOR ANY OTHER APP */}
              {![
                "facebook_catalog",
                "steadfast_courier",
                "pathao_courier",
                "redx_courier",
                "meta_pixel_capi",
                "google_analytics",
                "tiktok_pixel",
                "whatsapp_widget",
                "loyalty_vip",
                "fraud_shield",
                "sms_alerts",
                "sslcommerz_pay",
                "uddoktapay_pay",
                "whatsapp_commerce",
                "product_bundles",
                "landing_builder",
                "customer_returns",
                "product_reviews",
                "wholesale_b2b",
                "pos_barcode",
                "ai_suite",
                "marketing_campaigns",
                "abandoned_cart",
              ].includes(activeModal) && (
                <div className="stack" style={{ gap: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                    {currentApp.description}
                  </p>

                  <div className="card" style={{ background: "var(--bg-subtle, #f9fafb)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Module Status</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {currentApp.enabled ? "Active for this store" : "Turned off"}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={setModuleAction.bind(null, currentApp.key, !currentApp.enabled)}>
                          <SubmitButton className={`btn btn-sm ${currentApp.enabled ? "btn-secondary" : "btn-primary"}`} pending="…">
                            {currentApp.enabled ? "Turn Off App" : "Turn On App"}
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  {currentApp.configureHref && !currentApp.configureHref.startsWith("/settings/apps") && (
                    <div>
                      <Link href={currentApp.configureHref} className="btn btn-primary" style={{ display: "block", textAlign: "center", padding: "10px 14px", textDecoration: "none" }}>
                        Open {currentApp.label} →
                      </Link>
                    </div>
                  )}

                  {currentApp.features && currentApp.features.length > 0 && (
                    <div className="card" style={{ border: "1px solid var(--border, #e5e7eb)", background: "#fff", padding: 16 }}>
                      <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>
                        Features Included:
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>
                        {currentApp.features.map((feat, i) => (
                          <li key={i}>{feat}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
