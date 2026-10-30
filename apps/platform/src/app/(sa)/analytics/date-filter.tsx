"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface DateFilterProps {
  currentPreset?: string;
  currentFrom?: string;
  currentTo?: string;
  currentDevice?: string | null;
  currentCampaign?: string | null;
}

export function AnalyticsFilterBar({
  currentPreset = "30",
  currentFrom = "",
  currentTo = "",
  currentDevice = "",
  currentCampaign = "",
}: DateFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fromInput, setFromInput] = useState(currentFrom);
  const [toInput, setToInput] = useState(currentTo);

  const presets = [
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "7 Days", value: "7" },
    { label: "30 Days", value: "30" },
    { label: "This Month", value: "month" },
  ];

  const updateParam = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    router.push(`/analytics?${params.toString()}`);
  };

  const selectPreset = (val: string) => {
    updateParam({ range: val, from: null, to: null });
  };

  const applyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromInput || !toInput) return;
    updateParam({ range: null, from: fromInput, to: toInput });
  };

  const isCustom = !presets.some((p) => p.value === currentPreset) && Boolean(currentFrom && currentTo);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        {/* Preset Range Buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", marginRight: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Time Window:
          </span>
          {presets.map((p) => {
            const active = currentPreset === p.value && !isCustom;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => selectPreset(p.value)}
                style={{
                  border: active ? "1px solid var(--brand-primary, #0B4D3B)" : "1px solid var(--line)",
                  background: active ? "var(--brand-primary, #0B4D3B)" : "var(--bg)",
                  color: active ? "#fff" : "var(--ink)",
                  fontWeight: active ? 700 : 500,
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Device Segmented Control */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", marginRight: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Device:
          </span>
          {[
            { label: "All Devices", value: "" },
            { label: "📱 Mobile", value: "mobile" },
            { label: "💻 Desktop", value: "desktop" },
          ].map((d) => {
            const active = (currentDevice || "") === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => updateParam({ device: d.value ? d.value : null })}
                style={{
                  border: active ? "1px solid var(--ink)" : "1px solid var(--line)",
                  background: active ? "var(--ink)" : "var(--bg)",
                  color: active ? "#fff" : "var(--ink)",
                  fontWeight: active ? 700 : 500,
                  fontSize: 12,
                  padding: "5px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Range & Active Campaign Filters Bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 10, borderTop: "1px dashed var(--line)" }}>
        {/* Custom date range form */}
        <form onSubmit={applyCustomRange} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>Custom Dates:</span>
          <input
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--line)",
              borderRadius: 6,
              fontSize: 12,
              background: "var(--bg)",
              color: "var(--ink)",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>to</span>
          <input
            type="date"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--line)",
              borderRadius: 6,
              fontSize: 12,
              background: "var(--bg)",
              color: "var(--ink)",
            }}
          />
          <button type="submit" className="btn btn-secondary btn-sm" style={{ height: 28, fontSize: 11.5, padding: "0 10px" }}>
            Apply Dates
          </button>
        </form>

        {/* Active Filters Indicators */}
        {(Boolean(currentCampaign) || Boolean(currentDevice) || isCustom) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>Active Filters:</span>
            {currentCampaign && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  color: "#1E40AF",
                  borderRadius: 16,
                  padding: "2px 10px",
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                Campaign: {currentCampaign}
                <button
                  type="button"
                  onClick={() => updateParam({ campaign: null })}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#1E40AF", fontWeight: 800, padding: 0 }}
                  title="Remove campaign filter"
                >
                  ✕
                </button>
              </span>
            )}
            {currentDevice && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#F3F4F6",
                  border: "1px solid #E5E7EB",
                  color: "#374151",
                  borderRadius: 16,
                  padding: "2px 10px",
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                {currentDevice === "mobile" ? "📱 Mobile" : "💻 Desktop"}
                <button
                  type="button"
                  onClick={() => updateParam({ device: null })}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#374151", fontWeight: 800, padding: 0 }}
                  title="Remove device filter"
                >
                  ✕
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => updateParam({ range: "30", from: null, to: null, campaign: null, device: null })}
              style={{
                border: "none",
                background: "none",
                color: "var(--danger, #DC2626)",
                cursor: "pointer",
                fontSize: 11.5,
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
