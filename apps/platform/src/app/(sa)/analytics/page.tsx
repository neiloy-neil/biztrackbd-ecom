import type { Metadata } from "next";
import Link from "next/link";
import { getAnalyticsDashboardData } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { purgeNoiseAction, resolveErrorAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ad Analytics, Traffic & Error Diagnostics" };

const cell = { padding: "12px 16px", borderBottom: "1px solid var(--line)" } as const;
const headCell = { padding: "12px 16px", borderBottom: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink-2)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 } as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAccess("tenants");
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "attribution";

  const data = await getAnalyticsDashboardData();
  const { summary, campaigns, recentVisitors, topPages, recentErrors } = data;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1>Traffic, Facebook Ads & Error Diagnostics</h1>
          <p style={{ margin: "4px 0 0", color: "var(--ink-3)", fontSize: 13.5 }}>
            100% native first-party tracking stored directly in your Supabase database. Real-time Facebook ad conversions, visitor journeys, and client-side error traces.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>Total Visitors (30d)</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "var(--ink)" }}>{summary.totalVisitors.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{summary.totalPageviews.toLocaleString()} pageviews</div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>Facebook Ad Traffic</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "#1877F2" }}>{summary.fbAdVisitors.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>Tracked via fbclid &amp; UTM</div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>Signup Conversions</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "var(--brand-primary, #0B4D3B)" }}>{summary.totalSignups.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{summary.conversionRate}% conversion rate</div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>Active Client Errors</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: summary.activeErrors > 0 ? "var(--danger, #DC2626)" : "var(--success, #059669)" }}>
            {summary.activeErrors}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{summary.activeErrors === 0 ? "Zero errors detected" : "Requires attention"}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
        <Link
          href="/analytics?tab=attribution"
          className={`btn btn-sm ${tab === "attribution" ? "btn-primary" : "btn-secondary"}`}
          prefetch={false}
        >
          Facebook Ads &amp; Attribution
        </Link>
        <Link
          href="/analytics?tab=visitors"
          className={`btn btn-sm ${tab === "visitors" ? "btn-primary" : "btn-secondary"}`}
          prefetch={false}
        >
          Live Visitor Journeys ({recentVisitors.length})
        </Link>
        <Link
          href="/analytics?tab=errors"
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
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>
              Facebook Ad Campaign Attribution
            </div>
            {campaigns.length === 0 ? (
              <div style={{ padding: 36, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
                No Facebook Ad campaigns tracked yet. Visitors arriving with <code>utm_campaign</code> or <code>fbclid</code> will automatically populate this table.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr>
                    <th style={headCell}>Campaign</th>
                    <th style={headCell}>Source / Medium</th>
                    <th style={headCell}>Visitors</th>
                    <th style={headCell}>Signups</th>
                    <th style={headCell}>Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr key={i}>
                      <td style={{ ...cell, fontWeight: 600 }}>{c.campaign}</td>
                      <td style={cell}>
                        <span className="pill grey">{c.source}</span>
                      </td>
                      <td style={cell}>{c.visitors.toLocaleString()}</td>
                      <td style={cell}>
                        <strong style={{ color: "var(--brand-primary, #0B4D3B)" }}>{c.signups}</strong>
                      </td>
                      <td style={cell}>{c.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>
              Top Viewed Pages (30d)
            </div>
            {topPages.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
                No pageviews recorded yet.
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
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>
            Recent Visitor Sessions (Real-Time Feed)
          </div>
          {recentVisitors.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
              No visitors recorded yet. Visit your site to see real-time sessions stream here.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  <th style={headCell}>Time</th>
                  <th style={headCell}>Entry Page</th>
                  <th style={headCell}>Campaign / Referrer</th>
                  <th style={headCell}>Device &amp; Browser</th>
                  <th style={headCell}>Actions</th>
                  <th style={headCell}>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {recentVisitors.map((v) => (
                  <tr key={v.id}>
                    <td style={{ ...cell, fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                      {new Date(v.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td style={{ ...cell, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <code style={{ fontSize: 12 }}>{v.landingPage}</code>
                    </td>
                    <td style={cell}>
                      {v.campaign ? (
                        <span className="pill ok" style={{ fontSize: 11 }}>Ad: {v.campaign}</span>
                      ) : v.referrer ? (
                        <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{v.referrer.replace(/^https?:\/\//, "").slice(0, 30)}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Direct</span>
                      )}
                    </td>
                    <td style={{ ...cell, fontSize: 12.5 }}>
                      {v.device === "mobile" ? "📱 Mobile" : "💻 Desktop"} · {v.browser || "Browser"}
                    </td>
                    <td style={{ ...cell, fontSize: 12.5 }}>
                      {v.eventCount} {v.eventCount === 1 ? "page" : "pages"} ({v.durationSeconds}s)
                    </td>
                    <td style={cell}>
                      {v.converted ? (
                        <span className="pill ok">🎉 Signed Up</span>
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
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
              ✨ No client errors detected! Your users are experiencing a smooth journey.
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
                    <span><strong>URL:</strong> {err.pageUrl}</span>
                    <span><strong>Device:</strong> {err.device || "desktop"} · {err.browser || "unknown"}</span>
                    <span><strong>Last seen:</strong> {new Date(err.lastOccurredAt).toLocaleString("en-GB")}</span>
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
