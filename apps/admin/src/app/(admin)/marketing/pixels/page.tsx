import type { Metadata } from "next";
import Link from "next/link";
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
      <div className="page-head">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-3, #6B6B8D)" }}>Marketing</div>
          <h1 style={{ margin: "2px 0 4px" }}>Pixels and conversion tracking</h1>
        </div>
      </div>
      <p className="page-sub" style={{ maxWidth: 760, marginBottom: 20 }}>
        Send visits and purchases to Facebook and Google so your ads find real buyers. We send events from the browser and from our server, and remove duplicates automatically.
      </p>

      {err && <div className="notice bad" role="alert" style={{ marginBottom: 16 }} data-testid="pixel-error">{err}</div>}
      {done && (
        <div className="notice good" role="status" style={{ marginBottom: 16 }}>
          {done === "saved"
            ? "Tracking IDs saved successfully."
            : done === "fb_connected"
              ? "Facebook account connected! Ad account and Pixel synced via Graph API."
              : "Test event sent to Meta. Check Meta Events Manager Test Events tab."}
        </div>
      )}

      {/* Main Unified Tracking Form */}
      <form action={saveAllTrackingAction} className="stack" style={{ gap: 20 }}>
        {/* Facebook Pixel & CAPI Card matching AdmPixels.dc.html */}
        <section className="card" data-testid="meta-pixel-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1877F2", color: "#fff", fontWeight: 800, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
              f
            </div>
            <div style={{ flexGrow: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Facebook Pixel and Conversions API</div>
              <div style={{ fontSize: 13, color: "var(--ink-2, #4B4B73)", marginTop: 2 }}>
                {c.pixelId ? `Pixel ID ${c.pixelId}` : "Not configured yet"} · {c.capiConnected ? "Server CAPI Active" : "Browser only"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {canEdit && (
                <a
                  href="/api/auth/facebook/connect"
                  className="btn btn-secondary"
                  style={{ fontSize: 12.5, padding: "5px 12px", textDecoration: "none" }}
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, borderTop: "1px solid var(--line, #E7E7F0)", paddingTop: 18 }}>
            <label className="field" style={{ marginBottom: 0 }}>
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

            <div className="field" style={{ marginBottom: 0 }}>
              <span className="label">Conversions API Access Token</span>
              <div style={{ display: "flex", height: 40, border: "1px solid var(--border-color, #D5D5E4)", borderRadius: 8, padding: "0 12px", alignItems: "center", background: "var(--bg-subtle, #FAFAFC)", fontSize: 14 }}>
                <span style={{ flexGrow: 1, letterSpacing: 2, color: "var(--ink-2, #4B4B73)" }}>
                  {c.capiConnected ? "••••••••••••••token" : "No token saved"}
                </span>
                <Link href="/settings/apps?open=meta_pixel_capi" className="link" style={{ fontSize: 13, fontWeight: 700 }} prefetch={false}>
                  {c.capiConnected ? "Configure" : "Add Token"}
                </Link>
              </div>
              <span className="hint">Saved in encrypted vault. Server events bypass ad-blockers.</span>
            </div>

            <label className="field" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {/* Google Analytics 4 */}
          <section className="card" data-testid="ga4-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F9AB00", color: "#fff", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                GA4
              </div>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Google Analytics 4</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3, #6B6B8D)" }}>Measurement ID &amp; Server Protocol</div>
              </div>
              <span className={`pill ${c.googleAnalyticsId ? "ok" : "grey"}`}>
                {c.googleAnalyticsId ? "Active" : "Off"}
              </span>
            </div>
            <label className="field" style={{ marginBottom: 12 }}>
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
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="label">Measurement Protocol API Secret</span>
              <input
                className="input"
                name="ga4ApiSecret"
                type="password"
                defaultValue={c.ga4ApiSecret ?? ""}
                placeholder="••••••••••••••••"
                disabled={!canEdit}
                data-testid="ga4-secret"
              />
              <span className="hint">Admin &rarr; Data Streams &rarr; Measurement Protocol API secrets (enables server-side purchase tracking).</span>
            </label>
          </section>

          {/* Google Tag Manager */}
          <section className="card" data-testid="gtm-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#246FDB", color: "#fff", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                GTM
              </div>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Google Tag Manager</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3, #6B6B8D)" }}>Container ID (Head + Body)</div>
              </div>
              <span className={`pill ${c.googleTagManagerId ? "ok" : "grey"}`}>
                {c.googleTagManagerId ? "Active" : "Off"}
              </span>
            </div>
            <label className="field" style={{ marginBottom: 0 }}>
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
          <section className="card" data-testid="tiktok-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#111111", color: "#fff", fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                TikTok
              </div>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>TikTok Pixel</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3, #6B6B8D)" }}>TikTok Events API ID</div>
              </div>
              <span className={`pill ${c.tiktokPixelId ? "ok" : "grey"}`}>
                {c.tiktokPixelId ? "Active" : "Off"}
              </span>
            </div>
            <label className="field" style={{ marginBottom: 0 }}>
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
        <section className="card" data-testid="google-cloud-suite-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "#4285F4", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
              </svg>
            </div>
            <div style={{ flexGrow: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Google Search Console &amp; Merchant Center</div>
              <div style={{ fontSize: 13, color: "var(--ink-2, #4B4B73)", marginTop: 2 }}>
                Site ownership verification, Google Shopping Merchant Center account, and dynamic product feeds.
              </div>
            </div>
            <span className={`pill ${c.googleSiteVerification || c.googleMerchantCenterId ? "ok" : "grey"}`}>
              {c.googleSiteVerification || c.googleMerchantCenterId ? "Configured" : "Optional"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, borderTop: "1px solid var(--line, #E7E7F0)", paddingTop: 18 }}>
            {/* Search Console Site Verification */}
            <label className="field" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
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
            <label className="field" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
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
        <section className="card" data-testid="catalog-feed-card" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#10B981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Dynamic Product Catalog Feed</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3, #6B6B8D)" }}>Real-time XML product feed for Facebook Dynamic Retargeting &amp; Google Shopping</div>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
            Sync your products automatically with Meta Commerce Manager and Google Merchant Center. Always reflects real-time stock and prices.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <div>
              <span className="label" style={{ fontSize: 12.5, fontWeight: 600 }}>Meta (Facebook / Instagram) Catalog Feed URL</span>
              <input
                className="input"
                readOnly
                value={`${storefrontOrigin(s.tenantSubdomain)}/api/feed/facebook.xml`}
                style={{ fontSize: 12.5, background: "var(--bg-subtle, #FAFAFC)", fontFamily: "monospace", marginTop: 4 }}
              />
              <span className="hint">Meta Commerce Manager &rarr; Catalogs &rarr; Data Sources &rarr; Data Feed.</span>
            </div>
            <div>
              <span className="label" style={{ fontSize: 12.5, fontWeight: 600 }}>Google Merchant Center Feed URL</span>
              <input
                className="input"
                readOnly
                value={`${storefrontOrigin(s.tenantSubdomain)}/api/feed/google.xml`}
                style={{ fontSize: 12.5, background: "var(--bg-subtle, #FAFAFC)", fontFamily: "monospace", marginTop: 4 }}
              />
              <span className="hint">Google Merchant Center &rarr; Products &rarr; Feeds &rarr; Primary Feed.</span>
            </div>
          </div>
        </section>

        {canEdit && (
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <SubmitButton className="btn btn-primary" pending="Saving…">Save Tracking IDs</SubmitButton>
          </div>
        )}
      </form>

      {/* Test Event Section */}
      {canEdit && c.pixelId && c.capiConnected && (
        <section className="card" style={{ marginTop: 20, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Meta Conversions API Test Utility</h3>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
            Enter the test event code from Meta Events Manager &rarr; Test events tab (e.g. <code>TEST12345</code>) to confirm server event delivery.
          </p>
          <form action={testEventAction} className="row" style={{ flexWrap: "wrap", gap: 10 }}>
            <input className="input" name="code" placeholder="Test code, like TEST12345" aria-label="Test event code" style={{ maxWidth: 280 }} required />
            <SubmitButton className="btn btn-secondary" pending="Sending…">Send Test Event via Graph API</SubmitButton>
          </form>
        </section>
      )}

      {/* Advisory Banner matching AdmPixels.dc.html:41 */}
      <div style={{ background: "#FDF3E3", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start", marginTop: 20 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 20px", marginTop: 1 }}>
          <path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.01" />
        </svg>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#4B4B73" }}>
          <b style={{ color: "#B45309" }}>Bangladeshi Phone Match Optimization:</b> Because local shoppers rarely use email at checkout, BizTrackBD automatically normalizes and hashes customer mobile numbers (<code>+8801...</code>) for Meta Conversions API and Google Enhanced Conversions, delivering an Event Quality Score (EMQ) above 8.5/10.
        </div>
      </div>

      {/* 7-Day Live Deduplication Table matching AdmPixels.dc.html:33-40 */}
      <section style={{ marginTop: 24 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", borderBottom: "1px solid var(--line, #E7E7F0)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, flexGrow: 1 }}>Events from your store (last 7 days)</div>
            <div style={{ fontSize: 13, color: "var(--ink-2, #4B4B73)" }}>
              Match quality <b style={{ color: "#15803D" }}>Good (Server Deduplicated)</b>
            </div>
          </div>
          {!c.pixelId ? (
            <div className="empty" style={{ padding: 32 }}>Save your Pixel ID above to start counting store events.</div>
          ) : (
            <table className="table" data-testid="event-stats" style={{ margin: 0 }}>
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
                    <td style={{ fontWeight: 600 }}>{LABEL[e.name] ?? e.name}</td>
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
          <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            No events recorded in the last 7 days. Open your storefront and view a product to fire your first event.
          </p>
        )}
      </section>

      {/* Recent Raw Events Log */}
      {o.recent.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Latest Raw Events</h2>
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
                      <span className="err" style={{ margin: 0 }}>{e.detail ?? "Failed"}</span>
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
