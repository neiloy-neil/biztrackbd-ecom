"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { SaveBar, Segmented } from "@biztrackbd/ui";
import { saveInvoiceAction, type InvoiceState } from "./actions";

type Paper = "a4" | "a5" | "thermal";
type Doc = "invoice" | "slip" | "label";
export interface InvoiceValues { footer: string; showLogo: boolean; showSku: boolean; showPricesOnSlip: boolean; paper: Paper; hasLogo: boolean }

const WIDTH: Record<Paper, number> = { a4: 820, a5: 600, thermal: 360 };
const HEIGHT: Record<Paper, number> = { a4: 1100, a5: 800, thermal: 700 };

/** The real print page, laid out with a made-up order and the options being edited, scaled down to fit. Nothing here is saved or printed. */
function Preview({ doc, paper, showLogo, showSku, prices, footer }: { doc: Doc; paper: Paper; showLogo: boolean; showSku: boolean; prices: boolean; footer: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [src, setSrc] = useState("");
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / WIDTH[paper]));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paper]);
  useEffect(() => {
    const q = new URLSearchParams({ sample: "1", doc, size: paper, showLogo: showLogo ? "1" : "0", showSku: showSku ? "1" : "0", prices: prices ? "1" : "0", footer });
    const t = setTimeout(() => setSrc(`/orders/print?${q.toString()}`), 250);
    return () => clearTimeout(t);
  }, [doc, paper, showLogo, showSku, prices, footer]);
  const h = HEIGHT[paper];
  return (
    <div ref={wrap} className="inv-frame" style={{ height: h * scale }} data-testid="invoice-preview">
      {src && <iframe title="Preview of the printed page" src={src} style={{ width: WIDTH[paper], height: h, transform: `scale(${scale})`, transformOrigin: "top left", border: 0, background: "#fff" }} />}
    </div>
  );
}

const DOCS: { value: Doc; label: string }[] = [{ value: "invoice", label: "Invoice" }, { value: "slip", label: "Packing slip" }, { value: "label", label: "Label" }];

export function InvoiceForm({ initial }: { initial: InvoiceValues }) {
  const [state, action, pending] = useActionState<InvoiceState, FormData>(saveInvoiceAction, {});
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [doc, setDoc] = useState<Doc>("invoice");
  useEffect(() => { if (state.ok) setSaved(v); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = (Object.keys(initial) as (keyof InvoiceValues)[]).some((k) => v[k] !== saved[k]);
  const set = <K extends keyof InvoiceValues>(k: K, val: InvoiceValues[K]) => setV((x) => ({ ...x, [k]: val }));

  return (
    <form action={action} className="inv-grid" data-testid="invoice-form">
      <input type="hidden" name="paper" value={v.paper} />
      <div className="stack">
        <section className="card">
          <h2>What is printed</h2>
          <label className="check"><input type="checkbox" name="showLogo" checked={v.showLogo} onChange={(e) => set("showLogo", e.target.checked)} data-testid="inv-logo" /><span>Show my logo instead of my store name</span></label>
          {v.showLogo && !initial.hasLogo && <p className="muted text-sm ms-4 mb-2">You have not uploaded a logo yet, so the store name is printed. <Link href="/settings/store" className="link" prefetch={false}>Add a logo</Link></p>}
          <label className="check"><input type="checkbox" name="showSku" checked={v.showSku} onChange={(e) => set("showSku", e.target.checked)} data-testid="inv-sku" /><span>Show SKU codes on the invoice</span></label>
          <label className="check"><input type="checkbox" name="showPricesOnSlip" checked={v.showPricesOnSlip} onChange={(e) => set("showPricesOnSlip", e.target.checked)} data-testid="inv-prices" /><span>Show prices on the packing slip</span></label>
        </section>
        <section className="card">
          <h2>Footer and paper</h2>
          <label className="field"><span className="label">Note at the bottom of the invoice <span className="opt">(optional)</span></span>
            <input className="input" name="footer" value={v.footer} maxLength={200} onChange={(e) => set("footer", e.target.value)} placeholder="Exchange within 7 days of delivery" data-testid="inv-footer" /></label>
          <div className="field mb-0">
            <span className="label">Paper you usually print on</span>
            <Segmented<Paper> label="Paper size" value={v.paper} onChange={(p) => set("paper", p)} options={[{ value: "a4", label: "A4" }, { value: "a5", label: "A5" }, { value: "thermal", label: "Thermal 80mm" }]} />
            <span className="hint">You can still change the size each time you print.</span>
          </div>
        </section>
        {state.error && <div className="notice bad" role="alert" data-testid="inv-error">{state.error}</div>}
        {state.ok && !dirty && <div className="notice good" role="status" data-testid="inv-saved">Saved.</div>}
        <SaveBar dirty={dirty} pending={pending} onDiscard={() => setV(saved)} saveLabel="Save invoice settings" />
      </div>

      <div className="inv-side">
        <div className="row-between gap-2 mb-2">
          <Segmented<Doc> label="Document to preview" value={doc} onChange={setDoc} options={DOCS} />
        </div>
        <Preview doc={doc} paper={v.paper} showLogo={v.showLogo} showSku={v.showSku} prices={v.showPricesOnSlip} footer={v.footer} />
        <p className="muted text-xs mt-2">A sample order, so you can see the layout before you have orders.</p>
      </div>
    </form>
  );
}
