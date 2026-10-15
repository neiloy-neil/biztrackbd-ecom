"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CameraIcon, PlusIcon } from "@/components/icons";
import { taka } from "@/lib/format";
import { createQuickCategoryAction, generateProductDescriptionAction, generateBarcodeAction, saveProductAction } from "./actions";

export interface VariantRow {
  id?: string;
  title: string;
  sku: string;
  barcode?: string;
  price: number;
  stockQuantity: number;
  /** Stock as loaded, so saving applies only the difference. */
  stockBefore?: number;
  reorderLevel: number;
  isActive?: boolean;
  options: Record<string, string>;
}
export interface OptionDef { name: string; values: string[] }
export interface CategoryOption {
  id: string;
  name: string;
  parentId?: string | null;
}
export interface EditorProduct {
  id?: string;
  title: string;
  titleBn: string;
  descriptionHtml: string;
  basePrice: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  status: "DRAFT" | "ACTIVE";
  categoryId: string | null;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  isFeatured: boolean;
  images: { url: string; alt: string | null }[];
  variants: VariantRow[];
  options: OptionDef[];
  slug: string;
}

const MAX_PHOTOS = 10;

/** Every combination of the option values, in order. [Size: M,L] x [Color: Red,Blue] -> M/Red, M/Blue, L/Red, L/Blue. */
export function combos(options: OptionDef[]): Record<string, string>[] {
  const used = options.filter((o) => o.name.trim() && o.values.length);
  return used.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((a) => o.values.map((v) => ({ ...a, [o.name.trim()]: v }))), [{}]);
}

/** Rebuilds the variant list after the options change, keeping the id, SKU, price and stock of rows that still exist. */
export function buildVariants(options: OptionDef[], current: VariantRow[], basePrice: number): VariantRow[] {
  const list = combos(options);
  if (list.length === 1 && Object.keys(list[0]!).length === 0) {
    return current.length
      ? [current.find((v) => v.title.toLowerCase() === "default") ?? { ...current[0]!, title: "Default", isActive: current[0]?.isActive ?? true, options: {} }]
      : [{ title: "Default", sku: "", price: basePrice, stockQuantity: 0, reorderLevel: 5, isActive: true, options: {} }];
  }
  return list.map((combo) => {
    const title = Object.values(combo).join(" / ");
    const old = current.find((v) => v.title.toLowerCase() === title.toLowerCase());
    return old ? { ...old, options: combo } : { title, sku: "", price: basePrice, stockQuantity: 0, reorderLevel: 5, isActive: true, options: combo };
  });
}

function wrap(el: HTMLTextAreaElement, before: string, after: string): string {
  const { selectionStart: a, selectionEnd: b, value } = el;
  return `${value.slice(0, a)}${before}${value.slice(a, b) || "text"}${after}${value.slice(b)}`;
}

