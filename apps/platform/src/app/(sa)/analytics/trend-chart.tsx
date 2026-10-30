import type { TrendDataPoint } from "@biztrackbd/core";

export function AnalyticsTrendChart({
  trend,
  isHourly = false,
}: {
  trend: TrendDataPoint[];
  isHourly?: boolean;
}) {
  if (!trend || trend.length === 0) return null;

  const maxVisitors = Math.max(1, ...trend.map((t) => t.visitors));
  const totalPeriodVisitors = trend.reduce((sum, t) => sum + t.visitors, 0);
  const totalPeriodSignups = trend.reduce((sum, t) => sum + t.signups, 0);

  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {isHourly ? "Hourly Traffic & Conversion Pulse (Asia/Dhaka)" : "Traffic & Signup Trend Over Time"}
          </div>
          <div style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 4 }}>
            <strong>{totalPeriodVisitors}</strong> visitors &middot; <strong style={{ color: "var(--brand-primary, #0B4D3B)" }}>{totalPeriodSignups}</strong> signups in this window
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--ink-3)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#93C5FD", display: "inline-block" }} />
            Visitors
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--brand-primary, #0B4D3B)", display: "inline-block" }} />
            Conversions
          </span>
        </div>
      </div>

      {/* Histogram bars */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: trend.length > 20 ? 3 : 6,
          height: 110,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 4,
          paddingTop: 8,
        }}
      >
        {trend.map((point, idx) => {
          const heightPercent = Math.max(point.visitors > 0 ? 8 : 2, Math.round((point.visitors / maxVisitors) * 100));
          const signupHeightPercent = point.visitors > 0 ? Math.round((point.signups / point.visitors) * 100) : 0;
          return (
            <div
              key={idx}
              title={`${point.label}: ${point.visitors} visitors, ${point.signups} signups`}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                height: "100%",
                position: "relative",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  height: `${heightPercent}%`,
                  background: point.signups > 0 ? "#60A5FA" : "#E2E8F0",
                  borderRadius: "3px 3px 0 0",
                  position: "relative",
                  overflow: "hidden",
                  transition: "height 0.2s ease",
                }}
              >
                {point.signups > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${signupHeightPercent}%`,
                      minHeight: 4,
                      background: "var(--brand-primary, #0B4D3B)",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Axis labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}>
        <span>{trend[0]?.label}</span>
        {trend.length > 2 && <span>{trend[Math.floor(trend.length / 2)]?.label}</span>}
        <span>{trend[trend.length - 1]?.label}</span>
      </div>
    </div>
  );
}
