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
    <div className="stack gap-4">
      <PageHeader
        title={app.label}
        crumbs={[
          { label: "Settings", href: "/settings/apps" },
          { label: "Apps", href: "/settings/apps" },
          { label: app.label },
        ]}
      />

      {/* Header Banner */}
      <div className="card row-between items-start flex-wrap gap-3">
        <div className="row gap-3 items-center">
          <div className="icon-box-lg">
            {app.category === "MARKETING" ? (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
            ) : app.category === "COURIERS" ? (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
            ) : app.category === "GROWTH" ? (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg>
            ) : app.category === "AUTOMATION" ? (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            ) : (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
            )}
          </div>
          <div>
            <div className="row gap-2 items-center flex-wrap">
              <h1 className="text-xl font-bold m-0">{app.label}</h1>
              {app.badge && <span className="pill grey">{app.badge}</span>}
              <span className={app.tier === "INCLUDED" ? "badge-green" : "badge-purple"}>
                {app.tierLabel}
              </span>
            </div>
            <div className="muted text-sm mt-1">
              Category: <b>{app.categoryLabel}</b> · {app.built ? "Ready to use" : "In development"}
            </div>
          </div>
        </div>

        <div className="row gap-2">
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
      <div className="split items-start">
        <div className="col stack gap-3">
          {/* Overview Section */}
          <section className="card">
            <div className="card-head">
              <h2>Overview</h2>
            </div>
            <p className="leading-relaxed text-sm">{app.longDescription}</p>

            <h3 className="text-sm font-semibold mt-3 mb-2">Key Capabilities</h3>
            <ul className="ps-4 m-0 leading-loose text-sm">
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
            <div className="notice info mb-3">
              {app.docsSummary}
            </div>
            <p className="muted text-sm leading-normal">
              For developer webhooks and advanced settings, visit{" "}
              <Link href="/settings/apps" className="link" prefetch={false}>
                Settings &gt; Apps &amp; Integrations
              </Link>
              .
            </p>
          </section>
        </div>

        <div className="col stack gap-3">
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
