import type { Metadata } from "next";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ad Analytics & Error Tracking" };

const POSTHOG_PROJECT_ID = "334005"; // PostHog Project ID or direct project URL
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const POSTHOG_APP_URL = "https://us.posthog.com";

export default async function AnalyticsPage() {
  await requireAccess("tenants");

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1>Facebook Ads, Traffic & Error Analytics</h1>
          <p style={{ margin: "4px 0 0", color: "var(--ink-3)", fontSize: 13.5 }}>
            Real-time visitor journeys, Facebook ad campaign attribution, session recordings, and client-side error captures via PostHog.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            href={`${POSTHOG_APP_URL}/project/recordings`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span>Session Recordings</span> ↗
          </a>
          <a
            href={`${POSTHOG_APP_URL}/project/errors`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span>Error Logs & Exceptions</span> ↗
          </a>
          <a
            href={`${POSTHOG_APP_URL}/insights`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span>Insights & Funnels</span> ↗
          </a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Facebook Ads Tracking
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: "var(--brand-primary, #0B4D3B)" }}>
            Active & Auto-Capturing
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 6, margin: 0 }}>
            Captures <code>fbclid</code>, <code>_fbc</code>, UTM source, campaign, and ad set parameters on every visit.
          </p>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Session Recordings
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: "#2563EB" }}>
            Replays Enabled
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 6, margin: 0 }}>
            Watch the full visual replay of what users clicked, typed, and viewed before signing up or leaving.
          </p>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Error & Issue Detection
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: "#D97706" }}>
            Automatic Capture
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 6, margin: 0 }}>
            Uncaught JavaScript exceptions and network errors trigger instant incident logs with stack traces.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Quick PostHog Workspaces</div>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Connected to {POSTHOG_HOST}</span>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16, background: "var(--bg)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700 }}>1. Facebook Ad Campaigns & Funnels</h3>
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 12px" }}>
              Analyze conversion rates from ad click to completed merchant registration.
            </p>
            <a href={`${POSTHOG_APP_URL}/insights?insight=FUNNELS`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              Open Funnel Analysis ↗
            </a>
          </div>

          <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16, background: "var(--bg)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700 }}>2. Watch User Session Recordings</h3>
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 12px" }}>
              Filter recordings by referrer (e.g. <code>facebook.com</code>) to see how ad visitors navigate your site.
            </p>
            <a href={`${POSTHOG_APP_URL}/project/recordings?filters=%5B%7B%22type%22%3A%22event%22%2C%22id%22%3A%22%24pageview%22%7D%5D`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              Watch Ad Visitor Sessions ↗
            </a>
          </div>

          <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16, background: "var(--bg)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700 }}>3. Frontend Error & Issue Tracking</h3>
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 12px" }}>
              Inspect client errors encountered by visitors in real time along with the recording of the crash.
            </p>
            <a href={`${POSTHOG_APP_URL}/project/errors`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
              View Error Stack Traces ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
