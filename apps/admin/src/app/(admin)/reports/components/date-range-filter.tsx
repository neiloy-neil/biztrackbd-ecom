"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { REPORT_PRESETS } from "@biztrackbd/core";

export function DateRangeFilter({
  basePath,
  currentPreset,
  currentFrom,
  currentTo,
}: {
  basePath: string;
  currentPreset: string;
  currentFrom: string;
  currentTo: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(currentFrom);
  const [to, setTo] = useState(currentTo);
  const [isCustomOpen, setIsCustomOpen] = useState(currentPreset === "custom");

  function handlePreset(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", key);
    params.delete("from");
    params.delete("to");
    router.push(`${basePath}?${params.toString()}`);
  }

  function handleApplyCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.set("from", from);
    params.set("to", to);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginBottom: 16,
        background: "var(--bg-subtle, #f8fafc)",
        padding: "12px 16px",
        borderRadius: 8,
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginRight: 4 }}>
            TIME WINDOW:
          </span>
          {REPORT_PRESETS.map((p) => {
            const active = currentPreset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                className={`chip ${active ? "active" : ""}`}
                onClick={() => handlePreset(p.key)}
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  border: active ? "1px solid #2563eb" : "1px solid var(--border)",
                  background: active ? "#2563eb" : "#ffffff",
                  color: active ? "#ffffff" : "inherit",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            className={`chip ${currentPreset === "custom" || isCustomOpen ? "active" : ""}`}
            onClick={() => setIsCustomOpen((open) => !open)}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              cursor: "pointer",
              border:
                currentPreset === "custom" ? "1px solid #2563eb" : "1px solid var(--border)",
              background: currentPreset === "custom" ? "#2563eb" : "#ffffff",
              color: currentPreset === "custom" ? "#ffffff" : "inherit",
              fontWeight: currentPreset === "custom" ? 600 : 400,
            }}
          >
            Custom Range ▾
          </button>
        </div>
      </div>

      {isCustomOpen && (
        <form
          onSubmit={handleApplyCustom}
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            paddingTop: 8,
            borderTop: "1px dashed var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label htmlFor="custom-from" style={{ fontSize: 12, fontWeight: 600 }}>
              From:
            </label>
            <input
              id="custom-from"
              type="date"
              className="input input-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
              style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label htmlFor="custom-to" style={{ fontSize: 12, fontWeight: 600 }}>
              To:
            </label>
            <input
              id="custom-to"
              type="date"
              className="input input-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
              style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)" }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{ padding: "4px 12px", fontSize: 12 }}
          >
            Apply Range
          </button>
        </form>
      )}
    </div>
  );
}
