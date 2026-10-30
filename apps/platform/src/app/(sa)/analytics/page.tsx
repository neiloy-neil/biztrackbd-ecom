import type { Metadata } from "next";
import Link from "next/link";
import { getAnalyticsDashboardData } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { purgeNoiseAction, resolveErrorAction } from "./actions";
import { AutoRefreshControl } from "./auto-refresh";
import { AnalyticsFilterBar } from "./date-filter";
import { AnalyticsTrendChart } from "./trend-chart";
import { AnalyticsConversionFunnel } from "./conversion-funnel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ad Analytics, Traffic & Error Diagnostics" };

const cell = { padding: "12px 16px", borderBottom: "1px solid var(--line)" } as const;
const headCell = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--line)",
  background: "var(--bg)",
  color: "var(--ink-2)",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
} as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAccess("tenants");
  const sp = await searchParams;

  const tab = typeof sp.tab === "string" ? sp.tab : "attribution";
  const range = typeof sp.range === "string" ? sp.range : "30";
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;
  const campaign = typeof sp.campaign === "string" ? sp.campaign : undefined;
  const device = typeof sp.device === "string" ? sp.device : undefined;

  const data = await getAnalyticsDashboardData({
    range,
    from,
    to,
    campaign,
    device,
  });

  const {
    summary,
    funnel,
    trend,
    campaigns,
    recentVisitors,
    topPages,
    recentErrors,
    activeRange,
    activeFilters,
  } = data;

  const buildTabUrl = (targetTab: string) => {
    const p = new URLSearchParams();
    p.set("tab", targetTab);
    if (range) p.set("range", range);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (campaign) p.set("campaign", campaign);
    if (device) p.set("device", device);
    return `/analytics?${p.toString()}`;
  };

  const buildCampaignFilterUrl = (campName: string) => {
    const p = new URLSearchParams();
    p.set("tab", tab);
    if (range) p.set("range", range);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    p.set("campaign", campName);
    if (device) p.set("device", device);
    return `/analytics?${p.toString()}`;
  };

  const buildCampaignJourneysUrl = (campName: string) => {
    const p = new URLSearchParams();
    p.set("tab", "visitors");
    if (range) p.set("range", range);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    p.set("campaign", campName);
    if (device) p.set("device", device);
    return `/analytics?${p.toString()}`;
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      {/* Page Header */}
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>Traffic, Facebook Ads &amp; Diagnostics</h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                color: "#065F46",
                borderRadius: 20,
                padding: "3px 10px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
              {summary.activeNow} active on site now
            </span>
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--ink-3)", fontSize: 13.5 }}>
            Native first-party conversion attribution &amp; analytics directly in your database. Currently viewing: <strong>{activeRange.label}</strong>
          </p>
        </div>

        {/* Real-time auto refresh trigger */}
        <AutoRefreshControl />
      </div>

      {/* Dynamic Filter Bar */}
      <AnalyticsFilterBar
        currentPreset={activeRange.presetKey}
        currentFrom={activeRange.from}
        currentTo={activeRange.to}
        currentDevice={activeFilters.device}
        currentCampaign={activeFilters.campaign}
      />

      {/* KPI Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
            Total Visitors ({activeRange.days}d)
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "var(--ink)" }}>
            {summary.totalVisitors.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
            {summary.totalPageviews.toLocaleString()} pageviews
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
            Facebook Ad Traffic
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "#1877F2" }}>
            {summary.fbAdVisitors.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
            {summary.totalVisitors > 0
              ? `${Math.round((summary.fbAdVisitors / summary.totalVisitors) * 1000) / 10}% of total traffic`
              : "Tracked via fbclid & UTM"}
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
            Signup Conversions
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "var(--brand-primary, #0B4D3B)" }}>
            {summary.totalSignups.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
            <strong>{summary.conversionRate}%</strong> overall conversion rate
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
            Active Client Errors
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              marginTop: 6,
              color: summary.activeErrors > 0 ? "var(--danger, #DC2626)" : "var(--success, #059669)",
            }}
          >
            {summary.activeErrors}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
            {summary.activeErrors === 0 ? "Zero errors detected" : "Requires attention"}
          </div>
        </div>
      </div>

      {/* 3-Stage Conversion Funnel Card */}
      <AnalyticsConversionFunnel funnel={funnel} />

      {/* Trend & Traffic Pulse Chart */}
      <AnalyticsTrendChart trend={trend} isHourly={activeRange.days === 1} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
        <Link
          href={buildTabUrl("attribution")}
          className={`btn btn-sm ${tab === "attribution" ? "btn-primary" : "btn-secondary"}`}
          prefetch={false}
        >
          Facebook Ads &amp; Attribution ({campaigns.length})
        </Link>
        <Link
          href={buildTabUrl("visitors")}
          className={`btn btn-sm ${tab === "visitors" ? "btn-primary" : "btn-secondary"}`}
          prefetch={false}
        >
          Visitor Journeys ({recentVisitors.length})
        </Link>
        <Link
          href={buildTabUrl("errors")}
          className={`btn btn-sm ${tab === "errors" ? "btn-primary" : "btn-secondary"}`}
          prefetch={false}
        >
          Frontend Error Traces ({recentErrors.length})
        </Link>
      </div>

      {/* Tab 1: Facebook Ads & Campaign Attribution */}
      {tab === "attribution" && (
        <div className="stack" style={{ gap: 20 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Facebook Ad Campaigns &amp; Creative Breakdown</span>
              {activeFilters.campaign && (
                <Link
                  href={buildCampaignFilterUrl("")}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11.5 }}
                >
                  Show All Campaigns
                </Link>
              )}
            </div>
            {campaigns.length === 0 ? (
              <div style={{ padding: 36, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
                No Facebook Ad campaigns tracked in this date range. Visitors arriving with <code>utm_campaign</code> or <code>fbclid</code> will automatically populate this table.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th style={headCell}>Campaign &amp; Creatives</th>
                    <th style={headCell}>Source / Medium</th>
                    <th style={headCell}>Visitors</th>
                    <th style={headCell}>Signups</th>
                    <th style={headCell}>Conversion Rate</th>
                    <th style={{ ...headCell, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr key={i}>
                      <td style={{ ...cell, verticalAlign: "top" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{c.campaign}</div>
                        {c.creatives && c.creatives.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                            <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600, alignSelf: "center" }}>
                              Creatives:
                            </span>
                            {c.creatives.map((cr, idx) => (
                              <span
                                key={idx}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  background: "var(--bg)",
                                  border: "1px solid var(--line)",
                                  borderRadius: 6,
                                  padding: "3px 8px",
                                  fontSize: 11.5,
                                }}
                              >
                                <span style={{ fontWeight: 600, color: "var(--ink)" }}>{cr.creative}</span>
                                <span style={{ color: "var(--ink-3)" }}>
                                  {cr.visitors} vis &middot;{" "}
                                  <strong style={{ color: "var(--brand-primary, #0B4D3B)" }}>{cr.signups}</strong> signups (
                                  {cr.conversionRate}%)
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ ...cell, verticalAlign: "top" }}>
                        <span className="pill grey">{c.source}</span>
                      </td>
                      <td style={{ ...cell, verticalAlign: "top", fontWeight: 600 }}>{c.visitors.toLocaleString()}</td>
                      <td style={{ ...cell, verticalAlign: "top" }}>
                        <strong style={{ color: "var(--brand-primary, #0B4D3B)", fontSize: 15 }}>{c.signups}</strong>
                      </td>
                      <td style={{ ...cell, verticalAlign: "top" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: c.conversionRate >= 20 ? "var(--brand-primary, #0B4D3B)" : "var(--ink)",
                          }}
                        >
                          {c.conversionRate}%
                        </span>
                      </td>
                      <td style={{ ...cell, verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          <Link
                            href={buildCampaignFilterUrl(c.campaign)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: "2px 8px", height: 26 }}
                          >
                            Filter
                          </Link>
                          <Link
                            href={buildCampaignJourneysUrl(c.campaign)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: "2px 8px", height: 26 }}
                          >
                            Journeys &rarr;
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>
              Top Viewed Pages ({activeRange.days}d)
            </div>
            {topPages.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
                No pageviews recorded in this timeframe.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th style={headCell}>Page Path</th>
                    <th style={{ ...headCell, textAlign: "right" }}>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.map((p, i) => (
                    <tr key={i}>
                      <td style={{ ...cell, fontFamily: "monospace" }}>{p.path}</td>
                      <td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{p.views.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Live Visitor Journeys */}
      {tab === "visitors" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--line)",
              fontWeight: 700,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span>Visitor Sessions Feed</span>
              {activeFilters.campaign && (
                <span style={{ marginLeft: 8, fontSize: 12, color: "#1D4ED8", fontWeight: 600 }}>
                  (Filtered to Campaign: &ldquo;{activeFilters.campaign}&rdquo;)
                </span>
              )}
            </div>
            {activeFilters.campaign && (
              <Link
                href={buildTabUrl("visitors")}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11.5 }}
              >
                Clear Campaign Filter
              </Link>
            )}
          </div>
          {recentVisitors.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
              No visitors recorded in this timeframe with the current filters.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={headCell}>Time</th>
                  <th style={headCell}>Entry Page</th>
                  <th style={headCell}>Campaign / Referrer</th>
                  <th style={headCell}>Device &amp; Browser</th>
                  <th style={headCell}>Activity</th>
                  <th style={headCell}>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {recentVisitors.map((v) => (
                  <tr key={v.id}>
                    <td style={{ ...cell, fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                      <div>{new Date(v.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
                      <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
                        {new Date(v.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </div>
                    </td>
                    <td style={{ ...cell, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <code style={{ fontSize: 12 }}>{v.landingPage}</code>
                    </td>
                    <td style={cell}>
                      {v.campaign ? (
                        <span className="pill ok" style={{ fontSize: 11 }}>
                          Ad: {v.campaign}
                        </span>
                      ) : v.referrer ? (
                        <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{v.referrer.replace(/^https?:\/\//, "").slice(0, 30)}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Direct</span>
                      )}
                    </td>
                    <td style={{ ...cell, fontSize: 12.5 }}>
                      {v.device === "mobile" ? "📱 Mobile" : "💻 Desktop"} &middot; {v.browser || "Browser"}
                    </td>
                    <td style={{ ...cell, fontSize: 12.5 }}>
                      {v.eventCount} {v.eventCount === 1 ? "page" : "pages"} ({v.durationSeconds}s)
                    </td>
                    <td style={cell}>
                      {v.converted ? (
                        <span className="pill ok" style={{ fontWeight: 700 }}>
                          🎉 Signed Up
                        </span>
                      ) : (
                        <span className="pill grey">Browsed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Error Logs & Diagnostics */}
      {tab === "errors" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--line)",
              fontWeight: 700,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Client-Side Exceptions &amp; Runtime Errors</span>
            {recentErrors.length > 0 && (
              <form action={purgeNoiseAction}>
                <button type="submit" className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>
                  Dismiss In-App Browser Noise
                </button>
              </form>
            )}
          </div>
          {recentErrors.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "var(--success, #059669)", fontSize: 14, fontWeight: 600 }}>
              ✨ No client errors detected! Your visitors are experiencing a smooth journey.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentErrors.map((err) => (
                <div key={err.id} style={{ ...cell, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <span className={`pill ${err.status === "NEW" ? "danger" : "grey"}`} style={{ marginRight: 8 }}>
                        {err.status} ({err.count}x)
                      </span>
                      <strong style={{ fontSize: 14, color: "var(--danger, #DC2626)" }}>{err.message}</strong>
                    </div>
                    {err.status === "NEW" && (
                      <form action={resolveErrorAction}>
                        <input type="hidden" name="errorId" value={err.id} />
                        <button type="submit" className="btn btn-secondary btn-sm" style={{ height: 28, fontSize: 12 }}>
                          Mark Resolved
                        </button>
                      </form>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span>
                      <strong>URL:</strong> {err.pageUrl}
                    </span>
                    <span>
                      <strong>Device:</strong> {err.device || "desktop"} &middot; {err.browser || "unknown"}
                    </span>
                    <span>
                      <strong>Last seen:</strong> {new Date(err.lastOccurredAt).toLocaleString("en-GB")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
