"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { REPORT_PRESETS } from "@biztrackbd/core/reports-presets";
import { SubmitButton } from "@/components/ui";

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
    <div className="card-panel-muted mb-md stack gap-sm">
      <div className="flex-between flex-wrap gap-sm">
        <div className="flex-center-y flex-wrap gap-xs">
          <span className="text-xs text-bold text-muted uppercase mr-xs">
            TIME WINDOW:
          </span>
          {REPORT_PRESETS.map((p) => {
            const active = currentPreset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                className={`chip cursor-pointer text-xs ${active ? "active" : ""}`}
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            className={`chip cursor-pointer text-xs ${currentPreset === "custom" || isCustomOpen ? "active" : ""}`}
            onClick={() => setIsCustomOpen((open) => !open)}
          >
            Custom Range ▾
          </button>
        </div>
      </div>

      {isCustomOpen && (
        <form
          onSubmit={handleApplyCustom}
          className="flex-center-y flex-wrap gap-sm pt-xs border-top-dashed"
        >
          <div className="flex-center-y gap-xs">
            <label htmlFor="custom-from" className="text-xs text-medium">
              From:
            </label>
            <input
              id="custom-from"
              type="date"
              className="input input-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </div>

          <div className="flex-center-y gap-xs">
            <label htmlFor="custom-to" className="text-xs text-medium">
              To:
            </label>
            <input
              id="custom-to"
              type="date"
              className="input input-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </div>

          <SubmitButton
            className="btn btn-primary btn-sm"
            pending="Working…"
          >
            Apply Range
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
