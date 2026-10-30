import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can, getAppCatalogItem, isModuleOn } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { SubmitButton } from "@/components/ui";
import { PageHeader } from "@biztrackbd/ui";
import { requireAccess } from "@/lib/session";
import { setModuleAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const app = getAppCatalogItem(key);
  return { title: app ? `${app.label} · Apps` : "App Details" };
}

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const app = getAppCatalogItem(key);
  if (!app) notFound();

  const s = await requireAccess("billing");
  const canEdit = can(s.user.role, "billing", "edit");

  let isEnabled = app.built;
  if (app.tier === "ADDON" && app.built) {
    const modKey = app.key === "loyalty_vip" ? "loyalty" : app.key;
    isEnabled = await withTenant(s.tenantId, (tx) => isModuleOn(tx, modKey));
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader
        title={app.label}
        crumbs={[
          { label: "Settings", href: "/settings/apps" },
          { label: "Apps", href: "/settings/apps" },
          { label: app.label },
        ]}
      />

      {/* Header Banner */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 12,
              background: "var(--bg-subtle, #f3f4f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border, #e5e7eb)",
              fontSize: 24,
              color: "var(--brand, #0f766e)",
            }}
          >
            {app.category === "MARKETING" ? (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
            ) : app.category === "COURIERS" ? (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
            ) : app.category === "GROWTH" ? (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg>
            ) : app.category === "AUTOMATION" ? (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            ) : (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
            )}
          </div>
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{app.label}</h1>
              {app.badge && <span className="pill grey">{app.badge}</span>}
              <span
                className="pill"
                style={{
                  background: app.tier === "INCLUDED" ? "rgba(16, 185, 129, 0.1)" : "rgba(124, 58, 237, 0.1)",
                  color: app.tier === "INCLUDED" ? "#059669" : "#7C3AED",
                }}
              >
                {app.tierLabel}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
              Category: <b>{app.categoryLabel}</b> · {app.built ? "Ready to use" : "In development"}
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          {app.tier === "ADDON" && app.built && canEdit && (
            <form action={setModuleAction.bind(null, app.key, !isEnabled)}>
              <SubmitButton className="btn btn-secondary" pending="Saving…">
                {isEnabled ? "Switch off" : "Switch on"}
              </SubmitButton>
            </form>
          )}

          {app.built && (
            <Link href={app.configureHref} className="btn btn-primary" prefetch={false}>
              Configure Settings →
            </Link>
          )}
        </div>
      </div>

      {/* Main Content Split */}
      <div className="split" style={{ alignItems: "flex-start" }}>
        <div className="col stack" style={{ gap: 16 }}>
          {/* Overview Section */}
          <section className="card">
            <div className="card-head">
              <h2>Overview</h2>
            </div>
            <p style={{ lineHeight: 1.6, fontSize: 14.5 }}>{app.longDescription}</p>

            <h3 style={{ fontSize: 15, fontWeight: 600, marginTop: 18, marginBottom: 8 }}>Key Capabilities</h3>
            <ul style={{ paddingLeft: 20, margin: 0, lineHeight: 1.7, fontSize: 14 }}>
              {app.features.map((feat, idx) => (
                <li key={idx}>✓ {feat}</li>
              ))}
            </ul>
          </section>

          {/* Setup Guide */}
          <section className="card">
            <div className="card-head">
              <h2>Setup & Quick Guide</h2>
            </div>
            <div className="notice info" style={{ marginBottom: 12 }}>
              {app.docsSummary}
            </div>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              For developer webhooks and advanced settings, visit{" "}
              <Link href="/settings/apps" className="link" prefetch={false}>
                Settings &gt; Apps &amp; Integrations
              </Link>
              .
            </p>
          </section>
        </div>

        <div className="col stack" style={{ gap: 16 }}>
          {/* Status & Plan Info */}
          <section className="card">
            <div className="card-head">
              <h2>App Status</h2>
              <span className={`pill ${isEnabled ? "ok" : "grey"}`}>{isEnabled ? "Active" : "Inactive"}</span>
            </div>
            <dl className="kv">
              <dt>Pricing</dt>
              <dd>{app.tierLabel}</dd>
              <dt>Status</dt>
              <dd>{app.built ? "Production Ready" : "Coming Soon"}</dd>
              <dt>Direct path</dt>
              <dd>
                <Link href={app.configureHref} className="link" prefetch={false}>
                  {app.configureHref}
                </Link>
              </dd>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
