"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { InventoryRow } from "@biztrackbd/core";
import { AdjustForm } from "./adjust-form";
import { quickAdjustStockAction } from "./actions";

export function InlineStockStepper({
  variantId,
  stock,
  onStockChange,
}: {
  variantId: string;
  stock: number;
  onStockChange: (newStock: number) => void;
}) {
  const [val, setVal] = useState(String(stock));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: two clicks in the same frame both see busy=false from state, so the second would send a stale delta.
  const busyRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setVal(String(stock));
  }, [stock]);

  async function applyAdjustment(mode: "delta" | "setTo", amount: number) {
    if (busyRef.current) return;
    const prevStock = stock;
    const targetStock = mode === "delta" ? Math.max(0, stock + amount) : Math.max(0, amount);
    if (targetStock === prevStock && mode === "setTo") return;

    // Optimistic UI update
    onStockChange(targetStock);
    setVal(String(targetStock));
    busyRef.current = true;
    setBusy(true);
    setError(null);

    const res = await quickAdjustStockAction(variantId, mode, amount).finally(() => {
      busyRef.current = false;
      setBusy(false);
    });

    if (!res.ok) {
      // Rollback on server failure
      onStockChange(prevStock);
      setVal(String(prevStock));
      setError(res.error);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setError(null), 3500);
      return;
    }

    onStockChange(res.quantityAfter);
    setVal(String(res.quantityAfter));
    setSaved(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setSaved(false), 1500);
  }

  function handleBlurOrEnter() {
    const parsed = parseInt(val.replace(/\D/g, ""), 10);
    if (isNaN(parsed) || parsed < 0) {
      setVal(String(stock));
      return;
    }
    if (parsed !== stock) {
      void applyAdjustment("setTo", parsed);
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <div
        className="row"
        style={{
          flexWrap: "nowrap",
          alignItems: "center",
          gap: 3,
          background: "var(--card-bg, #fff)",
          border: saved ? "1px solid var(--good, #2e7d32)" : "1px solid var(--line, #e0e0e0)",
          borderRadius: 6,
          padding: "2px 4px",
          transition: "border-color 0.2s ease",
        }}
      >
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{
            padding: "2px 8px",
            minWidth: 24,
            height: 26,
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1,
            cursor: stock <= 0 || busy ? "not-allowed" : "pointer",
            opacity: stock <= 0 || busy ? 0.35 : 1,
          }}
          aria-label="Decrease stock by 1"
          disabled={stock <= 0 || busy}
          onClick={() => void applyAdjustment("delta", -1)}
          data-testid={`dec-${variantId}`}
        >
          −
        </button>

        <input
          className="input input-sm"
          style={{
            width: 48,
            height: 26,
            textAlign: "center",
            padding: "2px 2px",
            fontWeight: 700,
            border: "none",
            background: "transparent",
            fontSize: 13.5,
          }}
          inputMode="numeric"
          value={val}
          aria-label="Stock count"
          data-testid={`stock-input-${variantId}`}
          disabled={busy}
          onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))}
          onBlur={handleBlurOrEnter}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleBlurOrEnter();
            }
          }}
        />

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{
            padding: "2px 8px",
            minWidth: 24,
            height: 26,
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.35 : 1,
          }}
          aria-label="Increase stock by 1"
          disabled={busy}
          onClick={() => void applyAdjustment("delta", 1)}
          data-testid={`inc-${variantId}`}
        >
          +
        </button>
      </div>
      {error && (
        <span style={{ fontSize: 11, color: "var(--danger, #d32f2f)", maxWidth: 140, textAlign: "right" }}>
          {error}
        </span>
      )}
    </div>
  );
}

export function InventoryTableRow({
  r,
  canEdit,
  back,
}: {
  r: InventoryRow;
  canEdit: boolean;
  /** Where to come back to after a save: the list with its filters. */
  back: string;
}) {
  const [stock, setStock] = useState(r.available);
  const state: InventoryRow["state"] = stock <= 0 ? "out" : stock <= r.reorderLevel ? "low" : "ok";
  const updatedRow = { ...r, available: stock, state };

  return (
    <tr data-testid="inv-row">
      <td>
        <b>{r.productTitle}</b>
        {r.variantTitle.toLowerCase() !== "default" && (
          <div className="muted" style={{ fontSize: 12.5 }}>{r.variantTitle}</div>
        )}
      </td>
      <td className="muted">{r.sku ?? "—"}</td>
      <td className="muted">{r.shelf ?? "—"}</td>
      <td className="r num">{r.committed}</td>
      <td className="r num">{r.reorderLevel}</td>
      <td className="r" style={{ minWidth: 130 }}>
        {canEdit ? (
          <InlineStockStepper variantId={r.variantId} stock={stock} onStockChange={setStock} />
        ) : (
          <b className="num" data-testid="available">{stock}</b>
        )}
      </td>
      <td>
        <span className={`pill ${state === "out" ? "bad" : state === "low" ? "warn" : "grey"}`} data-testid={`status-${r.variantId}`}>
          {state === "out" ? "Out" : state === "low" ? "Low" : "OK"}
        </span>
      </td>
      {canEdit && <td style={{ minWidth: 90 }}><AdjustForm r={updatedRow} back={back} /></td>}
    </tr>
  );
}

export function InventoryMobileCard({
  r,
  canEdit,
  back,
}: {
  r: InventoryRow;
  canEdit: boolean;
  /** Where to come back to after a save: the list with its filters. */
  back: string;
}) {
  const [stock, setStock] = useState(r.available);
  const state: InventoryRow["state"] = stock <= 0 ? "out" : stock <= r.reorderLevel ? "low" : "ok";
  const updatedRow = { ...r, available: stock, state };

  return (
    <div className="list-card" data-testid="inv-row">
      <div className="top" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <b>
          {r.productTitle}
          {r.variantTitle.toLowerCase() !== "default" ? ` · ${r.variantTitle}` : ""}
        </b>
        <span className={`pill ${state === "out" ? "bad" : state === "low" ? "warn" : "grey"}`}>
          {state === "out" ? "Out" : state === "low" ? "Low" : "OK"}
        </span>
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
        {r.sku ?? "No SKU"}{r.shelf ? ` · Shelf ${r.shelf}` : ""}
      </div>
      <div
        className="row"
        style={{
          marginTop: 10,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13 }}>
          {r.committed} committed · reorder at {r.reorderLevel}
        </span>
        {canEdit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>Available:</span>
            <InlineStockStepper variantId={r.variantId} stock={stock} onStockChange={setStock} />
          </div>
        ) : (
          <span><b className="num" data-testid="available">{stock}</b> available</span>
        )}
      </div>
      {canEdit && <div style={{ marginTop: 8 }}><AdjustForm r={updatedRow} back={back} /></div>}
    </div>
  );
}
