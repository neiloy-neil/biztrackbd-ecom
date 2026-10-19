"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { RealtimeStudioPayload } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { fetchRealtimeMetricsAction } from "./actions";

interface RealtimeStudioClientProps {
  initialData: RealtimeStudioPayload;
}

export function RealtimeStudioClient({ initialData }: RealtimeStudioClientProps) {
  const [data, setData] = useState<RealtimeStudioPayload>(initialData);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<"off" | "30s" | "60s">("30s");
  const [metricMode, setMetricMode] = useState<"sales" | "orders">("sales");
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date(initialData.lastUpdatedIso));
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshData = useCallback(() => {
    startTransition(async () => {
      setErrorMessage(null);
      const res = await fetchRealtimeMetricsAction();
      if (res.ok && res.data) {
        setData(res.data);
        setLastUpdated(new Date(res.data.lastUpdatedIso));
      } else {
        setErrorMessage(res.error || "Failed to update real-time metrics.");
      }
    });
  }, []);

  useEffect(() => {
    if (autoRefreshInterval === "off") return;
    const ms = autoRefreshInterval === "30s" ? 30_000 : 60_000;
    const timer = setInterval(() => {
      refreshData();
    }, ms);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, refreshData]);

  const kpis = data.kpis;
  const velocity = data.hourlyVelocity;

  // Compute SVG chart points
  const chartWidth = 800;
  const chartHeight = 240;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 35;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;

  const getMetricVal = (p: (typeof velocity)[0], isToday: boolean) => {
    if (metricMode === "sales") {
      return isToday ? p.todaySales : p.yesterdaySales;
    }
    return isToday ? p.todayOrders : p.yesterdayOrders;
  };

  const maxVal = Math.max(
    1,
    ...velocity.map((p) => Math.max(getMetricVal(p, true), getMetricVal(p, false)))
  );

  const getX = (hour: number) => padLeft + (hour / 23) * plotWidth;
  const getY = (val: number) => padTop + (1 - val / maxVal) * plotHeight;

  const todayPoints = velocity.map((p) => `${getX(p.hour).toFixed(1)},${getY(getMetricVal(p, true)).toFixed(1)}`).join(" ");
  const yesterdayPoints = velocity.map((p) => `${getX(p.hour).toFixed(1)},${getY(getMetricVal(p, false)).toFixed(1)}`).join(" ");

  const todayAreaPath = `M ${getX(0).toFixed(1)},${(padTop + plotHeight).toFixed(1)} ` +
    velocity.map((p) => `L ${getX(p.hour).toFixed(1)},${getY(getMetricVal(p, true)).toFixed(1)}`).join(" ") +
    ` L ${getX(23).toFixed(1)},${(padTop + plotHeight).toFixed(1)} Z`;

  const hoveredPoint = hoveredHour !== null ? velocity[hoveredHour] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Real-time Control Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "13px", fontWeight: 600 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isPending ? "var(--warning)" : "var(--success)",
                animation: isPending ? "pulse 1s infinite" : "none",
              }}
            />
            <span>
              {isPending
                ? "Synchronizing telemetry..."
                : `Updated at ${lastUpdated.toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit" })} (Dhaka)`}
            </span>
          </div>

          {errorMessage && (
            <span style={{ fontSize: "12px", color: "var(--danger)", fontWeight: 500 }}>
              {errorMessage}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "13px" }}>
            <label htmlFor="auto-refresh-select" style={{ color: "var(--ink-3)", fontWeight: 500 }}>
              Auto-Refresh:
            </label>
            <select
              id="auto-refresh-select"
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(e.target.value as "off" | "30s" | "60s")}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--line-2)",
                background: "var(--bg)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <option value="30s">Every 30s</option>
              <option value="60s">Every 60s</option>
              <option value="off">Manual</option>
            </select>
          </div>

          <button
            id="refresh-realtime-btn"
            type="button"
            onClick={refreshData}
            disabled={isPending}
            className="btn"
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: isPending ? "rotate(180deg)" : "none",
                transition: "transform 0.4s ease",
              }}
            >
              ↻
            </span>
            {isPending ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Top Real-Time KPI Matrix */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
        }}
      >
        {/* Today's Sales */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase" }}>
              Today's Gross Sales
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                background: kpis.salesChangePercent >= 0 ? "var(--success-bg)" : "var(--danger-bg)",
                color: kpis.salesChangePercent >= 0 ? "var(--success)" : "var(--danger)",
              }}
            >
              {kpis.salesChangePercent >= 0 ? `+${kpis.salesChangePercent}%` : `${kpis.salesChangePercent}%`}
            </span>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--ink)" }}>
            {taka(kpis.todaySales)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: 4 }}>
            Yesterday: {taka(kpis.yesterdaySales)}
          </div>
        </div>

        {/* Today's Orders */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase" }}>
              Orders Today
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                background: kpis.ordersChangePercent >= 0 ? "var(--success-bg)" : "var(--danger-bg)",
                color: kpis.ordersChangePercent >= 0 ? "var(--success)" : "var(--danger)",
              }}
            >
              {kpis.ordersChangePercent >= 0 ? `+${kpis.ordersChangePercent}%` : `${kpis.ordersChangePercent}%`}
            </span>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--ink)" }}>
            {kpis.todayOrders} <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--ink-3)" }}>orders</span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: 4 }}>
            Yesterday: {kpis.yesterdayOrders} orders
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 6 }}>
            Average Order Value
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--ink)" }}>
            {taka(kpis.todayAov)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: 4 }}>
            Revenue per completed checkout
          </div>
        </div>

        {/* Conversion Rate */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 6 }}>
            Storefront Conversion
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--brand)" }}>
            {kpis.conversionRate}%
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: 4 }}>
            Placed orders / visitor sessions
          </div>
        </div>

        {/* Cart & Abandonment Radar */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase" }}>
              Active Radar
            </span>
            <Link
              href="/growth/abandoned"
              style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--brand)" }}
            >
              Recover →
            </Link>
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
            {kpis.activeCartCount} active carts
          </div>
          <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: 4 }}>
            {kpis.abandonedCheckoutCount} unrecovered checkouts
          </div>
        </div>
      </div>

      {/* 24-Hour Velocity Curve */}
      <div
        className="card"
        style={{
          padding: "20px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
              24-Hour Velocity Curve (Today vs. Yesterday)
            </h2>
            <p style={{ fontSize: "13px", color: "var(--ink-3)", margin: "4px 0 0" }}>
              Hour-by-hour order velocity aligned to Asia/Dhaka standard time (00:00 - 23:00).
            </p>
          </div>

          {/* Metric Selector & Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "12px", fontWeight: 600 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#10b981" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }} />
                Today (Live)
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#94a3b8" }}>
                <span
                  style={{
                    width: 14,
                    height: 2,
                    background: "#94a3b8",
                    borderTop: "2px dashed #94a3b8",
                  }}
                />
                Yesterday
              </span>
            </div>

            <div
              style={{
                display: "inline-flex",
                background: "var(--bg)",
                padding: "2px",
                borderRadius: 8,
                border: "1px solid var(--line)",
              }}
            >
              <button
                type="button"
                id="velocity-mode-sales"
                onClick={() => setMetricMode("sales")}
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: metricMode === "sales" ? "var(--surface)" : "transparent",
                  color: metricMode === "sales" ? "var(--brand)" : "var(--ink-3)",
                  boxShadow: metricMode === "sales" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Revenue (BDT)
              </button>
              <button
                type="button"
                id="velocity-mode-orders"
                onClick={() => setMetricMode("orders")}
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: metricMode === "orders" ? "var(--surface)" : "transparent",
                  color: metricMode === "orders" ? "var(--brand)" : "var(--ink-3)",
                  boxShadow: metricMode === "orders" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Order Count
              </button>
            </div>
          </div>
        </div>

        {/* Hover info banner */}
        <div
          style={{
            minHeight: "26px",
            fontSize: "12.5px",
            color: "var(--ink-2)",
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          {hoveredPoint ? (
            <span>
              <strong>Hour {hoveredPoint.label} ({hoveredPoint.hour.toString().padStart(2, "0")}:00):</strong>{" "}
              Today: <strong style={{ color: "#10b981" }}>{metricMode === "sales" ? taka(hoveredPoint.todaySales) : `${hoveredPoint.todayOrders} orders`}</strong>
              {" · "}
              Yesterday: <strong style={{ color: "var(--ink-3)" }}>{metricMode === "sales" ? taka(hoveredPoint.yesterdaySales) : `${hoveredPoint.yesterdayOrders} orders`}</strong>
            </span>
          ) : (
            <span style={{ color: "var(--ink-3)" }}>
              Hover over any hour on the timeline to inspect the velocity comparison.
            </span>
          )}
        </div>

        {/* Interactive SVG Chart */}
        <div style={{ width: "100%", overflowX: "auto" }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ width: "100%", height: "auto", display: "block" }}
            aria-label="24-Hour Velocity Curve"
          >
            <defs>
              <linearGradient id="todayGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid horizontal lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padTop + ratio * plotHeight;
              const val = Math.round(maxVal * (1 - ratio));
              return (
                <g key={ratio}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={chartWidth - padRight}
                    y2={y}
                    stroke="var(--line)"
                    strokeDasharray="3,3"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--ink-3)"
                    fontFamily="inherit"
                  >
                    {metricMode === "sales" ? `৳${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}` : val}
                  </text>
                </g>
              );
            })}

            {/* Area under Today */}
            <path d={todayAreaPath} fill="url(#todayGradient)" />

            {/* Yesterday Line (dashed slate) */}
            <polyline
              points={yesterdayPoints}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="4,4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Today Line (emerald) */}
            <polyline
              points={todayPoints}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Point Circles and X-axis Labels */}
            {velocity.map((p) => {
              const cx = getX(p.hour);
              const cyToday = getY(getMetricVal(p, true));
              const isHovered = hoveredHour === p.hour;
              const showLabel = p.hour % 3 === 0 || p.hour === 23;

              return (
                <g key={p.hour}>
                  {/* Point circle */}
                  <circle
                    cx={cx}
                    cy={cyToday}
                    r={isHovered ? 5 : 2.5}
                    fill={isHovered ? "#fff" : "#10b981"}
                    stroke="#10b981"
                    strokeWidth={isHovered ? 2.5 : 1}
                  />

                  {/* X-axis label */}
                  {showLabel && (
                    <text
                      x={cx}
                      y={chartHeight - 12}
                      textAnchor="middle"
                      fontSize="10.5"
                      fill="var(--ink-3)"
                      fontWeight="500"
                      fontFamily="inherit"
                    >
                      {p.label}
                    </text>
                  )}

                  {/* Invisible wide hit area for hover */}
                  <rect
                    x={cx - (plotWidth / 24) / 2}
                    y={padTop}
                    width={plotWidth / 24}
                    height={plotHeight}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredHour(p.hour)}
                    onMouseLeave={() => setHoveredHour(null)}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 5-Stage Conversion Drop-Off Waterfall */}
      <div
        className="card"
        style={{
          padding: "20px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
              5-Stage Conversion Drop-Off Waterfall
            </h2>
            <p style={{ fontSize: "13px", color: "var(--ink-3)", margin: "4px 0 0" }}>
              Tracking visitors through product discovery, carting, checkout, order placement, and courier fulfillment.
            </p>
          </div>
          <Link
            href="/growth/abandoned"
            className="btn"
            style={{ fontSize: "12px", padding: "6px 12px" }}
          >
            Abandoned Checkout Recovery →
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.conversionFunnel.map((stage, idx) => {
            const isFirst = idx === 0;
            return (
              <div
                key={stage.stage}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr 140px",
                  alignItems: "center",
                  gap: 16,
                  padding: "10px 14px",
                  background: "var(--bg)",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                }}
              >
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ink)" }}>
                    {idx + 1}. {stage.label}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: 2 }}>
                    <strong>{stage.count.toLocaleString()}</strong> events
                  </div>
                </div>

                {/* Progress Visual Bar */}
                <div style={{ width: "100%", background: "var(--line)", height: 10, borderRadius: 5, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(1, stage.conversionRatePercent))}%`,
                      height: "100%",
                      background: idx === 3 ? "var(--success)" : "var(--brand)",
                      borderRadius: 5,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>

                {/* Metrics Pill */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
                    {stage.conversionRatePercent}% conv.
                  </div>
                  {!isFirst && (
                    <div
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: stage.dropOffRatePercent > 50 ? "var(--danger)" : "var(--warning)",
                        marginTop: 2,
                      }}
                    >
                      ▼ {stage.dropOffRatePercent}% drop-off
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer Cohort Retention Matrix */}
      <div
        className="card"
        style={{
          padding: "20px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
            Customer Cohort Retention Matrix (LTV & Repeat Rates)
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink-3)", margin: "4px 0 0" }}>
            Monthly acquisition cohorts tracking customer retention and cumulative revenue over subsequent months (M0 - M3).
          </p>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <table
            className="table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13.5px",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--ink-3)", fontSize: "12px" }}>
                <th style={{ padding: "10px 12px" }}>Cohort Month</th>
                <th style={{ padding: "10px 12px" }}>New Customers</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Month 0</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Month 1</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Month 2</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Month 3</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Cumulative LTV</th>
              </tr>
            </thead>
            <tbody>
              {data.cohorts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "18px 12px", textAlign: "center", color: "var(--ink-3)" }}>
                    No customer cohorts recorded yet. Cohorts populate automatically as customers place orders.
                  </td>
                </tr>
              ) : (
                data.cohorts.map((cohort) => (
                  <tr key={cohort.cohortMonth} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--ink)" }}>
                      {cohort.cohortMonth}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--ink-2)" }}>
                      {cohort.cohortSize} buyers
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "var(--tint)",
                          color: "var(--brand)",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        100%
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: cohort.retentionM1 > 0 ? "var(--success-bg)" : "var(--bg)",
                          color: cohort.retentionM1 > 0 ? "var(--success)" : "var(--ink-3)",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        {cohort.retentionM1 > 0 ? `${cohort.retentionM1}%` : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: cohort.retentionM2 > 0 ? "var(--success-bg)" : "var(--bg)",
                          color: cohort.retentionM2 > 0 ? "var(--success)" : "var(--ink-3)",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        {cohort.retentionM2 > 0 ? `${cohort.retentionM2}%` : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: cohort.retentionM3 > 0 ? "var(--success-bg)" : "var(--bg)",
                          color: cohort.retentionM3 > 0 ? "var(--success)" : "var(--ink-3)",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        {cohort.retentionM3 > 0 ? `${cohort.retentionM3}%` : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--ink)" }}>
                      {taka(cohort.totalLtvBDT)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regional & Payment Breakdowns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {/* Regional District Distribution */}
        <div
          className="card"
          style={{
            padding: "20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 14px 0" }}>
            Top Regional Deliveries (Live Today)
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.districtBreakdown.map((item) => (
              <div key={item.district}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{item.district}</span>
                  <span style={{ color: "var(--ink-3)" }}>
                    {item.orders} orders · {taka(item.sales)} ({item.percentage}%)
                  </span>
                </div>
                <div style={{ width: "100%", background: "var(--line)", height: 6, borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${item.percentage}%`,
                      height: "100%",
                      background: "var(--brand)",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method Distribution */}
        <div
          className="card"
          style={{
            padding: "20px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 14px 0" }}>
            Payment Method Split (Live Today)
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.paymentBreakdown.map((item) => (
              <div key={item.method}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{item.label}</span>
                  <span style={{ color: "var(--ink-3)" }}>
                    {item.count} orders · {taka(item.sales)} ({item.percentage}%)
                  </span>
                </div>
                <div style={{ width: "100%", background: "var(--line)", height: 6, borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${item.percentage}%`,
                      height: "100%",
                      background: item.method === "COD" ? "#f59e0b" : "#10b981",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 14-Day Historical Fast Rollup Summary */}
      <div
        className="card"
        style={{
          padding: "20px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
            14-Day Immutable Daily Rollups (`DailyStoreMetrics`)
          </h2>
          <p style={{ fontSize: "13px", color: "var(--ink-3)", margin: "4px 0 0" }}>
            Fast pre-aggregated daily checkpoints powering instant reporting without scanning raw order tables.
          </p>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <table
            className="table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--ink-3)", fontSize: "12px" }}>
                <th style={{ padding: "8px 10px" }}>Date</th>
                <th style={{ padding: "8px 10px" }}>Gross Sales</th>
                <th style={{ padding: "8px 10px" }}>Total Orders</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>Average Order Value</th>
              </tr>
            </thead>
            <tbody>
              {data.historicalTrend.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "16px 10px", textAlign: "center", color: "var(--ink-3)" }}>
                    No historical rollups available yet.
                  </td>
                </tr>
              ) : (
                data.historicalTrend.map((row) => (
                  <tr key={row.date} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{row.date}</td>
                    <td style={{ padding: "8px 10px" }}>{taka(row.sales)}</td>
                    <td style={{ padding: "8px 10px" }}>{row.orders} orders</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{taka(row.aov)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
