import type { Metadata } from "next";
import Link from "next/link";
import { getPlatformTrackingDiagnostics } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Platform Tracking & CAPI Diagnostics — BizTrackBD" };

export default async function PlatformTrackingDiagnosticsPage() {
  await requireAccess("settings");
  const diag = await getPlatformTrackingDiagnostics();

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Platform Tracking &amp; Conversions API Diagnostics</h1>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 4 }}>
            System-level health for BizTrackBD marketing attribution and Meta Conversions API (CAPI).
          </div>
        </div>
        <div>
          <Link href="/inquiries" className="btn btn-secondary btn-sm">
            ← View Platform Inquiries
          </Link>
        </div>
      </div>

      {/* KPI Status Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>Platform Meta Pixel</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: diag.pixelConfigured ? "#15803D" : "#DC2626" }} />
            {diag.pixelConfigured ? "Configured" : "Missing Pixel ID"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
            {diag.pixelIdMasked ? `ID: ${diag.pixelIdMasked}` : "PLATFORM_META_PIXEL_ID not set"}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>Meta Conversions API (CAPI)</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: diag.capiConfigured ? "#15803D" : "#DC2626" }} />
            {diag.capiConfigured ? "Active (Server Ready)" : "Token Missing"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
            {diag.capiConfigured ? "System access token loaded" : "PLATFORM_META_CAPI_TOKEN not set"}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>Sandbox Test Event Code</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
            {diag.testCodeConfigured ? "Test Mode Active" : "Production Mode"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
            {diag.testCodeConfigured ? "Events routed to Meta Sandbox" : "Events route to production pixel"}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)" }}>Inbound Marketing Inquiries</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--brand)", marginTop: 4 }}>
            {diag.totalInquiriesCount} Total
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
            Leads captured from /contact desk
          </div>
        </div>
      </div>

      {/* Architecture Spec Card */}
      <section className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>Attribution &amp; CAPI Pipeline Architecture</h3>
        <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 12px" }}>
          BizTrackBD implements dual first-touch and last-touch attribution with server-side Meta Conversions API (CAPI) resilience:
        </p>
        <ul style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
          <li><b>Client Attribution (DATA-003):</b> Captures <code>utm_source</code>, <code>utm_medium</code>, <code>utm_campaign</code>, <code>referrer</code>, <code>_fbp</code>, and <code>_fbc</code> in 30-day 1st-party cookies (<code>bt_attr_first</code>, <code>bt_attr_last</code>).</li>
          <li><b>Affirmative Consent Gate (DATA-002):</b> Server events are dual-gated; CAPI dispatches only when affirmative consent is granted.</li>
          <li><b>Deduplication (event_id):</b> Client generates a unique UUID on form submit, server dispatches CAPI on 200, and browser fires Meta Pixel with the identical event ID.</li>
          <li><b>Zero PII Leakage:</b> Plaintext customer names, emails, and phone numbers are stripped from client events and strictly hashed via SHA-256 on the server.</li>
        </ul>
      </section>

      {/* Recent Inquiries Ledger */}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, flexGrow: 1 }}>Recent Platform Inquiries &amp; Attribution Logs</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Latest 20 submissions</div>
        </div>

        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Topic</th>
              <th>Contact Details</th>
              <th>Status</th>
              <th className="r">When</th>
            </tr>
          </thead>
          <tbody>
            {diag.recentInquiries.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--ink-3)" }}>
                  No marketing inquiries submitted yet.
                </td>
              </tr>
            ) : (
              diag.recentInquiries.map((inq) => (
                <tr key={inq.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>#{inq.id.slice(-6)}</td>
                  <td style={{ fontWeight: 600 }}>{inq.name}</td>
                  <td>
                    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--tint)", color: "var(--brand)" }}>
                      {inq.topic}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                      {inq.hasPhone ? "📱 Phone" : ""} {inq.hasEmail ? "✉️ Email" : ""}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${inq.status === "NEW" ? "ok" : "muted"}`}>
                      {inq.status}
                    </span>
                  </td>
                  <td className="r muted" style={{ fontSize: 12 }}>
                    {new Date(inq.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Dhaka",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
