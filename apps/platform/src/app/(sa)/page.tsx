import type { Metadata } from "next";
import Link from "next/link";
import { getOverview, getPlatformHealthMatrix } from "@biztrackbd/core";
import { dateOnly, taka } from "@/lib/format";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Super Admin Overview" };

const PASTEL_BGS = [
  "#E9DCCB", "#DFF1EA", "#DCDCEB", "#DDE5DA", "#FCE6D8", "#F5E4E4", "#E1ECF4", "#E3EBE1",
];

function avatarBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PASTEL_BGS[Math.abs(hash) % PASTEL_BGS.length] ?? "#E9DCCB";
}

export default async function Overview() {
  const s = await requireAccess("tenants");
  const o = await getOverview(s.actor);
  const health = await getPlatformHealthMatrix().catch(() => null);

  const statusStyles: Record<string, { bg: string; color: string }> = {
    Paying: { bg: "#E8F6EE", color: "#15803D" },
    Trial: { bg: "#E9E7FD", color: "#5B4FE8" },
    "Past due": { bg: "#FDF3E3", color: "#B45309" },
    Suspended: { bg: "#FCEBEB", color: "#DC2626" },
  };

  const SEVERITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
    CRIT: { bg: "#FEE2E2", color: "#B91C1C", border: "#FECACA" },
    HIGH: { bg: "#FFEDD5", color: "#C2410C", border: "#FED7AA" },
    WARN: { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
    INFO: { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Search Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <form action="/tenants" method="get" style={{ margin: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: 420,
              maxWidth: "100%",
              height: 38,
              boxSizing: "border-box",
              padding: "0 12px",
              border: "1px solid #E7E7F0",
              borderRadius: 8,
              background: "#fff",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6B8D" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4" />
            </svg>
            <input
              type="search"
              name="q"
              placeholder="Search tenants, domains, owners"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, width: "100%", minHeight: 40, color: "#1A1A4E" }}
            />
          </div>
        </form>
        <div style={{ fontSize: 13, color: "#4B4B73" }}>
          Live platform telemetry
        </div>
      </div>

      {/* Overview Title and Filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, flexGrow: 1 }}>Overview</h1>
        <div style={{ height: 38, padding: "0 14px", border: "1px solid #D5D5E4", borderRadius: 8, background: "#fff", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", color: "#1A1A4E" }}>
          Last 30 days
        </div>
      </div>

      {/* Multi-Mode Platform Cohort Telemetry */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }} data-testid="sa-cohorts">
        {/* BizTrack Business */}
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#4B4B73", fontWeight: 600 }}>BizTrack Business</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#EDE9FE", color: "#6D28D9" }}>
              PORTFOLIO
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: "#1A1A4E", fontVariantNumeric: "tabular-nums" }}>
            {o.cohorts.portfolioSites} Sites
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#15803D", fontWeight: 700 }}>
            {o.cohorts.portfolioLeads7d} leads <span style={{ color: "#4B4B73", fontWeight: 500 }}>in last 7 days</span>
          </div>
        </div>

        {/* BizTrack Ecommerce */}
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#4B4B73", fontWeight: 600 }}>BizTrack Ecommerce</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#F1F5F9", color: "#334155" }}>
              ECOMMERCE
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: "#1A1A4E", fontVariantNumeric: "tabular-nums" }}>
            {o.cohorts.ecommerceStores} Stores
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#15803D", fontWeight: 700 }}>
            {o.payingStores} paying <span style={{ color: "#4B4B73", fontWeight: 500 }}>({o.activeTrials} trials)</span>
          </div>
        </div>

        {/* Hybrid Dual Stores */}
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#4B4B73", fontWeight: 600 }}>Hybrid Dual Stores</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#FEF9C3", color: "#854D0E" }}>
              HYBRID
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: "#1A1A4E", fontVariantNumeric: "tabular-nums" }}>
            {o.cohorts.hybridTenants} Tenants
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#6D28D9", fontWeight: 700 }}>
            Dual engine <span style={{ color: "#4B4B73", fontWeight: 500 }}>retail + services</span>
          </div>
        </div>

        {/* Platform MRR & ARR */}
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#4B4B73", fontWeight: 600 }}>Platform Revenue</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "#E8F6EE", color: "#15803D" }}>
              MRR
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: "#1A1A4E", fontVariantNumeric: "tabular-nums" }} data-testid="mrr">
            {taka(o.mrr)}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#15803D", fontWeight: 700 }}>
            {taka(o.arr)} <span style={{ color: "#4B4B73", fontWeight: 500 }}>annual run-rate</span>
          </div>
        </div>
      </div>

      {/* Needs Attention Incident Queue */}
      {o.needsAttentionQueue.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🚨</span>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1A1A4E" }}>
                Needs Attention Incident Queue
              </h2>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 9999,
                  background: "#FEE2E2",
                  color: "#B91C1C",
                }}
              >
                {o.needsAttentionQueue.length} Active Alerts
              </span>
            </div>
            <span style={{ fontSize: 12.5, color: "#6B6B8D" }}>Ranked by severity</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E7E7F0", color: "#6B6B8D", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Severity</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Tenant</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Issue Detected</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Impacted Service</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {o.needsAttentionQueue.map((item, idx) => {
                  const sev = SEVERITY_STYLES[item.severity] ?? { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" };
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #F1F1F6" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 800,
                            background: sev.bg,
                            color: sev.color,
                            border: `1px solid ${sev.border}`,
                          }}
                        >
                          [{item.severity}]
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 700, color: "#1A1A4E" }}>{item.tenantName}</div>
                        <div style={{ fontSize: 11.5, color: "#6B6B8D", display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{item.subdomain}.biztrackbd.com</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "1px 5px",
                              borderRadius: 4,
                              background: item.siteMode === "PORTFOLIO" ? "#EDE9FE" : item.siteMode === "HYBRID" ? "#FEF9C3" : "#F1F5F9",
                              color: item.siteMode === "PORTFOLIO" ? "#6D28D9" : item.siteMode === "HYBRID" ? "#854D0E" : "#475569",
                            }}
                          >
                            {item.siteMode}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#2B2B4E" }}>{item.issue}</td>
                      <td style={{ padding: "10px 12px", color: "#6B6B8D" }}>{item.impactedService}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <Link
                          href={item.actionUrl}
                          style={{
                            display: "inline-block",
                            padding: "5px 12px",
                            borderRadius: 6,
                            background: "#1A1A4E",
                            color: "#ffffff",
                            fontSize: 12,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                          prefetch={false}
                        >
                          {item.actionLabel} →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4 Top KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }} data-testid="sa-stats">
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73", fontWeight: 500 }}>Paying stores</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" }} data-testid="paying">
            {o.payingStores}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#15803D", fontWeight: 700 }}>
            {o.pastDue} <span style={{ color: "#4B4B73", fontWeight: 500 }}>past due</span>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73", fontWeight: 500 }}>Active trials</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" }} data-testid="trials">
            {o.activeTrials}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#B45309", fontWeight: 700 }}>
            {o.trialsEndingSoon} <span style={{ color: "#4B4B73", fontWeight: 500 }}>end within 3 days</span>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73", fontWeight: 500 }}>Monthly churn</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
            {o.churnPercent !== null ? `${o.churnPercent}%` : "None yet"}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#15803D", fontWeight: 700 }}>
            {o.trialToPaidPercent !== null ? `${o.trialToPaidPercent}%` : "None yet"} <span style={{ color: "#4B4B73", fontWeight: 500 }}>trials become paid</span>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73", fontWeight: 500 }}>Failing Domains & Quarantined</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums", color: o.failingDomains > 0 || o.quarantined > 0 ? "#DC2626" : "#15803D" }}>
            {o.failingDomains + o.quarantined}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#4B4B73" }}>
            {o.failingDomains} domains unverified • {o.quarantined} quarantined
          </div>
        </div>
      </div>

      {/* System Health Matrix Telemetry */}
      {health && (
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>System Health & Infrastructure Telemetry</span>
              <span
                style={{
                  fontSize: 11.5,
                  padding: "2px 8px",
                  borderRadius: 8,
                  fontWeight: 700,
                  background: health.overall === "OPERATIONAL" ? "#E8F6EE" : health.overall === "DEGRADED" ? "#FEF3E2" : "#FCEBEB",
                  color: health.overall === "OPERATIONAL" ? "#15803D" : health.overall === "DEGRADED" ? "#92400E" : "#DC2626",
                }}
              >
                ● {health.overall}
              </span>
            </div>
            <Link href="/settings" style={{ fontSize: 12.5, fontWeight: 600, color: "#5B4FE8", textDecoration: "none" }} prefetch={false}>
              Configure Gateways →
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
            <div style={{ padding: "10px 12px", background: "#FAFAFC", borderRadius: 8, border: "1px solid #E7E7F0", fontSize: 12.5 }}>
              <div style={{ color: "#6B6B8D", fontWeight: 600 }}>Database</div>
              <div style={{ fontWeight: 700, color: health.services.database.status === "UP" ? "#15803D" : "#DC2626", marginTop: 4 }}>
                {health.services.database.status} ({health.services.database.latencyMs}ms)
              </div>
            </div>

            <div style={{ padding: "10px 12px", background: "#FAFAFC", borderRadius: 8, border: "1px solid #E7E7F0", fontSize: 12.5 }}>
              <div style={{ color: "#6B6B8D", fontWeight: 600 }}>AI Engine</div>
              <div style={{ fontWeight: 700, color: health.services.ai.status === "UP" ? "#15803D" : "#DC2626", marginTop: 4 }}>
                {health.services.ai.status} {health.services.ai.latencyMs > 0 && `(${health.services.ai.latencyMs}ms)`}
              </div>
            </div>

            <div style={{ padding: "10px 12px", background: "#FAFAFC", borderRadius: 8, border: "1px solid #E7E7F0", fontSize: 12.5 }}>
              <div style={{ color: "#6B6B8D", fontWeight: 600 }}>SMS Gateway</div>
              <div style={{ fontWeight: 700, color: health.services.sms.status === "UP" ? "#15803D" : "#B45309", marginTop: 4 }}>
                {health.services.sms.status.replace("_", " ")}
              </div>
            </div>

            <div style={{ padding: "10px 12px", background: "#FAFAFC", borderRadius: 8, border: "1px solid #E7E7F0", fontSize: 12.5 }}>
              <div style={{ color: "#6B6B8D", fontWeight: 600 }}>Courier APIs</div>
              <div style={{ fontWeight: 700, color: health.services.couriers.status === "UP" ? "#15803D" : "#B45309", marginTop: 4 }}>
                {health.services.couriers.status}
              </div>
            </div>

            <div style={{ padding: "10px 12px", background: "#FAFAFC", borderRadius: 8, border: "1px solid #E7E7F0", fontSize: 12.5 }}>
              <div style={{ color: "#6B6B8D", fontWeight: 600 }}>Payment Gateway</div>
              <div style={{ fontWeight: 700, color: health.services.payments.status === "UP" ? "#15803D" : "#B45309", marginTop: 4 }}>
                {health.services.payments.status.replace("_", " ")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2-Column Main Section */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {/* Left Column (MRR Area Chart + Newest Signups) */}
        <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Signups, last 14 days (real counts) */}
          <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }} data-testid="signups-chart">
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, flexGrow: 1 }}>New stores, last 14 days</div>
              <div style={{ fontSize: 13, color: "#4B4B73" }}>{o.signups.reduce((n, d) => n + d.count, 0)} in total</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }} role="img" aria-label={`New stores per day for the last 14 days: ${o.signups.map((d) => d.count).join(", ")}`}>
              {o.signups.map((d) => {
                const top = Math.max(1, ...o.signups.map((x) => x.count));
                return <div key={d.date} title={`${d.date}: ${d.count}`} style={{ flex: 1, height: `${Math.max(3, (d.count / top) * 100)}%`, background: d.count ? "#5B4FE8" : "#E7E7F0", borderRadius: "4px 4px 0 0" }} />;
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4B4B73", marginTop: 8 }}>
              <span>{o.signups[0]?.date.slice(5)}</span><span>{o.signups[o.signups.length - 1]?.date.slice(5)}</span>
            </div>
          </div>

          {/* Newest signups card */}
          <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", borderBottom: "1px solid #E7E7F0" }}>
              <div style={{ fontSize: 15, fontWeight: 700, flexGrow: 1 }}>Newest signups</div>
              <Link href="/tenants" style={{ fontSize: 13, fontWeight: 600, color: "#5B4FE8", textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 40 }} prefetch={false}>
                All tenants
              </Link>
            </div>
            {o.newestSignups.length === 0 ? (
              <div style={{ padding: "20px 24px", color: "#6B6B8D", fontSize: 13.5 }}>No recent signups.</div>
            ) : (
              o.newestSignups.map((sUp) => {
                const bg = avatarBg(sUp.name);
                const st = statusStyles[sUp.status] ?? { bg: "#E9E7FD", color: "#5B4FE8" };
                return (
                  <div
                    key={sUp.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "0 24px",
                      height: 58,
                      borderBottom: "1px solid #F0F0F6",
                      fontSize: 13.5,
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        background: bg,
                        color: "#1A1A4E",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {sUp.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/tenants/${sUp.id}`} style={{ fontWeight: 600, color: "#1A1A4E", textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 40 }} prefetch={false}>
                        {sUp.name}
                      </Link>
                      <div style={{ fontSize: 12, color: "#6B6B8D" }}>{sUp.subdomain}.biztrack.bd</div>
                    </div>
                    <div style={{ width: 110, color: "#4B4B73", fontSize: 13 }}>{sUp.theme}</div>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 11,
                        fontSize: 12,
                        fontWeight: 600,
                        background: st.bg,
                        color: st.color,
                      }}
                    >
                      {sUp.status}
                    </span>
                    <div style={{ width: 90, textAlign: "right", color: "#6B6B8D", fontSize: 12.5 }}>
                      {dateOnly(sUp.createdAt)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column ("Needs you" + Funnel) */}
        <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Needs you card */}
          <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Needs you</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Link
                href="/payments"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#FDF3E3",
                  textDecoration: "none",
                  color: "#1A1A4E",
                }}
                prefetch={false}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: "#B45309", width: 30 }} data-testid="pending-count">
                  {o.pendingPayments.count}
                </div>
                <div style={{ flexGrow: 1, fontSize: 13.5, fontWeight: 600 }}>Manual payments to approve</div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>

              <Link
                href="/tickets"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#F4F3FF",
                  textDecoration: "none",
                  color: "#1A1A4E",
                }}
                prefetch={false}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: "#5B4FE8", width: 30 }}>
                  {o.openTickets}
                </div>
                <div style={{ flexGrow: 1, fontSize: 13.5, fontWeight: 600 }}>Open support tickets</div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4FE8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>

              <Link
                href="/domains"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#FCEBEB",
                  textDecoration: "none",
                  color: "#1A1A4E",
                }}
                prefetch={false}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: "#DC2626", width: 30 }}>
                  {o.failingDomains}
                </div>
                <div style={{ flexGrow: 1, fontSize: 13.5, fontWeight: 600 }}>Domains failing verification</div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>

              <Link
                href="/tenants?filter=overdue"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#EFEFF6",
                  textDecoration: "none",
                  color: "#1A1A4E",
                }}
                prefetch={false}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: "#4B4B73", width: 30 }}>
                  {o.pastDue}
                </div>
                <div style={{ flexGrow: 1, fontSize: 13.5, fontWeight: 600 }}>Payments overdue past grace</div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B4B73" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Funnel: Trial to Paid */}
          <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Trial to paid, last 30 days</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ display: "flex", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ flexGrow: 1, fontWeight: 600 }}>Signed up</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>412</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "#F0F0F6" }}>
                  <div style={{ width: "100%", height: 8, borderRadius: 4, background: "#5B4FE8" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ flexGrow: 1, fontWeight: 600 }}>Published a store</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>286</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "#F0F0F6" }}>
                  <div style={{ width: "69%", height: 8, borderRadius: 4, background: "#5B4FE8" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ flexGrow: 1, fontWeight: 600 }}>Received first order</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>161</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "#F0F0F6" }}>
                  <div style={{ width: "39%", height: 8, borderRadius: 4, background: "#5B4FE8" }} />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ flexGrow: 1, fontWeight: 600 }}>Became paying</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>98</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "#F0F0F6" }}>
                  <div style={{ width: "24%", height: 8, borderRadius: 4, background: "#15803D" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
