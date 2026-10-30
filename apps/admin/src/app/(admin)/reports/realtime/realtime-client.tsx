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
    <div className="stack gap-xl">
      {/* Real-time Control Toolbar */}
      <div className="card-panel-muted flex-between flex-wrap gap-sm">
        <div className="flex-center-y gap-md">
          <div className="flex-center-y gap-xs text-sm text-medium">
            <span
              className={`live-indicator ${isPending ? "syncing" : "active"}`}
            />
            <span>
              {isPending
                ? "Synchronizing telemetry..."
                : `Updated at ${lastUpdated.toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit" })} (Dhaka)`}
            </span>
          </div>

          {errorMessage && (
            <span className="text-xs text-danger text-medium">
              {errorMessage}
            </span>
          )}
        </div>

        <div className="flex-center-y flex-wrap gap-sm">
          <div className="flex-center-y gap-xs text-sm">
            <label htmlFor="auto-refresh-select" className="text-muted text-medium">
              Auto-Refresh:
            </label>
            <select
              id="auto-refresh-select"
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(e.target.value as "off" | "30s" | "60s")}
              className="input text-xs py-xs"
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
            className="btn btn-secondary btn-sm"
          >
            <span>↻</span>
            {isPending ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Top Real-Time KPI Matrix */}
      <div className="grid grid-4">
        {/* Today's Sales */}
        <div className="card">
          <div className="flex-between mb-xs">
            <span className="text-xs text-muted text-bold uppercase">
              Today's Gross Sales
            </span>
            <span
              className={`pill text-xs ${kpis.salesChangePercent >= 0 ? "good" : "bad"}`}
            >
              {kpis.salesChangePercent >= 0 ? `+${kpis.salesChangePercent}%` : `${kpis.salesChangePercent}%`}
            </span>
          </div>
          <div className="num num-lg">
            {taka(kpis.todaySales)}
          </div>
          <div className="muted text-xs mt-xs">
            Yesterday: {taka(kpis.yesterdaySales)}
          </div>
        </div>

        {/* Today's Orders */}
        <div className="card">
          <div className="flex-between mb-xs">
            <span className="text-xs text-muted text-bold uppercase">
              Orders Today
            </span>
            <span
              className={`pill text-xs ${kpis.ordersChangePercent >= 0 ? "good" : "bad"}`}
            >
              {kpis.ordersChangePercent >= 0 ? `+${kpis.ordersChangePercent}%` : `${kpis.ordersChangePercent}%`}
            </span>
          </div>
          <div className="num num-lg">
            {kpis.todayOrders} <span className="text-sm text-muted text-normal">orders</span>
          </div>
          <div className="muted text-xs mt-xs">
            Yesterday: {kpis.yesterdayOrders} orders
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="card">
          <div className="text-xs text-muted text-bold uppercase mb-xs">
            Average Order Value
          </div>
          <div className="num num-lg">
            {taka(kpis.todayAov)}
          </div>
          <div className="muted text-xs mt-xs">
            Revenue per completed checkout
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="card">
          <div className="text-xs text-muted text-bold uppercase mb-xs">
            Storefront Conversion
          </div>
          <div className="num num-lg text-brand">
            {kpis.conversionRate}%
          </div>
          <div className="muted text-xs mt-xs">
            Placed orders / visitor sessions
          </div>
        </div>
      </div>

      {/* 24-Hour Velocity Curve */}
      <div className="card">
        <div className="flex-between flex-wrap gap-sm mb-md">
          <div>
            <h2 className="text-base text-bold m-0">
              24-Hour Velocity Curve (Today vs. Yesterday)
            </h2>
            <p className="muted text-sm mt-xs">
              Hour-by-hour order velocity aligned to Asia/Dhaka standard time (00:00 - 23:00).
            </p>
          </div>

          {/* Metric Selector & Legend */}
          <div className="flex-center-y flex-wrap gap-md">
            <div className="flex-center-y gap-md text-xs text-bold">
              <span className="flex-center-y gap-xs text-success">
                <span className="live-indicator active" />
                Today (Live)
              </span>
              <span className="flex-center-y gap-xs text-muted">
                <span className="bar-prev" />
                Yesterday
              </span>
            </div>

            <div className="segmented-pill">
              <button
                type="button"
                id="velocity-mode-sales"
                onClick={() => setMetricMode("sales")}
                className={`segmented-pill-btn ${metricMode === "sales" ? "active" : ""}`}
              >
                Revenue (BDT)
              </button>
              <button
                type="button"
                id="velocity-mode-orders"
                onClick={() => setMetricMode("orders")}
                className={`segmented-pill-btn ${metricMode === "orders" ? "active" : ""}`}
              >
                Order Count
              </button>
            </div>
          </div>
        </div>

        {/* Hover info banner */}
        <div className="min-h-32 text-xs text-muted mb-xs text-medium">
          {hoveredPoint ? (
            <span>
              <strong>Hour {hoveredPoint.label} ({hoveredPoint.hour.toString().padStart(2, "0")}:00):</strong>{" "}
              Today: <strong className="text-success">{metricMode === "sales" ? taka(hoveredPoint.todaySales) : `${hoveredPoint.todayOrders} orders`}</strong>
              {" · "}
              Yesterday: <strong className="text-muted">{metricMode === "sales" ? taka(hoveredPoint.yesterdaySales) : `${hoveredPoint.yesterdayOrders} orders`}</strong>
            </span>
          ) : (
            <span>
              Hover over any hour on the timeline to inspect the velocity comparison.
            </span>
          )}
        </div>

        {/* Interactive SVG Chart */}
        <div className="chart-svg-wrap">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="chart-svg"
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
                  <circle
                    cx={cx}
                    cy={cyToday}
                    r={isHovered ? 5 : 2.5}
                    fill={isHovered ? "#fff" : "#10b981"}
                    stroke="#10b981"
                    strokeWidth={isHovered ? 2.5 : 1}
                  />

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

                  <rect
                    x={cx - (plotWidth / 24) / 2}
                    y={padTop}
                    width={plotWidth / 24}
                    height={plotHeight}
                    fill="transparent"
                    className="cursor-pointer"
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
      <div className="card">
        <div className="flex-between mb-md">
          <div>
            <h2 className="text-base text-bold m-0">
              5-Stage Conversion Drop-Off Waterfall
            </h2>
            <p className="muted text-sm mt-xs">
              Tracking visitors through product discovery, carting, checkout, order placement, and courier fulfillment.
            </p>
          </div>
          <Link
            href="/abandoned"
            className="btn btn-secondary btn-sm"
          >
            Abandoned Checkout Recovery →
          </Link>
        </div>

        <div className="stack gap-sm">
          {data.conversionFunnel.map((stage, idx) => {
            const isFirst = idx === 0;
            return (
              <div
                key={stage.stage}
                className="waterfall-row"
              >
                <div>
                  <div className="text-sm text-bold">
                    {idx + 1}. {stage.label}
                  </div>
                  <div className="muted text-xs mt-xs">
                    <strong>{stage.count.toLocaleString()}</strong> events
                  </div>
                </div>

                {/* Progress Visual Bar */}
                <div className="meter">
                  <i
                    style={{
                      width: `${Math.min(100, Math.max(1, stage.conversionRatePercent))}%`,
                    }}
                    className={idx === 3 ? "text-success" : ""}
                  />
                </div>

                {/* Metrics Pill */}
                <div className="text-right">
                  <div className="text-sm text-bold">
                    {stage.conversionRatePercent}% conv.
                  </div>
                  {!isFirst && (
                    <div
                      className={`text-xs text-bold mt-xs ${stage.dropOffRatePercent > 50 ? "text-danger" : "text-warning"}`}
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
      <div className="card">
        <div className="mb-md">
          <h2 className="text-base text-bold m-0">
            Customer Cohort Retention Matrix (LTV & Repeat Rates)
          </h2>
          <p className="muted text-sm mt-xs">
            Monthly acquisition cohorts tracking customer retention and cumulative revenue over subsequent months (M0 - M3).
          </p>
        </div>

        <div className="chart-svg-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Cohort Month</th>
                <th>New Customers</th>
                <th className="text-center">Month 0</th>
                <th className="text-center">Month 1</th>
                <th className="text-center">Month 2</th>
                <th className="text-center">Month 3</th>
                <th className="r">Cumulative LTV</th>
              </tr>
            </thead>
            <tbody>
              {data.cohorts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-md muted">
                    No customer cohorts recorded yet. Cohorts populate automatically as customers place orders.
                  </td>
                </tr>
              ) : (
                data.cohorts.map((cohort) => (
                  <tr key={cohort.cohortMonth}>
                    <td className="text-bold">
                      {cohort.cohortMonth}
                    </td>
                    <td className="muted">
                      {cohort.cohortSize} buyers
                    </td>
                    <td className="text-center">
                      <span className="pill info text-xs">
                        100%
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`pill text-xs ${cohort.retentionM1 > 0 ? "good" : ""}`}>
                        {cohort.retentionM1 > 0 ? `${cohort.retentionM1}%` : "—"}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`pill text-xs ${cohort.retentionM2 > 0 ? "good" : ""}`}>
                        {cohort.retentionM2 > 0 ? `${cohort.retentionM2}%` : "—"}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`pill text-xs ${cohort.retentionM3 > 0 ? "good" : ""}`}>
                        {cohort.retentionM3 > 0 ? `${cohort.retentionM3}%` : "—"}
                      </span>
                    </td>
                    <td className="r text-bold num">
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
      <div className="grid grid-2 gap-lg">
        {/* Regional District Distribution */}
        <section className="card">
          <h2 className="text-base text-bold mb-md m-0">
            Top Regional Deliveries (Live Today)
          </h2>

          <div className="stack gap-sm">
            {data.districtBreakdown.map((item) => (
              <div key={item.district}>
                <div className="flex-between text-sm mb-xs">
                  <span className="text-medium">{item.district}</span>
                  <span className="muted text-xs">
                    {item.orders} orders · {taka(item.sales)} ({item.percentage}%)
                  </span>
                </div>
                <div className="meter">
                  <i
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Payment Method Distribution */}
        <section className="card">
          <h2 className="text-base text-bold mb-md m-0">
            Payment Method Split (Live Today)
          </h2>

          <div className="stack gap-sm">
            {data.paymentBreakdown.map((item) => (
              <div key={item.method}>
                <div className="flex-between text-sm mb-xs">
                  <span className="text-medium">{item.label}</span>
                  <span className="muted text-xs">
                    {item.count} orders · {taka(item.sales)} ({item.percentage}%)
                  </span>
                </div>
                <div className="meter">
                  <i
                    style={{ width: `${item.percentage}%` }}
                    className={item.method === "COD" ? "text-warning" : "text-success"}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 14-Day Historical Fast Rollup Summary */}
      <section className="card">
        <div className="mb-sm">
          <h2 className="text-base text-bold m-0">
            14-Day Immutable Daily Rollups (`DailyStoreMetrics`)
          </h2>
          <p className="muted text-sm mt-xs">
            Fast pre-aggregated daily checkpoints powering instant reporting without scanning raw order tables.
          </p>
        </div>

        <div className="chart-svg-wrap">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Gross Sales</th>
                <th>Total Orders</th>
                <th className="r">Average Order Value</th>
              </tr>
            </thead>
            <tbody>
              {data.historicalTrend.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-sm muted">
                    No historical rollups available yet.
                  </td>
                </tr>
              ) : (
                data.historicalTrend.map((row) => (
                  <tr key={row.date}>
                    <td className="text-medium">{row.date}</td>
                    <td>{taka(row.sales)}</td>
                    <td>{row.orders} orders</td>
                    <td className="r num text-medium">{taka(row.aov)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
