"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  DashboardTelemetry,
  DashboardActivityEvent,
  DashboardFraudRadarItem,
  DashboardDispatchQueueItem,
  PhoneLookup,
} from "@biztrackbd/core";
import {
  manualPhoneFraudLookupAction,
  bulkBookCourierOrdersAction,
  holdDashboardOrderAction,
  releaseDashboardOrderHoldAction,
} from "./dashboard-actions";
import { taka, prettyPhone } from "@/lib/format";

interface ConnectedCourierItem {
  provider: string;
  label: string;
}

interface Props {
  telemetry: DashboardTelemetry;
  activityFeed: DashboardActivityEvent[];
  fraudRadar: DashboardFraudRadarItem[];
  dispatchQueue: DashboardDispatchQueueItem[];
  connectedCouriers: ConnectedCourierItem[];
  canEdit: boolean;
}

const formatBDTime = (d: Date | string) => {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(typeof d === "string" ? new Date(d) : d);
  } catch {
    return "";
  }
};

export function DashboardOperationsClient({
  telemetry,
  activityFeed,
  fraudRadar,
  dispatchQueue,
  connectedCouriers,
  canEdit,
}: Props) {
  const router = useRouter();

  // Pulse & Auto-Refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fraud Radar State
  const [activeFraudTab, setActiveFraudTab] = useState<"WATCHLIST" | "MANUAL_CHECK">("WATCHLIST");
  const [lookupPhoneInput, setLookupPhoneInput] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<PhoneLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Bulk Dispatch Queue State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [chosenCourier, setChosenCourier] = useState<string>(
    connectedCouriers[0]?.provider || "steadfast"
  );
  const [chosenWeight, setChosenWeight] = useState<string>("0.5");
  const [isBulkBooking, setIsBulkBooking] = useState(false);
  const [bulkBookingFeedback, setBulkBookingFeedback] = useState<string | null>(null);

  // Feedback Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 30s Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      router.refresh();
      setLastRefreshedAt(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, router]);

  // Handle Manual Phone Lookup
  const handleManualPhoneLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupPhoneInput.trim()) return;
    setIsLookingUp(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const res = await manualPhoneFraudLookupAction(lookupPhoneInput.trim());
      if (res.success && res.lookup) {
        setLookupResult(res.lookup);
      } else {
        setLookupError(res.error || "Phone record lookup failed");
      }
    } catch (err: any) {
      setLookupError(err.message || "An unexpected error occurred");
    } finally {
      setIsLookingUp(false);
    }
  };

  // Handle Hold / Release Order
  const handleHoldOrder = async (orderId: string, orderNumber: string) => {
    if (!canEdit) return;
    try {
      await holdDashboardOrderAction(orderId);
      showToast(`Order #${orderNumber} held for review`);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Failed to hold order");
    }
  };

  const handleReleaseOrder = async (orderId: string, orderNumber: string) => {
    if (!canEdit) return;
    try {
      await releaseDashboardOrderHoldAction(orderId);
      showToast(`Order #${orderNumber} approved for fulfillment`);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Failed to approve order");
    }
  };

  // Bulk Dispatch Checkbox Handlers
  const handleToggleSelectAll = () => {
    if (selectedOrderIds.length === dispatchQueue.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(dispatchQueue.map((o) => o.id));
    }
  };

  const handleToggleOrderSelection = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Execute Bulk Booking
  const handleExecuteBulkBooking = async () => {
    if (selectedOrderIds.length === 0) return;
    if (
      !confirm(
        `Book ${selectedOrderIds.length} orders with ${chosenCourier.toUpperCase()} at ${chosenWeight} kg?`
      )
    )
      return;

    setIsBulkBooking(true);
    setBulkBookingFeedback(null);

    try {
      const res = await bulkBookCourierOrdersAction(
        selectedOrderIds,
        chosenCourier,
        Number(chosenWeight)
      );
      if (res.success) {
        setBulkBookingFeedback(
          `Successfully booked ${res.bookedCount} of ${selectedOrderIds.length} parcels!`
        );
        setSelectedOrderIds([]);
        router.refresh();
      }
    } catch (e: any) {
      alert(e.message || "Bulk booking encountered an error");
    } finally {
      setIsBulkBooking(false);
    }
  };

  return (
    <>
      {toastMessage && (
        <div
          className="notice good"
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            padding: "10px 18px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            borderRadius: 8,
            fontWeight: 700,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. TOP TELEMETRY STRIP & REAL-TIME PULSE BAR              */}
      {/* ========================================================= */}
      <section
        className="card"
        style={{
          padding: "12px 16px",
          marginBottom: 16,
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          color: "#FFF",
          border: "1px solid #334155",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Left: Live Pulse Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: autoRefresh ? "#22C55E" : "#94A3B8",
                boxShadow: autoRefresh ? "0 0 8px #22C55E" : "none",
              }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, letterSpacing: "0.02em" }}>
                LIVE OPERATIONS PULSE
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8" }} suppressHydrationWarning>
                Updated {mounted ? formatBDTime(lastRefreshedAt) : "Just now"} ·{" "}
                <button
                  type="button"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: autoRefresh ? "#4ADE80" : "#CBD5E1",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {autoRefresh ? "Auto-refresh: ON (30s)" : "Auto-refresh: OFF (Click to start)"}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Key Telemetry Metrics */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase" }}>
                Today's AOV
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#F8FAFC" }}>
                ৳ {telemetry.aovToday.toLocaleString("en-IN")}
                {telemetry.aovYesterday > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      marginLeft: 4,
                      color: telemetry.aovToday >= telemetry.aovYesterday ? "#4ADE80" : "#F87171",
                    }}
                  >
                    ({telemetry.aovToday >= telemetry.aovYesterday ? "+" : ""}
                    {telemetry.aovToday - telemetry.aovYesterday})
                  </span>
                )}
              </div>
            </div>

            <div style={{ textAlign: "right", borderLeft: "1px solid #334155", paddingLeft: 16 }}>
              <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase" }}>
                COD Cash-at-Risk
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: telemetry.cashAtRisk > 0 ? "#FCA5A5" : "#F8FAFC",
                }}
              >
                ৳ {telemetry.cashAtRisk.toLocaleString("en-IN")}
                {telemetry.highRiskOrdersCount > 0 && (
                  <span style={{ fontSize: 11, marginLeft: 4, color: "#EF4444" }}>
                    ({telemetry.highRiskOrdersCount} flagged)
                  </span>
                )}
              </div>
            </div>

            <div style={{ textAlign: "right", borderLeft: "1px solid #334155", paddingLeft: 16 }}>
              <div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase" }}>
                Live Conversion
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#38BDF8" }}>
                {telemetry.conversionRate}%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. DUAL OPERATIONAL PANELS: FRAUD RADAR & LIVE DISPATCH   */}
      {/* ========================================================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* ======================================================= */}
        {/* PANEL A: LIVE COURIER FRAUD RADAR & PHONE CHECKER       */}
        {/* ======================================================= */}
        <div
          className="card"
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Courier Fraud Radar & Check
              </h3>
              <span className="muted" style={{ fontSize: 11.5 }}>
                5-Courier delivery records & RTO risk detection
              </span>
            </div>

            {/* Sub-tabs: Watchlist vs Manual Phone Lookup */}
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => setActiveFraudTab("WATCHLIST")}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: activeFraudTab === "WATCHLIST" ? "#0F172A" : "#F1F5F9",
                  color: activeFraudTab === "WATCHLIST" ? "#FFF" : "#475569",
                }}
              >
                Watchlist ({fraudRadar.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFraudTab("MANUAL_CHECK")}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: activeFraudTab === "MANUAL_CHECK" ? "#0F172A" : "#F1F5F9",
                  color: activeFraudTab === "MANUAL_CHECK" ? "#FFF" : "#475569",
                }}
              >
                Check Number
              </button>
            </div>
          </div>

          {/* TAB 1: WATCHLIST OF FLAGGED ORDERS */}
          {activeFraudTab === "WATCHLIST" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {fraudRadar.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center" }} className="muted">
                  No high-risk or held orders detected. Delivery records look clear.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {fraudRadar.map((item) => {
                    const isHigh = item.fraudRiskLevel === "HIGH" || item.fraudReview === "HELD";
                    return (
                      <div
                        key={item.id}
                        style={{
                          border: `1px solid ${isHigh ? "#FCA5A5" : "#FED7AA"}`,
                          borderRadius: 8,
                          padding: "10px 12px",
                          background: isHigh ? "#FEF2F2" : "#FFF7ED",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <Link
                              href={`/orders/${item.id}`}
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: "#2563EB",
                                textDecoration: "none",
                              }}
                            >
                              #{item.orderNumber}
                            </Link>{" "}
                            <span style={{ fontWeight: 600, fontSize: 12.5 }}>
                              {item.customerName}
                            </span>
                            <div className="muted" style={{ fontSize: 11.5 }}>
                              {item.customerPhone} {item.district ? `· ${item.district}` : ""} · ৳{" "}
                              {item.totalAmount.toLocaleString("en-IN")}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <span
                              className={`pill ${isHigh ? "bad" : "warn"}`}
                              style={{ fontSize: 10, padding: "2px 6px" }}
                            >
                              {item.fraudReview === "HELD" ? "HELD" : `${item.fraudRiskLevel} RISK`} ·{" "}
                              {item.fraudTrustScore}/100
                            </span>
                          </div>
                        </div>

                        {/* Quick 1-Click Prevention Action Buttons */}
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            marginTop: 8,
                            paddingTop: 6,
                            borderTop: "1px solid rgba(0,0,0,0.06)",
                            flexWrap: "wrap",
                          }}
                        >
                          {/* Request Advance Delivery Fee via WhatsApp */}
                          <a
                            href={`https://wa.me/88${item.customerPhone}?text=${encodeURIComponent(
                              `আসসালামু আলাইকুম ${item.customerName}! আপনার অর্ডার #${item.orderNumber} (৳${item.totalAmount}) কনফার্ম করতে অনুগ্রহ করে ডেলিভারি চার্জ ৳১০০ অগ্রিম পরিশোধ করুন। ধন্যবাদ!`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: 10.5,
                              padding: "2px 8px",
                              background: "#25D366",
                              color: "#FFF",
                              borderColor: "#25D366",
                            }}
                          >
                            Ask ৳100 Advance
                          </a>

                          {item.fraudReview === "HELD" ? (
                            <button
                              type="button"
                              onClick={() => handleReleaseOrder(item.id, item.orderNumber)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 10.5, padding: "2px 8px" }}
                            >
                              Approve COD
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleHoldOrder(item.id, item.orderNumber)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 10.5, padding: "2px 8px", color: "#DC2626" }}
                            >
                              Hold Order
                            </button>
                          )}

                          <a
                            href={`tel:${item.customerPhone}`}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 10.5, padding: "2px 8px" }}
                          >
                            Call
                          </a>

                          <Link
                            href={`/fraud?tab=check&phone=${encodeURIComponent(item.customerPhone)}`}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 10.5, padding: "2px 8px" }}
                          >
                            5-Courier Dossier →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL PHONE FRAUD CHECKER TOOL */}
          {activeFraudTab === "MANUAL_CHECK" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <form onSubmit={handleManualPhoneLookup} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter phone (e.g. 01712345678)…"
                    value={lookupPhoneInput}
                    onChange={(e) => setLookupPhoneInput(e.target.value)}
                    style={{ fontSize: 12.5, flex: 1 }}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isLookingUp}
                    className="btn btn-primary btn-sm"
                    style={{ fontWeight: 700, padding: "6px 14px" }}
                  >
                    {isLookingUp ? "Checking…" : "Check Risk"}
                  </button>
                </div>
              </form>

              {lookupError && (
                <div className="notice bad" style={{ fontSize: 12, padding: "8px 12px" }}>
                  {lookupError}
                </div>
              )}

              {lookupResult && (
                <div
                  style={{
                    border: "1px solid #CBD5E1",
                    borderRadius: 8,
                    padding: 12,
                    background: "#F8FAFC",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {prettyPhone(lookupResult.phone)}
                    </div>
                    <span
                      className={`pill ${
                        lookupResult.unifiedLevel === "HIGH"
                          ? "bad"
                          : lookupResult.unifiedLevel === "MEDIUM"
                          ? "warn"
                          : "ok"
                      }`}
                      style={{ fontSize: 11, padding: "2px 8px" }}
                    >
                      Score: {lookupResult.unifiedScore}/100 ({lookupResult.unifiedLevel} RISK)
                    </span>
                  </div>

                  {lookupResult.courier && (
                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                      <b>5-Courier Network:</b> {lookupResult.courier.totalParcels} total parcels ·{" "}
                      <span style={{ color: "#15803D", fontWeight: 700 }}>
                        {lookupResult.courier.deliveredParcels} delivered ({lookupResult.courier.successRatio}%)
                      </span>{" "}
                      ·{" "}
                      <span style={{ color: "#DC2626", fontWeight: 700 }}>
                        {lookupResult.courier.cancelledParcels} returned
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: 11.5, color: "#475569", marginBottom: 10 }}>
                    <b>In your store:</b> {lookupResult.here.orders} orders (
                    {lookupResult.here.delivered} delivered, {lookupResult.here.returned} returned)
                  </div>

                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background:
                        lookupResult.unifiedLevel === "HIGH"
                          ? "#FEF2F2"
                          : lookupResult.unifiedLevel === "MEDIUM"
                          ? "#FFFBEB"
                          : "#F0FDF4",
                      color:
                        lookupResult.unifiedLevel === "HIGH"
                          ? "#991B1B"
                          : lookupResult.unifiedLevel === "MEDIUM"
                          ? "#B45309"
                          : "#166534",
                    }}
                  >
                    Advice:{" "}
                    {lookupResult.unifiedLevel === "HIGH"
                      ? "High return risk. Ask for ৳100 advance delivery fee before booking."
                      : lookupResult.unifiedLevel === "MEDIUM"
                      ? "Call customer to verify address and commitment before packing."
                      : "Safe for Cash on Delivery fulfillment."}
                  </div>

                  <div style={{ marginTop: 10, textAlign: "right" }}>
                    <Link
                      href={`/fraud?tab=check&phone=${encodeURIComponent(lookupResult.phone)}`}
                      className="link"
                      style={{ fontSize: 11.5 }}
                    >
                      View full 5-courier network breakdown →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ======================================================= */}
        {/* PANEL B: 1-CLICK BULK COURIER DISPATCH QUEUE            */}
        {/* ======================================================= */}
        <div
          className="card"
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                1-Click Bulk Dispatch Queue
              </h3>
              <span className="muted" style={{ fontSize: 11.5 }}>
                {dispatchQueue.length} orders ready to pack and book
              </span>
            </div>

            <Link href="/orders/ship" className="link" style={{ fontSize: 12 }}>
              Full Ship Desk →
            </Link>
          </div>

          {bulkBookingFeedback && (
            <div
              className="notice good"
              style={{ fontSize: 12, padding: "8px 12px", marginBottom: 10 }}
            >
              {bulkBookingFeedback}
            </div>
          )}

          {dispatchQueue.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center" }} className="muted">
              Every ready order has been booked with couriers.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              {/* Dispatch Controls Bar */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 10px",
                  background: "#F8FAFC",
                  borderRadius: 8,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedOrderIds.length > 0 &&
                      selectedOrderIds.length === dispatchQueue.length
                    }
                    onChange={handleToggleSelectAll}
                  />
                  <span>Select All ({dispatchQueue.length})</span>
                </label>

                <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
                  <select
                    className="input"
                    value={chosenCourier}
                    onChange={(e) => setChosenCourier(e.target.value)}
                    style={{ fontSize: 11.5, padding: "4px 8px", width: "auto" }}
                  >
                    {connectedCouriers.map((c) => (
                      <option key={c.provider} value={c.provider}>
                        {c.label}
                      </option>
                    ))}
                    {connectedCouriers.length === 0 && (
                      <option value="steadfast">Steadfast Courier</option>
                    )}
                  </select>

                  <select
                    className="input"
                    value={chosenWeight}
                    onChange={(e) => setChosenWeight(e.target.value)}
                    style={{ fontSize: 11.5, padding: "4px 8px", width: "auto" }}
                  >
                    <option value="0.5">0.5 kg</option>
                    <option value="1">1.0 kg</option>
                    <option value="2">2.0 kg</option>
                    <option value="5">5.0 kg</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleExecuteBulkBooking}
                    disabled={!canEdit || isBulkBooking || selectedOrderIds.length === 0}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 12px" }}
                  >
                    {isBulkBooking ? "Booking…" : `Book (${selectedOrderIds.length})`}
                  </button>
                </div>
              </div>

              {/* Order List Table */}
              <div
                style={{
                  maxHeight: 280,
                  overflowY: "auto",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                }}
              >
                {dispatchQueue.map((ord) => {
                  const isChecked = selectedOrderIds.includes(ord.id);
                  return (
                    <div
                      key={ord.id}
                      onClick={() => handleToggleOrderSelection(ord.id)}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                        background: isChecked ? "#EFF6FF" : "#FFF",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ cursor: "pointer" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: 700, fontSize: 12.5, color: "#2563EB" }}>
                            #{ord.orderNumber}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>
                            ৳ {ord.totalAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#334155" }}>
                          {ord.customerName} · {ord.shippingDistrict || "Dhaka"}
                        </div>
                        <div
                          className="muted"
                          style={{
                            fontSize: 10.5,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 340,
                          }}
                        >
                          {ord.itemsSummary}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. REAL-TIME ACTIVITY STREAM TICKER                       */}
      {/* ========================================================= */}
      {activityFeed.length > 0 && (
        <section
          className="card"
          style={{
            padding: "10px 14px",
            marginBottom: 16,
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              color: "#475569",
              marginBottom: 6,
            }}
          >
            <span>RECENT STORE ACTIVITY</span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              overflowX: "auto",
              whiteSpace: "nowrap",
              paddingBottom: 4,
            }}
          >
            {activityFeed.slice(0, 6).map((ev) => (
              <div
                key={ev.id}
                style={{
                  background: "#FFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 11.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: ev.type === "STATUS" ? "#2563EB" : "#16A34A",
                  }}
                />
                <span style={{ fontWeight: 700 }}>#{ev.orderNumber}</span>
                <span style={{ color: "#334155" }}>{ev.message}</span>
                <span style={{ color: "#94A3B8", fontSize: 10 }} suppressHydrationWarning>
                  {formatBDTime(ev.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
