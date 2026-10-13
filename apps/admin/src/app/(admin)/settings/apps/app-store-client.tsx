"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AppCategory, AppStoreItemView, AppStoreOverview } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { setModuleAction } from "./actions";

interface Props {
  overview: AppStoreOverview;
  canEdit: boolean;
}

const CATEGORIES: { key: AppCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "All Apps" },
  { key: "MARKETING", label: "Marketing & Tracking" },
  { key: "COURIERS", label: "Couriers & Logistics" },
  { key: "GROWTH", label: "Growth & Loyalty" },
  { key: "AUTOMATION", label: "Automation & Protection" },
  { key: "COMMERCE", label: "Commerce & Specialized" },
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
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      );
  }
}

export function AppStoreClient({ overview, canEdit }: Props) {
  const [category, setCategory] = useState<AppCategory | "ALL">("ALL");
  const [search, setSearch] = useState("");

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

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* 1. Header Overview & Plan Allowance */}
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
            Store Ecosystem
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
            {overview.totalActive} Apps & Integrations Active
          </div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
            {overview.allowance == null
              ? "All premium addons unlocked on Business Plan."
              : `${overview.usedAddons} of ${overview.allowance} premium addons currently active on ${overview.planTier} Plan.`}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/billing" className="btn btn-secondary btn-sm" prefetch={false}>
            Upgrade Plan
          </Link>
          <Link href="/settings/integrations" className="btn btn-secondary btn-sm" prefetch={false}>
            Manage Keys
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
              placeholder="Search apps by name, courier, or keyword (e.g. Facebook, Steadfast, Loyalty)..."
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
                          <Link href={`/settings/apps/${app.key}`} className="link" prefetch={false} style={{ color: "inherit", textDecoration: "none" }}>
                            {app.label}
                          </Link>
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
                    {/* Toggle form for plan addon modules */}
                    {app.tier === "ADDON" && app.built && canEdit && !isLocked && (
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
                      <Link href={app.configureHref} className="btn btn-primary btn-sm" prefetch={false}>
                        {isInstalled ? "Configure" : "Set Up"}
                      </Link>
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
    </div>
  );
}
