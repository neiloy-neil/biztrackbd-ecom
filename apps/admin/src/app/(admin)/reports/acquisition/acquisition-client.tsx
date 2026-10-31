"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AcquisitionReport, AcquisitionChannel, CampaignRow } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { updateCampaignSpendAction } from "./actions";

export interface AcquisitionClientProps {
  report: AcquisitionReport;
  currentRange: string;
  currentChannel?: string;
  currentSearch?: string;
}

export function AcquisitionClient({
  report,
  currentRange,
  currentChannel = "ALL",
  currentSearch = "",
}: AcquisitionClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedChannel, setSelectedChannel] = useState<string>(currentChannel);
  const [searchTerm, setSearchTerm] = useState<string>(currentSearch);
  const [touchModel, setTouchModel] = useState<"last" | "first">(report.period.touch);

  // Local state for inline editable ad spend
  const [editingSpends, setEditingSpends] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ key: string; ok: boolean } | null>(null);

  const kpis = report.kpis;

  function updateQuery(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    startTransition(() => {
      router.push(`/reports/acquisition?${params.toString()}`);
    });
  }

  function handlePreset(rangeKey: string) {
    updateQuery({ range: rangeKey, from: undefined, to: undefined });
  }

  function handleTouchToggle(model: "last" | "first") {
    setTouchModel(model);
    updateQuery({ touch: model });
  }

  async function handleSaveSpend(campaignKey: string) {
    const rawVal = editingSpends[campaignKey];
    if (rawVal === undefined) return;
    const num = Math.max(0, Number(rawVal) || 0);

    setSavingKey(campaignKey);
    setSaveStatus(null);
    try {
      const res = await updateCampaignSpendAction(campaignKey, num);
      if (res.ok) {
        setSaveStatus({ key: campaignKey, ok: true });
        startTransition(() => {
          router.refresh();
        });
      } else {
        setSaveStatus({ key: campaignKey, ok: false });
      }
    } catch {
      setSaveStatus({ key: campaignKey, ok: false });
    } finally {
      setSavingKey(null);
    }
  }

  // Filter campaigns by channel and search
  const filteredCampaigns = report.campaigns.filter((c) => {
    if (selectedChannel !== "ALL" && c.channel !== selectedChannel) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchName = c.name.toLowerCase().includes(q);
      const matchSource = c.source.toLowerCase().includes(q);
      const matchMedium = c.medium.toLowerCase().includes(q);
      if (!matchName && !matchSource && !matchMedium) return false;
    }
    return true;
  });

  const CHANNELS_FILTER: { id: string; label: string; icon: string }[] = [
    { id: "ALL", label: "All Channels", icon: "🌐" },
    { id: "META", label: "Meta Ads (FB/IG)", icon: "📱" },
    { id: "GOOGLE", label: "Google Ads", icon: "🔍" },
    { id: "TIKTOK", label: "TikTok Ads", icon: "🎵" },
    { id: "YOUTUBE", label: "YouTube", icon: "▶️" },
    { id: "WHATSAPP", label: "WhatsApp Direct", icon: "💬" },
    { id: "DIRECT", label: "Direct / Organic", icon: "🏠" },
  ];

  function roasBadgeClass(roas: number) {
    if (roas >= 4.0) return "badge-success";
    if (roas >= 2.0) return "badge-info";
    if (roas >= 1.0) return "badge-warning";
    if (roas > 0) return "badge-danger";
    return "badge-muted";
  }

  return (
    <div className="stack gap-lg">
      {/* Top Filter Bar: Time Windows + Attribution Model + Export */}
      <div className="card-panel-muted stack gap-md">
        <div className="flex-between flex-wrap gap-md">
          {/* Preset Buttons */}
          <div className="flex-center-y flex-wrap gap-xs">
            <span className="text-xs text-bold text-muted uppercase mr-xs">WINDOW:</span>
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "7d", label: "Last 7 Days" },
              { id: "30d", label: "Last 30 Days" },
              { id: "this_month", label: "This Month" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn btn-sm ${currentRange === p.id ? "btn-primary" : "btn-secondary"}`}
                onClick={() => handlePreset(p.id)}
                disabled={isPending}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Model Toggle: Last-Touch vs First-Touch */}
          <div className="flex-center-y gap-xs bg-surface p-xxs border rounded-md">
            <span className="text-xs text-muted pl-xs">ATTRIBUTION:</span>
            <button
              type="button"
              className={`btn btn-xs ${touchModel === "last" ? "btn-primary" : "btn-subtle"}`}
              onClick={() => handleTouchToggle("last")}
            >
              Last-Touch (Closing)
            </button>
            <button
              type="button"
              className={`btn btn-xs ${touchModel === "first" ? "btn-primary" : "btn-subtle"}`}
              onClick={() => handleTouchToggle("first")}
            >
              First-Touch (Discovery)
            </button>
          </div>

          {/* CSV Export Button */}
          <div>
            <a
              href={`/reports/acquisition/export?from=${report.period.from}&to=${report.period.to}&touch=${touchModel}`}
              className="btn btn-secondary btn-sm"
              download
            >
              📥 Export CSV
            </a>
          </div>
        </div>

        {/* Channel Filter Chips & Search */}
        <div className="flex-between flex-wrap gap-md border-top pt-sm">
          <div className="flex-center-y flex-wrap gap-xs">
            {CHANNELS_FILTER.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={`btn btn-xs ${selectedChannel === ch.id ? "btn-primary" : "btn-secondary"}`}
                onClick={() => {
                  setSelectedChannel(ch.id);
                  updateQuery({ channel: ch.id === "ALL" ? undefined : ch.id });
                }}
              >
                <span className="mr-xxs">{ch.icon}</span>
                {ch.label}
              </button>
            ))}
          </div>

          <div className="flex-center-y gap-xs">
            <input
              type="search"
              placeholder="Filter campaign or UTM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-sm"
              style={{ minWidth: "220px" }}
            />
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="stats-grid grid-4 gap-md">
        <div className="stat-card">
          <div className="text-xs text-muted uppercase font-mono">Gross Ad Revenue</div>
          <div className="stat-value text-primary">{taka(kpis.grossRevenue)}</div>
          <div className="text-xs text-muted mt-xs">
            {kpis.adAttributedOrders} of {kpis.totalOrders} orders attributed
          </div>
        </div>

        <div className="stat-card">
          <div className="text-xs text-muted uppercase font-mono">Total Ad Spend</div>
          <div className="stat-value">{taka(kpis.totalAdSpend)}</div>
          <div className="text-xs text-muted mt-xs">
            Editable per campaign below
          </div>
        </div>

        <div className="stat-card">
          <div className="text-xs text-muted uppercase font-mono">Blended ROAS</div>
          <div className="stat-value">
            <span className={`badge ${roasBadgeClass(kpis.blendedRoas)} text-lg px-sm py-xxs`}>
              {kpis.blendedRoas > 0 ? `${kpis.blendedRoas.toFixed(2)}x` : "0.00x"}
            </span>
          </div>
          <div className="text-xs text-muted mt-xs">
            Delivered ROAS: <strong>{kpis.deliveredRoas.toFixed(2)}x</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="text-xs text-muted uppercase font-mono">Meta CAPI Health</div>
          <div className="stat-value">
            <span className="badge badge-success text-sm">
              {report.capiHealth.matchQualityGrade}
            </span>
          </div>
          <div className="text-xs text-muted mt-xs">
            {report.capiHealth.serverEvents} server events ({report.capiHealth.dedupeRatePercent}% deduplicated)
          </div>
        </div>
      </div>

      {/* Channel Share Distribution */}
      <div className="card p-md stack gap-sm">
        <div className="flex-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Acquisition Channel Distribution
          </h3>
          <span className="text-xs text-muted">
            Top Channel: <strong>{kpis.topChannel}</strong>
          </span>
        </div>

        <div className="grid-3 gap-md">
          {report.channels
            .filter((ch) => ch.ordersCount > 0 || ch.grossRevenue > 0)
            .map((ch) => (
              <div key={ch.channel} className="p-sm border rounded bg-surface stack gap-xs">
                <div className="flex-between">
                  <span className="font-semibold text-sm">{ch.label}</span>
                  <span className="badge badge-subtle">{ch.sharePercent}%</span>
                </div>
                <div className="flex-between text-xs text-muted">
                  <span>{ch.ordersCount} orders</span>
                  <span className="font-mono text-bold">{taka(ch.grossRevenue)}</span>
                </div>
                {/* Visual bar */}
                <div className="progress-bar-bg" style={{ height: "6px", background: "var(--border, #e2e8f0)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, ch.sharePercent)}%`,
                      background: "var(--primary, #0284c7)",
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Campaign Performance & ROAS Table */}
      <div className="card p-none overflow-hidden stack">
        <div className="p-md flex-between border-bottom bg-surface">
          <div>
            <h3 className="text-base font-semibold">Campaign Performance & Unit ROAS</h3>
            <p className="text-xs text-muted">
              Input your ad spend directly in the table to calculate live ROAS (Gross Revenue ÷ Spend) and Net Profit.
            </p>
          </div>
          <div className="text-xs text-muted">
            Showing {filteredCampaigns.length} campaigns
          </div>
        </div>

        <div className="table-responsive">
          <table className="table w-full">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>Campaign & Channel</th>
                <th style={{ textAlign: "right", width: "10%" }}>Orders</th>
                <th style={{ textAlign: "right", width: "12%" }}>Gross Sales</th>
                <th style={{ textAlign: "right", width: "12%" }}>Delivered</th>
                <th style={{ textAlign: "right", width: "16%" }}>Ad Spend (৳)</th>
                <th style={{ textAlign: "center", width: "10%" }}>ROAS</th>
                <th style={{ textAlign: "right", width: "8%" }}>Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-xl text-muted">
                    No marketing campaigns recorded for this date window. Incoming ad clicks with UTM tags will appear here automatically.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((c) => {
                  const isEditing = editingSpends[c.key] !== undefined;
                  const currentSpendValue = isEditing ? editingSpends[c.key] : String(c.adSpend || "");
                  const isSaving = savingKey === c.key;
                  const hasSaved = saveStatus?.key === c.key && saveStatus.ok;

                  return (
                    <tr key={c.key}>
                      <td>
                        <div className="stack gap-xxs">
                          <div className="flex-center-y gap-xs">
                            <span className="badge badge-subtle text-xs">{c.channelLabel}</span>
                            <span className="font-semibold text-sm">{c.name}</span>
                          </div>
                          {(c.source !== "direct" || c.medium !== "none") && (
                            <div className="text-xs text-muted font-mono">
                              utm_source={c.source} | utm_medium={c.medium}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="font-bold">{c.ordersCount}</div>
                        <div className="text-xs text-muted">
                          {c.deliveredCount} del / {c.cancelledCount} can
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }} className="font-mono font-semibold">
                        {taka(c.grossRevenue)}
                        <div className="text-xs text-muted font-normal">AOV: {taka(c.aov)}</div>
                      </td>
                      <td style={{ textAlign: "right" }} className="font-mono text-muted">
                        {taka(c.deliveredRevenue)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="flex-center-y justify-end gap-xs">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            placeholder="0"
                            className="input input-xs font-mono text-right"
                            style={{ width: "95px" }}
                            value={currentSpendValue}
                            onChange={(e) =>
                              setEditingSpends((prev) => ({
                                ...prev,
                                [c.key]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                void handleSaveSpend(c.key);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            onClick={() => handleSaveSpend(c.key)}
                            disabled={isSaving}
                            title="Save Spend"
                          >
                            {isSaving ? "..." : "Save"}
                          </button>
                        </div>
                        {hasSaved && <div className="text-xs text-success mt-xxs">Saved ✓</div>}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${roasBadgeClass(c.roas)}`}>
                          {c.roas > 0 ? `${c.roas.toFixed(2)}x` : "—"}
                        </span>
                      </td>
                      <td
                        style={{ textAlign: "right" }}
                        className={`font-mono font-semibold ${c.netProfit >= 0 ? "text-success" : "text-danger"}`}
                      >
                        {taka(c.netProfit)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Meta CAPI & GA4 Live Event Stream */}
      <div className="card p-md stack gap-md">
        <div className="flex-between flex-wrap gap-sm">
          <div>
            <h3 className="text-base font-semibold">Meta CAPI & GA4 Event Stream</h3>
            <p className="text-xs text-muted">
              Browser pixels and server-side Conversions API events are deduplicated using identical deterministic event IDs.
            </p>
          </div>
          <div>
            <Link href="/marketing/pixels/health" className="btn btn-secondary btn-sm">
              Advanced CAPI Diagnostics →
            </Link>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table w-full text-xs">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Event Type</th>
                <th>Channel / Origin</th>
                <th>Status</th>
                <th>Order ID</th>
                <th>Logged At</th>
              </tr>
            </thead>
            <tbody>
              {report.capiHealth.recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-md text-muted">
                    No recent conversion events recorded.
                  </td>
                </tr>
              ) : (
                report.capiHealth.recentEvents.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono">{e.eventId}</td>
                    <td className="font-semibold">{e.name}</td>
                    <td>
                      <span className={`badge ${e.origin === "SERVER" ? "badge-primary" : "badge-secondary"}`}>
                        {e.origin}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${e.status === "SENT" ? "badge-success" : e.status === "FAILED" ? "badge-danger" : "badge-info"}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="font-mono text-muted">{e.orderId || "—"}</td>
                    <td className="text-muted">{new Date(e.createdAt).toLocaleTimeString()}</td>
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
