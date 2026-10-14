"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { renderCode128Svg } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import {
  type BarcodePrintItem,
  assignMissingBarcodesAction,
} from "./actions";

interface Props {
  initialItems: BarcodePrintItem[];
  storeName: string;
}

type PaperFormat = "THERMAL_50X30" | "THERMAL_38X25" | "SHEET_A4_24";

function safeHtml(html: string): string {
  return html;
}

export function BarcodeLabelStudioClient({ initialItems, storeName }: Props) {
  const [items, setItems] = useState<BarcodePrintItem[]>(initialItems);
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<PaperFormat>("THERMAL_50X30");
  const [showStoreName, setShowStoreName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showVariant, setShowVariant] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.productTitle.toLowerCase().includes(q) ||
        item.variantTitle.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.toLowerCase().includes(q))
    );
  }, [items, search]);

  const totalSelectedLabels = useMemo(() => {
    return Object.values(selectedMap).reduce((sum, qty) => sum + qty, 0);
  }, [selectedMap]);

  function handleSelectToggle(variantId: string, currentQty = 1) {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[variantId]) {
        delete next[variantId];
      } else {
        next[variantId] = Math.max(1, currentQty);
      }
      return next;
    });
  }

  function handleQtyChange(variantId: string, qty: number) {
    const safeQty = Math.max(0, qty);
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (safeQty === 0) {
        delete next[variantId];
      } else {
        next[variantId] = safeQty;
      }
      return next;
    });
  }

  function handleSelectAll() {
    const next: Record<string, number> = {};
    for (const item of filteredItems) {
      next[item.variantId] = 1;
    }
    setSelectedMap(next);
  }

  function handleDeselectAll() {
    setSelectedMap({});
  }

  function handleFillFromStock() {
    const next: Record<string, number> = {};
    for (const item of filteredItems) {
      if (item.stockQuantity > 0) {
        next[item.variantId] = item.stockQuantity;
      }
    }
    setSelectedMap(next);
  }

  async function handleAutoAssignMissing() {
    setBusy(true);
    setStatusMessage("");
    try {
      const res = await assignMissingBarcodesAction();
      setStatusMessage(`Generated barcodes for ${res.updatedCount} items.`);
      // Reload page to get fresh barcodes
      window.location.reload();
    } catch (e: any) {
      setStatusMessage(e.message || "Failed to generate missing barcodes.");
    } finally {
      setBusy(false);
    }
  }

  // Generate flat array of labels to render for printing
  const labelsToPrint = useMemo(() => {
    const list: Array<{ item: BarcodePrintItem; svg: string }> = [];
    for (const item of items) {
      const count = selectedMap[item.variantId] || 0;
      if (count > 0 && item.barcode) {
        const svg = renderCode128Svg(item.barcode, {
          height: format === "THERMAL_38X25" ? 28 : 36,
          barWidth: format === "THERMAL_38X25" ? 1.5 : 1.8,
          showText: true,
          fontSize: 9,
        });
        for (let i = 0; i < count; i++) {
          list.push({ item, svg });
        }
      }
    }
    return list;
  }, [items, selectedMap, format]);

  return (
    <>
      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .no-print { display: none !important; }
          
          /* Thermal 50x30 mm */
          .paper-thermal-50x30 {
            width: 50mm;
          }
          .paper-thermal-50x30 .print-label {
            width: 50mm;
            height: 30mm;
            page-break-after: always;
            box-sizing: border-box;
            padding: 2mm 3mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
          }

          /* Thermal 38x25 mm */
          .paper-thermal-38x25 {
            width: 38mm;
          }
          .paper-thermal-38x25 .print-label {
            width: 38mm;
            height: 25mm;
            page-break-after: always;
            box-sizing: border-box;
            padding: 1.5mm 2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
          }

          /* A4 Sheet 24-up */
          .paper-sheet-a4-24 {
            width: 210mm;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(3, 70mm);
            grid-auto-rows: 37mm;
            gap: 0;
            box-sizing: border-box;
            padding: 0;
          }
          .paper-sheet-a4-24 .print-label {
            width: 70mm;
            height: 37mm;
            box-sizing: border-box;
            padding: 2mm 4mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
            overflow: hidden;
          }
        }
      `}</style>

      {/* Screen Interface */}
      <div className="no-print">
        <div className="page-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link href="/products" className="btn btn-secondary btn-sm">
                ← Products
              </Link>
              <h1>Barcode Label Studio</h1>
              <span className="pill green">Direct Thermal & A4</span>
            </div>
            <p className="page-sub">
              Select products, customize sticker layout, and print standard barcode labels for clothing hangtags, boxes, and shelf edges.
            </p>
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={labelsToPrint.length === 0}
              onClick={() => window.print()}
            >
              🖨️ Print {totalSelectedLabels > 0 ? `${totalSelectedLabels} Labels` : "Labels"}
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="notice good" style={{ marginBottom: 16 }}>
            {statusMessage}
          </div>
        )}

        <div className="split" style={{ alignItems: "flex-start" }}>
          {/* Left Column: Product Selection */}
          <div className="col stack" style={{ flex: 1.2 }}>
            <section className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <input
                  className="input"
                  style={{ maxWidth: 300 }}
                  placeholder="Search products, SKU, or barcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleSelectAll}>
                    Select All
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleFillFromStock}>
                    Fill From Stock
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleDeselectAll}>
                    Clear
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={handleAutoAssignMissing}
                    title="Auto-assigns unique standard barcodes to variants that don't have one"
                  >
                    ⚡ Auto-Generate Missing
                  </button>
                </div>
              </div>

              <div style={{ maxHeight: 520, overflowY: "auto", border: "1px solid var(--line-2, #e5e7eb)", borderRadius: 8 }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>Product / Variant</th>
                      <th>Barcode</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th style={{ width: 100 }}>Print Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const isSelected = Boolean(selectedMap[item.variantId]);
                      const printQty = selectedMap[item.variantId] || 0;
                      return (
                        <tr
                          key={item.variantId}
                          style={{ background: isSelected ? "rgba(99, 102, 241, 0.05)" : "transparent" }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!item.barcode}
                              onChange={() => handleSelectToggle(item.variantId)}
                            />
                          </td>
                          <td>
                            <strong>{item.productTitle}</strong>
                            {item.variantTitle && (
                              <div style={{ fontSize: 12, color: "var(--ink-2, #6b7280)" }}>
                                {item.variantTitle}
                              </div>
                            )}
                            {item.sku && (
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280" }}>
                                SKU: {item.sku}
                              </span>
                            )}
                          </td>
                          <td>
                            {item.barcode ? (
                              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{item.barcode}</span>
                            ) : (
                              <span className="pill grey" style={{ fontSize: 11 }}>No Barcode</span>
                            )}
                          </td>
                          <td>{taka(item.price)}</td>
                          <td>{item.stockQuantity}</td>
                          <td>
                            <input
                              type="number"
                              className="input input-sm"
                              style={{ width: 70, textAlign: "center" }}
                              min={0}
                              max={500}
                              value={printQty}
                              disabled={!item.barcode}
                              onChange={(e) => handleQtyChange(item.variantId, parseInt(e.target.value, 10) || 0)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Right Column: Settings & Live Preview */}
          <div className="col stack" style={{ flex: 1 }}>
            {/* Format Settings */}
            <section className="card">
              <h2>Label & Printer Settings</h2>
              <label className="field">
                <span className="label">Printer & Paper Size</span>
                <select
                  className="select"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as PaperFormat)}
                >
                  <option value="THERMAL_50X30">Thermal Roll: 50 × 30 mm (Standard Clothing / Retail)</option>
                  <option value="THERMAL_38X25">Thermal Roll: 38 × 25 mm (Compact Jewelry / Cosmetics)</option>
                  <option value="SHEET_A4_24">A4 Sticker Sheet: 24 Labels (3 × 8 Grid)</option>
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                  />
                  <span>Show Store Name</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                  />
                  <span>Show Price (৳)</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={showVariant}
                    onChange={(e) => setShowVariant(e.target.checked)}
                  />
                  <span>Show Variant / Size</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={showSku}
                    onChange={(e) => setShowSku(e.target.checked)}
                  />
                  <span>Show SKU</span>
                </label>
              </div>
            </section>

            {/* Live On-Screen Preview */}
            <section className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2>Live Sticker Preview</h2>
                <span className="muted" style={{ fontSize: 13 }}>
                  Showing {Math.min(labelsToPrint.length, 6)} of {labelsToPrint.length}
                </span>
              </div>

              {labelsToPrint.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--ink-2, #6b7280)", border: "1px dashed var(--line-2, #d1d5db)", borderRadius: 8 }}>
                  Select one or more products on the left with quantities to preview printable labels.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: format === "SHEET_A4_24" ? "repeat(2, 1fr)" : "repeat(2, 1fr)",
                    gap: 12,
                    maxHeight: 460,
                    overflowY: "auto",
                    padding: 8,
                    background: "#f3f4f6",
                    borderRadius: 8,
                  }}
                >
                  {labelsToPrint.slice(0, 6).map(({ item, svg }, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        padding: "8px 10px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "space-between",
                        textAlign: "center",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        minHeight: format === "THERMAL_38X25" ? 120 : 140,
                      }}
                    >
                      {showStoreName && (
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#374151" }}>
                          {storeName}
                        </div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", lineHeight: 1.2, margin: "2px 0" }}>
                        {item.productTitle}
                      </div>
                      {(showVariant || showSku) && (
                        <div style={{ fontSize: 11, color: "#4b5563" }}>
                          {showVariant && item.variantTitle && <span>{item.variantTitle} </span>}
                          {showSku && item.sku && <span>({item.sku})</span>}
                        </div>
                      )}
                      <div
                        style={{ margin: "4px 0", maxWidth: "100%" }}
                        dangerouslySetInnerHTML={{ __html: safeHtml(svg) }}
                      />
                      {showPrice && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                          ৳ {item.price.toLocaleString("en-BD")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Hidden Print-Only Container (Rendered on window.print()) */}
      <div className="print-only print-area">
        <div
          className={
            format === "THERMAL_50X30"
              ? "paper-thermal-50x30"
              : format === "THERMAL_38X25"
              ? "paper-thermal-38x25"
              : "paper-sheet-a4-24"
          }
        >
          {labelsToPrint.map(({ item, svg }, idx) => (
            <div key={idx} className="print-label">
              {showStoreName && (
                <div style={{ fontSize: "8pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  {storeName}
                </div>
              )}
              <div style={{ fontSize: "8.5pt", fontWeight: "bold", lineHeight: 1.1 }}>
                {item.productTitle}
              </div>
              {(showVariant || showSku) && (
                <div style={{ fontSize: "7.5pt", color: "#333" }}>
                  {showVariant && item.variantTitle && <span>{item.variantTitle} </span>}
                  {showSku && item.sku && <span>({item.sku})</span>}
                </div>
              )}
              <div
                style={{ margin: "1mm 0", maxWidth: "100%" }}
                dangerouslySetInnerHTML={{ __html: safeHtml(svg) }}
              />
              {showPrice && (
                <div style={{ fontSize: "9pt", fontWeight: "bold" }}>
                  ৳ {item.price.toLocaleString("en-BD")}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
