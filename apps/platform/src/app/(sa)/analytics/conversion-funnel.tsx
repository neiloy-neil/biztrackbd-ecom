import type { ConversionFunnel } from "@biztrackbd/core";

export function AnalyticsConversionFunnel({ funnel }: { funnel: ConversionFunnel }) {
  const {
    visitors,
    wizardStarted,
    completedSignup,
    visitorToWizardRate,
    wizardToSignupRate,
    overallConversionRate,
  } = funnel;

  return (
    <div className="card" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Signup Conversion Funnel
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
            From landing page entry to completed merchant store launch
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--brand-primary, #0B4D3B)" }}>
          {overallConversionRate}% Overall Conversion Rate
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr auto 1fr",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Stage 1: All Visitors */}
        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
            1. Total Visitors
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>
            {visitors.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
            100% of traffic
          </div>
          <div style={{ width: "100%", height: 6, background: "#E2E8F0", borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%", background: "#3B82F6" }} />
          </div>
        </div>

        {/* Arrow 1 */}
        <div style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12, minWidth: 80 }}>
          <div style={{ fontWeight: 700, color: visitorToWizardRate >= 30 ? "var(--brand-primary, #0B4D3B)" : "var(--ink-2)" }}>
            {visitorToWizardRate}%
          </div>
          <div style={{ fontSize: 18, lineHeight: 1 }}>&rarr;</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
            {Math.max(0, Math.round((100 - visitorToWizardRate) * 10) / 10)}% bounce
          </div>
        </div>

        {/* Stage 2: Started Wizard */}
        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
            2. Reached Wizard (/start)
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#2563EB", marginTop: 4 }}>
            {wizardStarted.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
            {visitorToWizardRate}% reached onboarding
          </div>
          <div style={{ width: "100%", height: 6, background: "#E2E8F0", borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, visitorToWizardRate)}%`, height: "100%", background: "#2563EB" }} />
          </div>
        </div>

        {/* Arrow 2 */}
        <div style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12, minWidth: 80 }}>
          <div style={{ fontWeight: 700, color: wizardToSignupRate >= 50 ? "var(--brand-primary, #0B4D3B)" : "var(--ink-2)" }}>
            {wizardToSignupRate}%
          </div>
          <div style={{ fontSize: 18, lineHeight: 1 }}>&rarr;</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
            {Math.max(0, Math.round((100 - wizardToSignupRate) * 10) / 10)}% dropped
          </div>
        </div>

        {/* Stage 3: Completed Store Signup */}
        <div
          style={{
            background: "rgba(11, 77, 59, 0.05)",
            border: "1px solid rgba(11, 77, 59, 0.25)",
            borderRadius: 8,
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--brand-primary, #0B4D3B)", textTransform: "uppercase" }}>
            3. Store Launched
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--brand-primary, #0B4D3B)", marginTop: 4 }}>
            {completedSignup.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: "var(--brand-primary, #0B4D3B)", marginTop: 2, fontWeight: 600 }}>
            {overallConversionRate}% overall CVR
          </div>
          <div style={{ width: "100%", height: 6, background: "#E2E8F0", borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, overallConversionRate)}%`, height: "100%", background: "var(--brand-primary, #0B4D3B)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