export function ProductEditor({ initial, categories, canPublish }: { initial: EditorProduct; categories: CategoryOption[]; canPublish: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [options, setOptions] = useState<OptionDef[]>(initial.options);
  const [catList, setCatList] = useState<CategoryOption[]>(categories);
  const [showCatModal, setShowCatModal] = useState(false);
  const [quickCatName, setQuickCatName] = useState("");
  const [quickCatParent, setQuickCatParent] = useState("");
  const [catBusy, setCatBusy] = useState(false);
  const [catError, setCatError] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [valueDraft, setValueDraft] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");
  const [field, setField] = useState("");
  const [limit, setLimit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPromptHint, setAiPromptHint] = useState("");
  const [aiTone, setAiTone] = useState<"DHAKA_YOUTH_TRENDY" | "TRADITIONAL_ELEGANT" | "LUXURY_PREMIUM" | "TECH_MINIMALIST">("DHAKA_YOUTH_TRENDY");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiNotice, setAiNotice] = useState("");
  const desc = useRef<HTMLTextAreaElement>(null);
  const isNew = !initial.id;

  const set = <K extends keyof EditorProduct>(k: K, v: EditorProduct[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const profit = p.costPrice != null && p.basePrice > 0 ? p.basePrice - p.costPrice : null;
  const margin = profit != null && p.basePrice > 0 ? Math.round((profit / p.basePrice) * 100) : null;
  const off = p.compareAtPrice && p.compareAtPrice > p.basePrice ? Math.round(((p.compareAtPrice - p.basePrice) / p.compareAtPrice) * 100) : null;
  const hasOptions = p.variants.length > 1 || (p.variants[0] && p.variants[0].title.toLowerCase() !== "default");

  function applyOptions(next: OptionDef[]) {
    setOptions(next);
    setP((cur) => ({ ...cur, variants: buildVariants(next, cur.variants, cur.basePrice) }));
  }
  const setVariant = (i: number, patch: Partial<VariantRow>) => setP((cur) => ({ ...cur, variants: cur.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError("");
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - p.images.length)) {
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.set("file", file);
        const res = await fetch("/api/media", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !json.url) throw new Error(json.error ?? "Could not upload that photo.");
        setP((cur) => ({ ...cur, images: [...cur.images, { url: json.url!, alt: null }].slice(0, MAX_PHOTOS) }));
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Could not upload that photo.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function save(status: "DRAFT" | "ACTIVE") {
    if (busy) return;
    setBusy(true); setError(""); setField(""); setLimit(false);
    const r = await saveProductAction({
      title: p.title, titleBn: p.titleBn || null, slug: isNew ? undefined : p.slug, descriptionHtml: p.descriptionHtml, basePrice: p.basePrice || 0,
      compareAtPrice: p.compareAtPrice || null, costPrice: p.costPrice ?? null, status, categoryId: p.categoryId,
      tags: p.tags, seoTitle: p.seoTitle || null, seoDescription: p.seoDescription || null, isFeatured: p.isFeatured, images: p.images,
      variants: p.variants.map((v) => ({ id: v.id, title: v.title, sku: v.sku || null, price: v.price || 0, stockQuantity: v.stockQuantity, stockBefore: v.stockBefore, reorderLevel: v.reorderLevel, isActive: v.isActive !== false, options: v.options })),
    }, initial.id);
    setBusy(false);
    if (!r.ok) { setError(r.error); setField(r.field ?? ""); setLimit(Boolean(r.limit)); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    router.push(`/products/${r.id}?saved=1`);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); void save(p.status); }} className="has-sticky" data-testid="product-editor" noValidate>
        {error && (
          <div className="notice bad" role="alert" style={{ marginBottom: 14 }} data-testid="editor-error">
            {error} {limit && <Link href="/billing" className="link">See your plan</Link>}
          </div>
        )}
        <div className="split">
          <div className="col stack">
            <section className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--line, #E2E8F0)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14 }}>
                    One-Click Product Generator
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>Generate titles, rich HTML descriptions &amp; SEO metadata automatically</div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setAiPromptHint(p.title || "");
                    setAiError("");
                    setShowAiModal(true);
                  }}
                  style={{ borderColor: "#818CF8", color: "#4F46E5", background: "#EEF2FF", fontWeight: 700 }}
                >
                  Auto-Fill Listing
                </button>
              </div>
              {aiNotice && <div className="notice good" style={{ marginBottom: 12 }}>{aiNotice}</div>}
              <label className="field"><span className="label">Product name</span>
                <input className="input" value={p.title} onChange={(e) => set("title", e.target.value)} aria-invalid={field === "title"} data-testid="p-title" placeholder="Cotton Panjabi, Off-white" /></label>
              <label className="field"><span className="label">Name in Bangla <span className="opt">(optional)</span></span>
                <input className="input" lang="bn" value={p.titleBn} onChange={(e) => set("titleBn", e.target.value)} /></label>
              <div className="field" style={{ marginBottom: 0 }}>
                <span className="label">Description</span>
                <div className="row" style={{ marginBottom: 6 }}>
                  <button type="button" className="btn btn-secondary btn-sm" aria-label="Bold" onClick={() => desc.current && set("descriptionHtml", wrap(desc.current, "<strong>", "</strong>"))}><b>B</b></button>
                  <button type="button" className="btn btn-secondary btn-sm" aria-label="Italic" onClick={() => desc.current && set("descriptionHtml", wrap(desc.current, "<em>", "</em>"))}><i>I</i></button>
                  <button type="button" className="btn btn-secondary btn-sm" aria-label="Bullet list" onClick={() => desc.current && set("descriptionHtml", wrap(desc.current, "<ul><li>", "</li></ul>"))}>• List</button>
                </div>
                <textarea ref={desc} className="textarea" style={{ minHeight: 140 }} value={p.descriptionHtml} onChange={(e) => set("descriptionHtml", e.target.value)} data-testid="p-description" aria-label="Description" />
                <div className="hint">Plain text works. Basic formatting is kept; anything unsafe is removed.</div>
              </div>
            </section>

            <section className="card">
              <div className="card-head"><h2>Photos</h2><span className="muted" style={{ fontSize: 13 }}>{p.images.length} of {MAX_PHOTOS}</span></div>
              <p className="muted" style={{ marginTop: -6, marginBottom: 10, fontSize: 13.5 }}>The first photo is the cover.</p>
              <div className="photo-grid" data-testid="photos">
                {p.images.map((img, i) => (
                  <div key={img.url} className="photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.alt ?? ""} />
                    {i === 0 ? <span className="cover">Cover</span> : <button type="button" className="cover" style={{ border: 0, cursor: "pointer" }} onClick={() => set("images", [img, ...p.images.filter((_, j) => j !== i)])}>Make cover</button>}
                    <button type="button" className="x" aria-label="Remove photo" onClick={() => set("images", p.images.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                {p.images.length < MAX_PHOTOS && (
                  <>
                    <label className="photo-add"><CameraIcon /> Take photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} /></label>
                    <label className="photo-add"><PlusIcon /> Add photos<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden data-testid="photo-input" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} /></label>
                  </>
                )}
              </div>
              {uploading > 0 && <p className="muted" role="status" style={{ marginTop: 8 }}>Uploading…</p>}
              {uploadError && <div className="err" role="alert">{uploadError}</div>}
            </section>

            <section className="card">
              <h2>Pricing</h2>
              <div className="row-3">
                <label className="field"><span className="label">Price (৳)</span><input className="input" inputMode="decimal" value={p.basePrice || ""} onChange={(e) => { const v = Number(e.target.value.replace(/[^\d.]/g, "")) || 0; setP((cur) => ({ ...cur, basePrice: v, variants: cur.variants.map((x) => (hasOptions || x.price !== cur.basePrice ? x : { ...x, price: v })) })); }} data-testid="p-price" aria-invalid={field === "basePrice"} /></label>
                <label className="field"><span className="label">Compare-at <span className="opt">(optional)</span></span><input className="input" inputMode="decimal" value={p.compareAtPrice ?? ""} onChange={(e) => set("compareAtPrice", Number(e.target.value.replace(/[^\d.]/g, "")) || null)} /></label>
                <label className="field"><span className="label">Cost <span className="opt">(optional)</span></span><input className="input" inputMode="decimal" value={p.costPrice ?? ""} onChange={(e) => set("costPrice", e.target.value === "" ? null : Number(e.target.value.replace(/[^\d.]/g, "")) || 0)} /></label>
              </div>
              {(profit != null || off != null) && <p className="muted" style={{ fontSize: 13.5 }}>{profit != null ? `Profit ${taka(profit)} · Margin ${margin}%` : ""}{profit != null && off != null ? ". " : ""}{off != null ? `Customers see ${off}% off.` : ""}</p>}
            </section>

            <section className="card">
              <div className="card-head"><h2>Variants</h2></div>
              {!hasOptions && options.length === 0 ? (
                <>
                  <div className="row-2">
                    <label className="field"><span className="label">Stock</span>
                      <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                        <button type="button" className="btn btn-secondary" aria-label="One less" onClick={() => setVariant(0, { stockQuantity: Math.max(0, (p.variants[0]?.stockQuantity ?? 0) - 1) })}>−</button>
                        <input className="input" style={{ textAlign: "center" }} inputMode="numeric" value={p.variants[0]?.stockQuantity ?? 0} onChange={(e) => setVariant(0, { stockQuantity: Math.max(0, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0) })} data-testid="p-stock" aria-label="Stock" />
                        <button type="button" className="btn btn-secondary" aria-label="One more" onClick={() => setVariant(0, { stockQuantity: (p.variants[0]?.stockQuantity ?? 0) + 1 })}>+</button>
                      </div>
                    </label>
                    <div className="row2">
                      <label className="field"><span className="label">SKU <span className="opt">(optional)</span></span><input className="input" value={p.variants[0]?.sku ?? ""} onChange={(e) => setVariant(0, { sku: e.target.value })} placeholder="e.g. SHIRT-01" /></label>
                      <label className="field">
                        <span className="label">Barcode <span className="opt">(optional)</span></span>
                        <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                          <input
                            className="input"
                            value={p.variants[0]?.barcode ?? ""}
                            onChange={(e) => setVariant(0, { barcode: e.target.value })}
                            placeholder="e.g. 880123456789"
                            data-testid="p-barcode"
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            title="Auto-generate standard barcode"
                            onClick={async () => {
                              const res = await generateBarcodeAction();
                              if (res.ok) setVariant(0, { barcode: res.barcode });
                            }}
                          >
                            Auto
                          </button>
                        </div>
                      </label>
                    </div>
                  </div>
                  <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Does it come in sizes, colors, or materials? Add options and set stock for each.</p>
                  <button type="button" className="btn btn-secondary" onClick={() => applyOptions([{ name: "Size", values: [] }])} data-testid="add-options">Add options</button>
                </>
              ) : (
                <>
                  {options.map((o, oi) => (
                    <div key={oi} className="field">
                      <div className="row" style={{ marginBottom: 6 }}>
                        <input className="input" style={{ maxWidth: 160 }} value={o.name} aria-label="Option name" onChange={(e) => applyOptions(options.map((x, j) => (j === oi ? { ...x, name: e.target.value } : x)))} data-testid={`opt-name-${oi}`} />
                        <button type="button" className="link" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => applyOptions(options.filter((_, j) => j !== oi))}>Remove</button>
                      </div>
                      <div className="chips">
                        {o.values.map((v) => (
                          <span key={v} className="chip" style={{ cursor: "default" }}>{v}<button type="button" aria-label={`Remove ${v}`} style={{ border: 0, background: "none", cursor: "pointer", padding: 0, fontSize: 16 }} onClick={() => applyOptions(options.map((x, j) => (j === oi ? { ...x, values: x.values.filter((y) => y !== v) } : x)))}>×</button></span>
                        ))}
                        <input className="input input-sm" style={{ width: 130 }} placeholder="Add a value" aria-label={`Add a value to ${o.name}`} value={valueDraft[oi] ?? ""} data-testid={`opt-value-${oi}`}
                          onChange={(e) => setValueDraft((d) => { const n = [...d]; n[oi] = e.target.value; return n; })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              const v = (valueDraft[oi] ?? "").trim();
                              if (v && !o.values.some((x) => x.toLowerCase() === v.toLowerCase())) applyOptions(options.map((x, j) => (j === oi ? { ...x, values: [...x.values, v] } : x)));
                              setValueDraft((d) => { const n = [...d]; n[oi] = ""; return n; });
                            }
                          }} />
                      </div>
                    </div>
                  ))}
                  {options.length < 3 && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyOptions([...options, { name: options.length === 0 ? "Size" : options.length === 1 ? "Color" : "Material", values: [] }])}>
                      + Add {options.length === 0 ? "an option" : "another option"}
                    </button>
                  )}

                  {p.variants.length > 0 && (
                    <div className="row" style={{ alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--card-subtle, #f5f6f8)", borderRadius: 6, margin: "14px 0 10px 0", flexWrap: "wrap" }}>
                      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Bulk edit:</span>
                      <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                        <input className="input input-sm" style={{ width: 85 }} inputMode="decimal" placeholder="Price ৳" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value.replace(/[^\d.]/g, ""))} />
                        <button type="button" className="btn btn-secondary btn-sm" disabled={!bulkPrice} onClick={() => { const pr = Number(bulkPrice); if (!pr) return; setP((cur) => ({ ...cur, variants: cur.variants.map((v) => ({ ...v, price: pr })) })); setBulkPrice(""); }}>Apply price</button>
                      </div>
                      <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                        <input className="input input-sm" style={{ width: 75 }} inputMode="numeric" placeholder="Stock" value={bulkStock} onChange={(e) => setBulkStock(e.target.value.replace(/\D/g, ""))} />
                        <button type="button" className="btn btn-secondary btn-sm" disabled={bulkStock === ""} onClick={() => { const st = parseInt(bulkStock, 10); if (isNaN(st)) return; setP((cur) => ({ ...cur, variants: cur.variants.map((v) => ({ ...v, stockQuantity: Math.max(0, st) })) })); setBulkStock(""); }}>Apply stock</button>
                      </div>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }} onClick={() => {
                        const baseSlug = (p.slug || p.title || "ITEM").trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase();
                        setP((cur) => ({
                          ...cur,
                          variants: cur.variants.map((v) => {
                            const parts = Object.values(v.options).map((val) => val.trim().replace(/[^A-Za-z0-9]+/g, "").toUpperCase()).filter(Boolean);
                            return { ...v, sku: parts.length ? `${baseSlug}-${parts.join("-")}` : baseSlug };
                          }),
                        }));
                      }}>Auto-generate SKUs</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={async () => {
                        const updated = await Promise.all(
                          p.variants.map(async (v) => {
                            if (v.barcode) return v;
                            const res = await generateBarcodeAction();
                            return res.ok ? { ...v, barcode: res.barcode } : v;
                          })
                        );
                        setP((cur) => ({ ...cur, variants: updated }));
                      }}>Auto-generate Barcodes</button>
                    </div>
                  )}

                  <div style={{ overflowX: "auto", marginTop: 8 }}>
                    <table className="table" data-testid="variant-table">
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>Status</th>
                          <th>Variant</th>
                          <th>Price</th>
                          <th>SKU</th>
                          <th>Barcode</th>
                          <th>In stock</th>
                          <th style={{ width: 36 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.variants.map((v, i) => (
                          <tr key={v.id ?? `${v.title}-${i}`}>
                            <td>
                              <button
                                type="button"
                                className={`pill ${v.isActive !== false ? "ok" : "grey"}`}
                                style={{ cursor: "pointer", border: "none", fontSize: 12, padding: "3px 8px" }}
                                onClick={() => setVariant(i, { isActive: v.isActive === false })}
                                title={v.isActive !== false ? "Click to disable" : "Click to activate"}
                                data-testid={`toggle-status-${i}`}
                              >
                                {v.isActive !== false ? "Active" : "Disabled"}
                              </button>
                            </td>
                            <td style={{ whiteSpace: "nowrap", opacity: v.isActive === false ? 0.5 : 1 }}>
                              <b>{v.title}</b>
                            </td>
                            <td><input className="input input-sm" style={{ width: 90 }} inputMode="decimal" aria-label={`Price for ${v.title}`} value={v.price || ""} onChange={(e) => setVariant(i, { price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></td>
                            <td><input className="input input-sm" style={{ width: 130 }} aria-label={`SKU for ${v.title}`} value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} /></td>
                            <td>
                              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                                <input
                                  className="input input-sm"
                                  style={{ width: 115 }}
                                  placeholder="Barcode"
                                  aria-label={`Barcode for ${v.title}`}
                                  value={v.barcode || ""}
                                  onChange={(e) => setVariant(i, { barcode: e.target.value })}
                                />
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "2px 5px", fontSize: 11 }}
                                  title="Auto-generate barcode"
                                  onClick={async () => {
                                    const res = await generateBarcodeAction();
                                    if (res.ok) setVariant(i, { barcode: res.barcode });
                                  }}
                                >
                                  Auto
                                </button>
                              </div>
                            </td>
                            <td><input className="input input-sm" style={{ width: 70 }} inputMode="numeric" aria-label={`Stock for ${v.title}`} value={v.stockQuantity} onChange={(e) => setVariant(i, { stockQuantity: Math.max(0, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0) })} data-testid={`stock-${v.title}`} /></td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "2px 8px", color: "var(--danger, #d32f2f)", border: "none" }}
                                aria-label={`Remove ${v.title}`}
                                onClick={() => {
                                  if (p.variants.length <= 1) {
                                    setError("A product must have at least one variant.");
                                    return;
                                  }
                                  setP((cur) => ({ ...cur, variants: cur.variants.filter((_, j) => j !== i) }));
                                }}
                                data-testid={`delete-variant-${i}`}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {options.length > 0 && p.variants.length === 0 && <p className="muted">Add values to create variants.</p>}
                </>
              )}
            </section>
          </div>

          <div className="col stack">
            <section className="card">
              <h2>Visibility</h2>
              <label className="check"><input type="checkbox" checked={p.status === "ACTIVE"} disabled={!canPublish} onChange={(e) => set("status", e.target.checked ? "ACTIVE" : "DRAFT")} data-testid="p-active" /><span><b>Show on my online store</b><br /><span className="muted" style={{ fontSize: 13 }}>Turn off to keep this product as a draft. Customers will not see it.</span></span></label>
            </section>

            <section className="card">
              <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>Organise</h2>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCatModal(true)}
                  data-testid="p-newcat-btn"
                >
                  + New category
                </button>
              </div>
              <label className="field"><span className="label">Category</span>
                <select className="select" value={p.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)} data-testid="p-category">
                  <option value="">No category</option>
                  {catList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parentId ? `\u00A0\u00A0↳ ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field"><span className="label">Tags <span className="opt">(separate with commas)</span></span>
                <input className="input" value={p.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20))} placeholder="cotton, handloom" /></label>
              <label className="check"><input type="checkbox" checked={p.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} /><span>Feature on the home page</span></label>
            </section>

            <section className="card">
              <h2>Google preview</h2>
              <div style={{ background: "#fff", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 13, color: "#4D5156", wordBreak: "break-all" }}>/products/{p.slug || "your-product"}</div>
                <div style={{ color: "#1a0dab", fontSize: 17, margin: "2px 0" }}>{p.seoTitle || p.title || "Product name"}</div>
                <div style={{ fontSize: 13.5, color: "#4D5156" }}>{(p.seoDescription || p.descriptionHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 160) || "Your description appears here."}</div>
              </div>
              <details style={{ marginTop: 10 }}>
                <summary className="link" style={{ cursor: "pointer" }}>Edit search listing</summary>
                <label className="field" style={{ marginTop: 10 }}><span className="label">Page title</span><input className="input" value={p.seoTitle} maxLength={70} onChange={(e) => set("seoTitle", e.target.value)} /></label>
                <label className="field"><span className="label">Description</span><textarea className="textarea" style={{ minHeight: 70 }} value={p.seoDescription} maxLength={160} onChange={(e) => set("seoDescription", e.target.value)} /></label>
                {!isNew && <label className="field"><span className="label">URL name</span><input className="input" value={p.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} aria-invalid={field === "slug"} /></label>}
              </details>
            </section>
          </div>
        </div>

        <div className="sticky-actions">
          <button type="button" className="btn btn-secondary btn-lg" disabled={busy || uploading > 0} onClick={() => void save("DRAFT")} data-testid="save-draft">Save draft</button>
          {canPublish && <button type="button" className="btn btn-primary btn-lg" disabled={busy || uploading > 0} onClick={() => void save("ACTIVE")} data-testid="publish">{busy ? "Saving…" : isNew ? "Publish product" : "Save and publish"}</button>}
        </div>
      </form>

      {showCatModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add new category"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCatModal(false); }}
        >
          <div
            className="card stack"
            style={{ maxWidth: 440, width: "100%", background: "var(--card-bg, #fff)", borderRadius: 10, padding: 20, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Add new category</h3>
              <button type="button" style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: "0 4px" }} onClick={() => setShowCatModal(false)}>×</button>
            </div>
            {catError && <div className="notice bad" role="alert" style={{ margin: "10px 0" }}>{catError}</div>}
            <label className="field" style={{ marginTop: 12 }}>
              <span className="label">Category name</span>
              <input
                className="input"
                value={quickCatName}
                onChange={(e) => setQuickCatName(e.target.value)}
                placeholder="e.g. Panjabi or Polo Shirts"
                autoFocus
              />
            </label>
            <label className="field">
              <span className="label">Parent category <span className="opt">(optional)</span></span>
              <select
                className="select"
                value={quickCatParent}
                onChange={(e) => setQuickCatParent(e.target.value)}
              >
                <option value="">None: Top-level category</option>
                {catList.filter((c) => !c.parentId).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCatModal(false)} disabled={catBusy}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={catBusy || !quickCatName.trim()}
                onClick={async () => {
                  setCatBusy(true);
                  setCatError("");
                  const res = await createQuickCategoryAction(quickCatName, quickCatParent || null);
                  setCatBusy(false);
                  if (!res.ok) {
                    setCatError(res.error);
                    return;
                  }
                  setCatList((prev) => {
                    const item = res.category;
                    if (item.parentId) {
                      const pIdx = prev.findIndex((c) => c.id === item.parentId);
                      if (pIdx !== -1) {
                        const next = [...prev];
                        next.splice(pIdx + 1, 0, item);
                        return next;
                      }
                    }
                    return [...prev, item];
                  });
                  set("categoryId", res.category.id);
                  setQuickCatName("");
                  setQuickCatParent("");
                  setShowCatModal(false);
                }}
              >
                {catBusy ? "Creating…" : "Create category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAiModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="One-Click Product Generator"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAiModal(false); }}
        >
          <div
            className="card stack"
            style={{ maxWidth: 500, width: "100%", background: "var(--card-bg, #fff)", borderRadius: 12, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>One-Click Product Generator</h3>
              <button type="button" style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: "0 4px" }} onClick={() => setShowAiModal(false)}>×</button>
            </div>

            <p className="muted" style={{ fontSize: 13, margin: "6px 0 12px" }}>
              Enter a product concept or keywords to auto-generate bilingual titles, semantic HTML description, SEO tags and social copy.
            </p>

            {aiError && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{aiError}</div>}

            <label className="field">
              <span className="label">Product Title / Keywords / Notes</span>
              <input
                className="input"
                value={aiPromptHint}
                onChange={(e) => setAiPromptHint(e.target.value)}
                placeholder="e.g. Navy Blue Jamdani Saree, 100% Pure Cotton"
                autoFocus
              />
              <span className="help">Give a brief hint or paste rough supplier notes.</span>
            </label>

            <label className="field">
              <span className="label">Cultural Tone Preset</span>
              <select
                className="select"
                value={aiTone}
                onChange={(e) => setAiTone(e.target.value as any)}
              >
                <option value="DHAKA_YOUTH_TRENDY">ট্রেন্ডি ও আধুনিক (Dhaka Youth &amp; Trendy)</option>
                <option value="TRADITIONAL_ELEGANT">মার্জিত ও ঐতিহ্যবাহী (Traditional &amp; Elegant)</option>
                <option value="LUXURY_PREMIUM">প্রিমিয়াম ও লাক্সারি (Luxury &amp; Premium)</option>
                <option value="TECH_MINIMALIST">প্রযুক্তি ও স্পেক্স-ফোকাসড (Tech &amp; Minimalist)</option>
              </select>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAiModal(false)} disabled={aiBusy}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={aiBusy || !aiPromptHint.trim()}
                onClick={async () => {
                  setAiBusy(true);
                  setAiError("");
                  const res = await generateProductDescriptionAction({
                    titleHint: aiPromptHint.trim(),
                    price: p.basePrice || undefined,
                    tone: aiTone,
                  });
                  setAiBusy(false);
                  if (!res.ok) {
                    setAiError(res.error);
                    return;
                  }
                  const d = res.data;
                  setP((cur) => ({
                    ...cur,
                    title: d.titleEn || cur.title || d.titleBn,
                    titleBn: d.titleBn || cur.titleBn,
                    descriptionHtml: d.descriptionHtml || cur.descriptionHtml,
                    seoTitle: d.seo.metaTitle || cur.seoTitle,
                    seoDescription: d.seo.metaDescription || cur.seoDescription,
                    tags: Array.from(new Set([...cur.tags, ...(d.tags || [])])),
                  }));
                  setAiNotice("Product listing generated successfully! Form fields have been populated.");
                  setShowAiModal(false);
                  setTimeout(() => setAiNotice(""), 6000);
                }}
              >
                {aiBusy ? "Generating Listing…" : "Generate & Fill Listing"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
