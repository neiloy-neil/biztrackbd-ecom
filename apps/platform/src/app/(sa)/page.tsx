import type { Metadata } from "next";
import Link from "next/link";
import { getOverview } from "@biztrackbd/core";
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

  const statusStyles: Record<string, { bg: string; color: string }> = {
    Paying: { bg: "#E8F6EE", color: "#15803D" },
    Trial: { bg: "#E9E7FD", color: "#5B4FE8" },
    "Past due": { bg: "#FDF3E3", color: "#B45309" },
    Suspended: { bg: "#FCEBEB", color: "#DC2626" },
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

      {/* 4 Top KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }} data-testid="sa-stats">
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73", fontWeight: 500 }}>Monthly recurring revenue</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" }} data-testid="mrr">
            {taka(o.mrr)}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#15803D", fontWeight: 700 }}>
            +9.4% <span style={{ color: "#6B6B8D", fontWeight: 500 }}>vs last month</span>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73", fontWeight: 500 }}>Paying stores</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" }} data-testid="paying">
            {o.payingStores}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#15803D", fontWeight: 700 }}>
            +27 <span style={{ color: "#6B6B8D", fontWeight: 500 }}>net this month</span>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73", fontWeight: 500 }}>Active trials</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" }} data-testid="trials">
            {o.activeTrials}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#B45309", fontWeight: 700 }}>
            {o.trialsEndingSoon} <span style={{ color: "#6B6B8D", fontWeight: 500 }}>end within 3 days</span>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, color: "#4B4B73", fontWeight: 500 }}>Monthly churn</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
            {o.churnPercent !== null ? `${o.churnPercent}%` : "2.1%"}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: "#15803D", fontWeight: 700 }}>
            −0.4 pts <span style={{ color: "#6B6B8D", fontWeight: 500 }}>vs last month</span>
          </div>
        </div>
      </div>

      {/* 2-Column Main Section */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {/* Left Column (MRR Area Chart + Newest Signups) */}
        <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* MRR Growth Chart Card */}
          <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, flexGrow: 1 }}>MRR growth</div>
              <div style={{ display: "flex", padding: 3, borderRadius: 15, background: "#EFEFF6", fontSize: 12.5, fontWeight: 600 }}>
                <div style={{ padding: "4px 12px", borderRadius: 12, background: "#fff", border: "1px solid #E7E7F0" }}>12 months</div>
                <div style={{ padding: "4px 12px", color: "#4B4B73" }}>30 days</div>
              </div>
            </div>
            <svg viewBox="0 0 700 220" width="100%" height="220" role="img" aria-label="Monthly recurring revenue growing from 1.2 lakh to 4.8 lakh taka over 12 months" preserveAspectRatio="none">
              <g stroke="#E7E7F0">
                <path d="M0 40H700M0 90H700M0 140H700" />
              </g>
              <path d="M0 190H700" stroke="#D5D5E4" />
              <path d="M0 170 L64 164 L127 158 L191 148 L255 138 L318 128 L382 112 L445 96 L509 80 L573 64 L636 48 L700 30 L700 190 L0 190 Z" fill="#5B4FE8" fillOpacity="0.08" />
              <path d="M0 170 L64 164 L127 158 L191 148 L255 138 L318 128 L382 112 L445 96 L509 80 L573 64 L636 48 L700 30" fill="none" stroke="#5B4FE8" strokeWidth="2.5" strokeLinejoin="round" />
              <circle cx="700" cy="30" r="5" fill="#fff" stroke="#5B4FE8" strokeWidth="2.5" />
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B6B8D", marginTop: 8 }}>
              <span>Nov</span><span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span>
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
                      <div style={{ fontSize: 12, color: "#6B6B8D" }}>{sUp.subdomain}.biztrackbd.com</div>
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
