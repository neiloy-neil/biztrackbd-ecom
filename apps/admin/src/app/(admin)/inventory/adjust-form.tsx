"use client";

import type { InventoryRow } from "@biztrackbd/core";
import { ActionDrawer } from "@/components/adjust-drawer";
import { SubmitButton } from "@/components/ui";
import { adjustAction, stockSettingsAction } from "./actions";
import { StockHistory } from "./stock-history";

const REASON_LABEL: Record<string, string> = { RECOUNT: "Stock count", RECEIVED: "New stock received", DAMAGED: "Damaged or lost", RETURNED: "Customer return", CORRECTION: "Correction", OTHER: "Other" };
const STOCK_REASONS = Object.keys(REASON_LABEL);

/** The Adjust drawer for one stock line. A browser component, so the list can hand it the live (just changed) row without passing a function from the server. */
export function AdjustForm({ r, back }: { r: InventoryRow; back: string }) {
  const name = `${r.productTitle}${r.variantTitle.toLowerCase() !== "default" ? ` · ${r.variantTitle}` : ""}`;
  return (
    <ActionDrawer label="Adjust" title={name} testId={`adjust-${r.sku ?? r.variantId}`}>
      <div className="stack" style={{ gap: 16 }}>
        <p className="muted" style={{ margin: 0 }}><b className="num">{r.available}</b> available now · {r.committed} committed to orders</p>
        <form action={adjustAction.bind(null, r.variantId)} className="stack">
          <input type="hidden" name="back" value={back} />
          <div className="row-2">
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Change</span>
              <select className="select" name="mode" defaultValue="add"><option value="add">Add</option><option value="remove">Remove</option><option value="set">Set count to</option></select></label>
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Units</span><input className="input" name="amount" inputMode="numeric" required data-testid="adjust-amount" /></label>
          </div>
          <label className="field" style={{ marginBottom: 0 }}><span className="label">Reason</span>
            <select className="select" name="reason" defaultValue="RECEIVED">{STOCK_REASONS.map((x) => <option key={x} value={x}>{REASON_LABEL[x]}</option>)}</select></label>
          <label className="field" style={{ marginBottom: 0 }}><span className="label">Note <span className="opt">(optional)</span></span><input className="input" name="note" maxLength={200} /></label>
          <SubmitButton className="btn btn-primary btn-block" pending="Saving…">Save change</SubmitButton>
        </form>
        <form action={stockSettingsAction.bind(null, r.variantId)} className="stack" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <input type="hidden" name="back" value={back} />
          <div className="muted" style={{ fontSize: 12.5, fontWeight: 700 }}>SHELF AND REORDER LEVEL</div>
          <div className="row-2">
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Reorder at</span><input className="input" name="reorder" inputMode="numeric" defaultValue={r.reorderLevel} /></label>
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Shelf</span><input className="input" name="shelf" defaultValue={r.shelf ?? ""} maxLength={20} /></label>
          </div>
          <SubmitButton className="btn btn-secondary" pending="…">Save</SubmitButton>
        </form>
        <StockHistory variantId={r.variantId} />
      </div>
    </ActionDrawer>
  );
}
