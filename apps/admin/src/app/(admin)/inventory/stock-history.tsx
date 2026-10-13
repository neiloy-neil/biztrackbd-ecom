"use client";

import { useEffect, useState } from "react";
import { getStockHistoryAction, type StockHistoryItem } from "./actions";

const REASON_LABEL: Record<string, string> = {
  RECOUNT: "Stock count",
  RECEIVED: "New stock",
  DAMAGED: "Damaged / lost",
  RETURNED: "Customer return",
  CORRECTION: "Correction",
  OTHER: "Other",
};

export function StockHistory({ variantId }: { variantId: string }) {
  const [items, setItems] = useState<StockHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getStockHistoryAction(variantId)
      .then((data) => {
        if (active) {
          setItems(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load history");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [variantId]);

  return (
    <div className="stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 14, gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Adjustment Audit Log
        </div>
        {items && items.length > 0 && (
          <span className="muted" style={{ fontSize: 12 }}>
            Last {items.length} {items.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {loading && (
        <div className="muted" style={{ fontSize: 13, padding: "8px 0" }}>
          Loading adjustment history…
        </div>
      )}

      {error && (
        <div className="notice bad" style={{ fontSize: 12, padding: "6px 10px" }}>
          {error}
        </div>
      )}

      {!loading && !error && items && items.length === 0 && (
        <div className="muted" style={{ fontSize: 13, padding: "8px 0" }}>
          No manual adjustments recorded yet.
        </div>
      )}

      {!loading && !error && items && items.length > 0 && (
        <div className="stack" style={{ gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
          {items.map((item) => {
            const isPlus = item.delta > 0;
            const deltaStr = isPlus ? `+${item.delta}` : `${item.delta}`;
            const dateStr = new Date(item.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            const reasonName = REASON_LABEL[item.reason] ?? item.reason;

            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--chip, #f3f4f6)",
                  fontSize: 13,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontFamily: "monospace",
                        fontSize: 14,
                        color: isPlus ? "var(--success, #15803d)" : "var(--danger, #dc2626)",
                      }}
                    >
                      {deltaStr}
                    </span>
                    <span className="pill grey" style={{ fontSize: 11, padding: "2px 6px" }}>
                      {reasonName}
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      → {item.quantityAfter} left
                    </span>
                  </div>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {dateStr}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    by {item.actorName}
                  </span>
                  {item.note && (
                    <span style={{ fontSize: 11.5, fontStyle: "italic", color: "var(--ink-2)" }}>
                      &ldquo;{item.note}&rdquo;
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
