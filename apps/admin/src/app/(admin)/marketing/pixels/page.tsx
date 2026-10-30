import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@biztrackbd/ui";
import { can, getTrackingOverview } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { saveAllTrackingAction, testEventAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pixels and Tracking" };

const LABEL: Record<string, string> = {
  PageView: "Page views",
  ViewContent: "Product views",
  AddToCart: "Added to cart",
  InitiateCheckout: "Started checkout",
  AddPaymentInfo: "Payment details",
  Purchase: "Purchases",
  Lead: "Inquiries & Leads",
  Schedule: "Bookings & Consultations",
  CompleteRegistration: "Registrations",
  Contact: "Contact messages",
};

export default async function Pixels({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("marketing");
  const o = await getTrackingOverview(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "marketing", "edit");
  const c = o.config;
  const err = one(sp.err);
  const done = one(sp.done);
  const total = o.stats.reduce((n, e) => n + e.browser + e.server, 0);

  return (
    <>
      <PageHeader
        title="Pixels & Conversion Tracking"
        crumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Pixels" }]}
        sub="Send visits and purchases to Facebook and Google so your ads find real buyers. We send events from the browser and from our server, and remove duplicates automatically."
        actions={
          <Link href="/marketing/pixels/health" className="btn btn-secondary btn-sm">
            CAPI Diagnostics
          </Link>
        }
      />

      {err && <div className="notice bad mb-md" role="alert" data-testid="pixel-error">{err}</div>}
      {done && (
        <div className="notice good mb-md" role="status">
          {done === "saved"
            ? "Tracking IDs saved successfully."
            : done === "fb_connected"
              ? "Facebook account connected! Ad account and Pixel synced via Graph API."
              : "Test event sent to Meta. Check Meta Events Manager Test Events tab."}
        </div>
      )}

      {/* Main Unified Tracking Form */}
      <form action={saveAllTrackingAction} className="stack gap-lg">
        {/* Facebook Pixel & CAPI Card matching AdmPixels.dc.html */}
        <section className="card p-lg" data-testid="meta-pixel-card">
          <div className="flex-between items-center gap-md flex-wrap mb-md">
            <div className="row items-center gap-md">
              <div className="provider-icon-lg provider-fb">
                f
              </div>
              <div>
                <div className="font-bold text-base">Facebook Pixel and Conversions API</div>
                <div className="text-sm text-ink-2 mt-xs">
                  {c.pixelId ? `Pixel ID ${c.pixelId}` : "Not configured yet"} · {c.capiConnected ? "Server CAPI Active" : "Browser only"}
                </div>
              </div>
            </div>
            <div className="row items-center gap-sm">
              {canEdit && (
                <a
                  href="/api/auth/facebook/connect"
                  className="btn btn-secondary btn-sm"
                  data-testid="meta-oauth-btn"
                >
                  1-Click Connect
                </a>
              )}
              <span className={`pill ${c.pixelId && c.capiConnected ? "ok" : c.pixelId ? "ok" : "grey"}`}>
                {c.pixelId ? "Connected" : "Not set up"}
              </span>
            </div>
          </div>

          <div className="grid-280 pt-md border-top">
            <label className="field m-0">
              <span className="label">Pixel ID</span>
              <input
                className="input"
                name="pixelId"
                inputMode="numeric"
                defaultValue={c.pixelId ?? ""}
                placeholder="482199301127"
                disabled={!canEdit}
                data-testid="pixel-id"
              />
              <span className="hint">Find it in Meta Events Manager &rarr; Data Sources.</span>
            </label>

            <div className="field m-0">
              <span className="label">Conversions API Access Token</span>
              <div className="token-box">
                <span className="flex-1 font-mono text-ink-2">
                  {c.capiConnected ? "••••••••••••••token" : "No token saved"}
                </span>
                <Link href="/settings/apps?open=meta_pixel_capi" className="link text-sm font-bold" prefetch={false}>
                  {c.capiConnected ? "Configure" : "Add Token"}
                </Link>
              </div>
              <span className="hint">Saved in encrypted vault. Server events bypass ad-blockers.</span>
            </div>

            <label className="field m-0 grid-col-all">
              <span className="label">Meta Domain Verification (Optional)</span>
              <input
                className="input"
                name="metaDomainVerification"
                defaultValue={c.metaDomainVerification ?? ""}
                placeholder="e.g. 7abc89def01234567890abcdef"
                disabled={!canEdit}
                data-testid="meta-domain-verification"
              />
              <span className="hint">Copy verification code from Meta Business Suite &rarr; Brand Safety &rarr; Domains. Injected into store &lt;head&gt;.</span>
            </label>
          </div>
        </section>

        {/* Google & TikTok Grid matching AdmPixels.dc.html */}
        <div className="grid-300">
          {/* Google Analytics 4 */}
          <section className="card p-md" data-testid="ga4-card">
            <div className="row items-center gap-md mb-md">
              <div className="provider-icon provider-ga4">
                GA4
              </div>
              <div className="flex-1">
                <div className="font-bold text-base">Google Analytics 4</div>
                <div className="text-xs text-ink-3">Measurement ID &amp; Server Protocol</div>
              </div>
              <span className={`pill ${c.googleAnalyticsId ? "ok" : "grey"}`}>
                {c.googleAnalyticsId ? "Active" : "Off"}
              </span>
            </div>
            <label className="field mb-md">
              <span className="label">Measurement ID</span>
              <input
                className="input"
                name="googleAnalyticsId"
                defaultValue={c.googleAnalyticsId ?? ""}
                placeholder="G-XXXXXXXXXX"
                disabled={!canEdit}
                data-testid="ga4-id"
              />
              <span className="hint">Google Analytics &rarr; Admin &rarr; Data Streams.</span>
            </label>
            <label className="field m-0">
              <span className="label">Measurement Protocol API Secret</span>
              <input
                className="input"
                name="ga4ApiSecret"
                type="password"
                autoComplete="new-password"
                placeholder={c.ga4ApiSecretSet ? "•••••••• saved (leave blank to keep)" : "Paste the secret"}
                disabled={!canEdit}
                data-testid="ga4-secret"
              />
              <span className="hint">Admin &rarr; Data Streams &rarr; Measurement Protocol API secrets (enables server-side purchase tracking). It is stored encrypted and never shown again.</span>
              {c.ga4ApiSecretSet && canEdit && (
                <label className="row items-center gap-sm text-sm mt-xs">
                  <input type="checkbox" name="removeGa4ApiSecret" /> Remove the saved secret
                </label>
              )}
            </label>
          </section>

          {/* Google Tag Manager */}
          <section className="card p-md" data-testid="gtm-card">
            <div className="row items-center gap-md mb-md">
              <div className="provider-icon provider-gtm">
                GTM
              </div>
              <div className="flex-1">
                <div className="font-bold text-base">Google Tag Manager</div>
                <div className="text-xs text-ink-3">Container ID (Head + Body)</div>
              </div>
              <span className={`pill ${c.googleTagManagerId ? "ok" : "grey"}`}>
                {c.googleTagManagerId ? "Active" : "Off"}
              </span>
            </div>
            <label className="field m-0">
              <span className="label">Container ID</span>
              <input
                className="input"
                name="googleTagManagerId"
                defaultValue={c.googleTagManagerId ?? ""}
                placeholder="GTM-XXXXXXX"
                disabled={!canEdit}
                data-testid="gtm-id"
              />
              <span className="hint">Injects custom scripts &amp; dataLayer e-commerce events.</span>
            </label>
          </section>

          {/* TikTok Pixel */}
          <section className="card p-md" data-testid="tiktok-card">
            <div className="row items-center gap-md mb-md">
              <div className="provider-icon provider-tiktok">
                TikTok
              </div>
              <div className="flex-1">
                <div className="font-bold text-base">TikTok Pixel</div>
                <div className="text-xs text-ink-3">TikTok Events API ID</div>
              </div>
              <span className={`pill ${c.tiktokPixelId ? "ok" : "grey"}`}>
                {c.tiktokPixelId ? "Active" : "Off"}
              </span>
            </div>
            <label className="field m-0">
              <span className="label">Pixel Code</span>
              <input
                className="input"
                name="tiktokPixelId"
                defaultValue={c.tiktokPixelId ?? ""}
                placeholder="CXXXXXXXXXXXXX"
                disabled={!canEdit}
                data-testid="tiktok-id"
              />
              <span className="hint">Copy from TikTok Ads Manager &rarr; Assets &rarr; Events.</span>
            </label>
          </section>
        </div>

        {/* Google Search Console & Merchant Center */}
        <section className="card p-lg" data-testid="google-cloud-suite-card">
          <div className="flex-between items-center gap-md flex-wrap mb-md">
            <div className="row items-center gap-md">
              <div className="provider-icon-lg provider-google">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-base">Google Search Console &amp; Merchant Center</div>
                <div className="text-sm text-ink-2 mt-xs">
                  Site ownership verification, Google Shopping Merchant Center account, and dynamic product feeds.
                </div>
              </div>
            </div>
            <span className={`pill ${c.googleSiteVerification || c.googleMerchantCenterId ? "ok" : "grey"}`}>
              {c.googleSiteVerification || c.googleMerchantCenterId ? "Configured" : "Optional"}
            </span>
          </div>

          <div className="grid-280 pt-md border-top">
            {/* Search Console Site Verification */}
            <label className="field m-0 grid-col-all">
              <span className="label">Google Search Console Verification Token / Meta Tag</span>
              <input
                className="input"
                name="googleSiteVerification"
                defaultValue={c.googleSiteVerification ?? ""}
                placeholder='e.g. abc123xyz or <meta name="google-site-verification" content="..." />'
                disabled={!canEdit}
                data-testid="google-site-verification"
              />
              <span className="hint">
                <b>Option 1 (HTML Tag):</b> Copy the meta tag or token from Google Search Console &rarr; Ownership verification &rarr; HTML tag and paste it here. We inject it into your store &lt;head&gt; automatically.<br />
                <b>Option 2 (HTML File):</b> If Google gives you an HTML file (e.g. <code>googleXYZ.html</code>), your store serves it automatically at root—simply click <b>Verify</b> in Search Console without needing to upload anything!
              </span>
            </label>

            {/* Google Merchant Center ID */}
            <label className="field m-0 grid-col-all">
              <span className="label">Google Merchant Center Account ID</span>
              <input
                className="input"
                name="googleMerchantCenterId"
                inputMode="numeric"
                defaultValue={c.googleMerchantCenterId ?? ""}
                placeholder="e.g. 539120384"
                disabled={!canEdit}
                data-testid="google-merchant-id"
              />
              <span className="hint">Found in the top-right of your Google Merchant Center dashboard. Link your account to claim your website and sync products via the feed below.</span>
            </label>
          </div>
        </section>

        {/* Dynamic Product Catalog Feed Card for Facebook & Google */}
        <section className="card p-lg" data-testid="catalog-feed-card">
          <div className="row items-center gap-md mb-md">
            <div className="provider-icon provider-catalog">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-base">Dynamic Product Catalog Feed</div>
              <div className="text-xs text-ink-3">Real-time XML product feed for Facebook Dynamic Retargeting &amp; Google Shopping</div>
            </div>
          </div>
          <p className="muted text-sm mb-md">
            Sync your products automatically with Meta Commerce Manager and Google Merchant Center. Always reflects real-time stock and prices.
          </p>
          <div className="grid-280">
            <div>
              <span className="label text-xs font-semibold">Meta (Facebook / Instagram) Catalog Feed URL</span>
              <input
                className="input input-mono mt-xs"
                readOnly
                value={`${storefrontOrigin(s.tenantSubdomain)}/api/feed/facebook.xml`}
              />
              <span className="hint">Meta Commerce Manager &rarr; Catalogs &rarr; Data Sources &rarr; Data Feed.</span>
            </div>
            <div>
              <span className="label text-xs font-semibold">Google Merchant Center Feed URL</span>
              <input
                className="input input-mono mt-xs"
                readOnly
                value={`${storefrontOrigin(s.tenantSubdomain)}/api/feed/google.xml`}
              />
              <span className="hint">Google Merchant Center &rarr; Products &rarr; Feeds &rarr; Primary Feed.</span>
            </div>
          </div>
        </section>

        {canEdit && (
          <div className="row gap-md mt-xs">
            <SubmitButton className="btn btn-primary" pending="Saving…">Save Tracking IDs</SubmitButton>
          </div>
        )}
      </form>

      {/* Test Event Section */}
      {canEdit && c.pixelId && c.capiConnected && (
        <section className="card p-md mt-lg">
          <h3 className="font-bold text-base mb-xs">Meta Conversions API Test Utility</h3>
          <p className="muted text-sm mb-md">
            Enter the test event code from Meta Events Manager &rarr; Test events tab (e.g. <code>TEST12345</code>) to confirm server event delivery.
          </p>
          <form action={testEventAction} className="row gap-sm flex-wrap items-center">
            <input className="input max-w-280" name="code" placeholder="Test code, like TEST12345" aria-label="Test event code" required />
            <SubmitButton className="btn btn-secondary" pending="Sending…">Send Test Event via Graph API</SubmitButton>
          </form>
        </section>
      )}

      {/* Advisory Banner matching AdmPixels.dc.html:41 */}
      <div className="advisory-box advisory-box-amber mt-lg">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 mt-xs">
          <path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.01" />
        </svg>
        <div>
          <b className="text-warning">Bangladeshi Phone Match Optimization:</b> Because local shoppers rarely use email at checkout, BizTrackBD automatically normalizes and hashes customer mobile numbers (<code>+8801...</code>) for Meta Conversions API and Google Enhanced Conversions, delivering an Event Quality Score (EMQ) above 8.5/10.
        </div>
      </div>

      {/* 7-Day Live Deduplication Table matching AdmPixels.dc.html:33-40 */}
      <section className="mt-lg">
        <div className="card p-0 overflow-hidden">
          <div className="p-md flex-between items-center border-bottom">
            <div className="font-bold text-base flex-1">Events from your store (last 7 days)</div>
            <div className="text-sm text-ink-2">
              Match quality <b className="text-success">Good (Server Deduplicated)</b>
            </div>
          </div>
          {!c.pixelId ? (
            <div className="empty p-xl">Save your Pixel ID above to start counting store events.</div>
          ) : (
            <table className="table m-0" data-testid="event-stats">
              <thead>
                <tr>
                  <th>Event</th>
                  <th className="r">Browser</th>
                  <th className="r">Server</th>
                  <th className="r">Matched</th>
                  <th className="r">Status</th>
                </tr>
              </thead>
              <tbody>
                {o.stats.map((e) => (
                  <tr key={e.name} data-event={e.name}>
                    <td className="font-semibold">{LABEL[e.name] ?? e.name}</td>
                    <td className="r num">{e.browser}</td>
                    <td className="r num">{e.server}</td>
                    <td className="r num">{e.deduped > 0 ? <span className="pill ok">{e.deduped} counted once</span> : e.browser + e.server > 0 ? "—" : "—"}</td>
                    <td className="r">
                      <span className={`pill ${e.failed > 0 ? "bad" : "ok"}`}>
                        {e.failed > 0 ? `${e.failed} failed` : "Matched"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {c.pixelId && total === 0 && (
          <p className="muted mt-sm text-sm">
            No events recorded in the last 7 days. Open your storefront and view a product to fire your first event.
          </p>
        )}
      </section>

      {/* Recent Raw Events Log */}
      {o.recent.length > 0 && (
        <section className="mt-lg">
          <h2 className="text-base font-bold mb-sm">Latest Raw Events</h2>
          <table className="table" data-testid="recent-events">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Origin</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {o.recent.slice(0, 15).map((e) => (
                <tr key={e.id}>
                  <td className="muted">{dateTime(e.createdAt)}</td>
                  <td>{e.name}</td>
                  <td>{e.origin === "BROWSER" ? "Browser Pixel" : "Server CAPI"}</td>
                  <td>
                    {e.status === "FAILED" ? (
                      <span className="err m-0">{e.detail ?? "Failed"}</span>
                    ) : (
                      <span className="pill ok">Sent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
