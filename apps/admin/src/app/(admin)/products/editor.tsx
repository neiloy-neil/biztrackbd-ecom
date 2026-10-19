"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CameraIcon, PlusIcon } from "@/components/icons";
import { taka } from "@/lib/format";
import { createQuickCategoryAction, generateProductDescriptionAction, generateImageAltTagsAction, generateBarcodeAction, saveProductAction } from "./actions";
import type { GeneratedProductListing, AiTonePreset } from "@biztrackbd/core";

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
  const [aiCustomBrandVoice, setAiCustomBrandVoice] = useState("");
  const [aiTone, setAiTone] = useState<AiTonePreset>("DHAKA_YOUTH_TRENDY");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiNotice, setAiNotice] = useState("");
  const [aiGeneratedData, setAiGeneratedData] = useState<GeneratedProductListing | null>(null);
  const [aiPreviewTab, setAiPreviewTab] = useState<"listing" | "seo" | "social" | "alts">("listing");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [altBusy, setAltBusy] = useState(false);
  const [altNotice, setAltNotice] = useState("");
  const [editingAltIndex, setEditingAltIndex] = useState<number | null>(null);
  const [editingAltText, setEditingAltText] = useState("");
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
              <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ display: "inline-block", margin: 0, marginRight: 8 }}>Photos</h2>
                  <span className="muted" style={{ fontSize: 13 }}>{p.images.length} of {MAX_PHOTOS}</span>
                </div>
                {p.images.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={altBusy}
                    onClick={async () => {
                      setAltBusy(true);
                      setAltNotice("");
                      try {
                        const res = await generateImageAltTagsAction({
                          productTitle: p.title || p.titleBn || "Product photo",
                          imageCount: p.images.length,
                          imageUrls: p.images.map((img) => img.url),
                          tone: aiTone,
                        });
                        if (res.ok && res.data.length > 0) {
                          const updated = p.images.map((img, i) => {
                            const tag = res.data.find((d) => d.index === i) || res.data[i];
                            return { ...img, alt: tag ? `${tag.altEn} (${tag.altBn})` : img.alt };
                          });
                          setP((cur) => ({ ...cur, images: updated }));
                          setAltNotice(`Generated alt tags for ${res.data.length} photos!`);
                          setTimeout(() => setAltNotice(""), 5000);
                        } else if (!res.ok) {
                          setUploadError(res.error);
                        }
                      } finally {
                        setAltBusy(false);
                      }
                    }}
                    style={{ borderColor: "#818CF8", color: "#4F46E5", background: "#EEF2FF", fontWeight: 700, fontSize: 12 }}
                  >
                    {altBusy ? "Generating Alts…" : "✨ AI Alt-Tags"}
                  </button>
                )}
              </div>
              <p className="muted" style={{ marginTop: -6, marginBottom: 10, fontSize: 13.5 }}>
                The first photo is the cover. Click <b>ALT</b> on any photo to edit accessibility and Google Image tags.
              </p>
              {altNotice && <div className="notice good" style={{ marginBottom: 10, fontSize: 13 }}>{altNotice}</div>}
              <div className="photo-grid" data-testid="photos">
                {p.images.map((img, i) => (
                  <div key={img.url} className="photo" style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.alt ?? ""} />
                    {i === 0 ? <span className="cover">Cover</span> : <button type="button" className="cover" style={{ border: 0, cursor: "pointer" }} onClick={() => set("images", [img, ...p.images.filter((_, j) => j !== i)])}>Make cover</button>}
                    <button
                      type="button"
                      className="alt-badge"
                      title={img.alt ? `Alt: ${img.alt} (Click to edit)` : "No alt text set. Click to add."}
                      onClick={() => {
                        setEditingAltIndex(i);
                        setEditingAltText(img.alt || "");
                      }}
                      style={{
                        position: "absolute",
                        bottom: 6,
                        left: 6,
                        background: img.alt ? "rgba(15, 23, 42, 0.85)" : "rgba(239, 68, 68, 0.85)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        backdropFilter: "blur(4px)",
                        zIndex: 2,
                      }}
                    >
                      {img.alt ? "✓ ALT" : "+ ALT"}
                    </button>
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

      {/* Image Alt Text Edit Dialog */}
      {editingAltIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={() => setEditingAltIndex(null)}
        >
          <div className="card stack" style={{ maxWidth: 460, width: "100%", background: "#fff", borderRadius: 12, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Image Alt Text (SEO &amp; Accessibility)</h3>
              <button type="button" style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: "0 4px" }} onClick={() => setEditingAltIndex(null)}>×</button>
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 10px" }}>
              Descriptive text for visually impaired shoppers and Google Image indexing.
            </p>
            {editingAltIndex !== null && p.images[editingAltIndex] && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, padding: 8, background: "#F8FAFC", borderRadius: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.images[editingAltIndex]!.url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />
                <span className="muted" style={{ fontSize: 12 }}>Photo {editingAltIndex + 1} of {p.images.length}</span>
              </div>
            )}
            <label className="field" style={{ marginBottom: 12 }}>
              <span className="label">Alt Text</span>
              <input
                className="input"
                value={editingAltText}
                onChange={(e) => setEditingAltText(e.target.value)}
                placeholder="e.g. Front view of Navy Blue Jamdani Pure Cotton Saree"
                autoFocus
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingAltIndex(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (editingAltIndex !== null) {
                    const updated = [...p.images];
                    if (updated[editingAltIndex]) {
                      updated[editingAltIndex] = { ...updated[editingAltIndex]!, alt: editingAltText.trim() || null };
                      set("images", updated);
                    }
                  }
                  setEditingAltIndex(null);
                }}
              >
                Save Alt Text
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgraded AI Catalog Studio & Copilot Modal */}
      {showAiModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI Catalog Studio & Copilot"
          style={{
            position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !aiBusy) setShowAiModal(false); }}
        >
          <div
            className="card stack"
            style={{
              maxWidth: aiGeneratedData ? 820 : 540,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "var(--card-bg, #fff)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              border: "1px solid #E2E8F0",
              transition: "max-width 0.2s ease",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #E2E8F0", paddingBottom: 14, marginBottom: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>✨</span>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>AI Catalog Studio &amp; Copilot</h3>
                </div>
                <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
                  Generate bilingual copy, Google SERP snippets, image alt-tags, and social campaigns in seconds.
                </p>
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: "0 4px", color: "#64748B" }}
                onClick={() => setShowAiModal(false)}
                disabled={aiBusy}
              >
                ×
              </button>
            </div>

            {aiError && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{aiError}</div>}

            {/* SCREEN 1: Prompt & Controls (when no generated data yet) */}
            {!aiGeneratedData ? (
              <div className="stack" style={{ gap: 14 }}>
                <label className="field">
                  <span className="label">Product Title / Concept / Notes</span>
                  <input
                    className="input"
                    value={aiPromptHint}
                    onChange={(e) => setAiPromptHint(e.target.value)}
                    placeholder="e.g. Navy Blue Jamdani Saree, 100% Pure Cotton"
                    autoFocus
                  />
                  <span className="help">Give a brief hint, product name, or paste rough supplier notes.</span>
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
                    <option value="FLASH_SALE_URGENT">হট ডিল ও ফ্ল্যাশ সেল (Flash Sale &amp; Urgent FOMO)</option>
                  </select>
                </label>

                <label className="field">
                  <span className="label">Store Policies &amp; Brand Voice <span className="opt">(optional)</span></span>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 65, fontSize: 13 }}
                    value={aiCustomBrandVoice}
                    onChange={(e) => setAiCustomBrandVoice(e.target.value)}
                    placeholder="e.g. Cash on Delivery all over Bangladesh, 7-day hassle-free replacement, Delivery inside Dhaka in 24 hours."
                  />
                  <span className="help">Custom instructions to bake directly into descriptions, COD notes, and ad copy.</span>
                </label>

                {p.images.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, fontSize: 12.5, color: "#3730A3" }}>
                    <span>📸</span>
                    <span><strong>{p.images.length} gallery photo(s) detected.</strong> Gemini will inspect images to detect attributes and generate SEO alt-tags.</span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
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
                        customBrandVoice: aiCustomBrandVoice.trim() || undefined,
                        imageCount: p.images.length,
                        imageUrls: p.images.map((img) => img.url),
                      });
                      setAiBusy(false);
                      if (!res.ok) {
                        setAiError(res.error);
                        return;
                      }
                      setAiGeneratedData(res.data);
                      setAiPreviewTab("listing");
                    }}
                  >
                    {aiBusy ? "Analyzing & Generating Listing…" : "✨ Generate & Preview"}
                  </button>
                </div>
              </div>
            ) : (
              /* SCREEN 2: Interactive Preview & Review Tabs */
              <div className="stack" style={{ gap: 16 }}>
                {/* Tab Switcher */}
                <div style={{ display: "flex", gap: 6, background: "#F1F5F9", padding: 4, borderRadius: 10 }}>
                  {[
                    { id: "listing", label: "🏷️ Product Copy", badge: null },
                    { id: "seo", label: "🔍 Google SERP Card", badge: "Live" },
                    { id: "social", label: "📣 Social & WhatsApp", badge: "2 Channels" },
                    { id: "alts", label: `🖼️ Alt-Tags (${aiGeneratedData.imageAltTexts?.length || p.images.length})`, badge: null },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAiPreviewTab(t.id as any)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        border: "none",
                        borderRadius: 8,
                        background: aiPreviewTab === t.id ? "#fff" : "transparent",
                        fontWeight: aiPreviewTab === t.id ? 700 : 500,
                        fontSize: 13,
                        color: aiPreviewTab === t.id ? "#0F172A" : "#64748B",
                        boxShadow: aiPreviewTab === t.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      {t.label}
                      {t.badge && (
                        <span style={{ fontSize: 10, background: "#E0E7FF", color: "#3730A3", padding: "1px 5px", borderRadius: 4 }}>
                          {t.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* TAB 1: Product Copy (Titles, Excerpt, HTML Description) */}
                {aiPreviewTab === "listing" && (
                  <div className="stack" style={{ gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: 10, background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                        <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>English Title</span>
                        <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{aiGeneratedData.titleEn || "N/A"}</div>
                      </div>
                      <div style={{ padding: 10, background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                        <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Bangla Title (বাংলা)</span>
                        <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }} lang="bn">{aiGeneratedData.titleBn || "N/A"}</div>
                      </div>
                    </div>

                    {aiGeneratedData.shortExcerptBn && (
                      <div style={{ padding: "8px 12px", background: "#FEF9C3", borderRadius: 8, fontSize: 13, border: "1px solid #FEF08A" }}>
                        <strong>সারসংক্ষেপ:</strong> {aiGeneratedData.shortExcerptBn}
                      </div>
                    )}

                    <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ background: "#F8FAFC", padding: "8px 12px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>Rich HTML Description Preview</span>
                        <span className="muted" style={{ fontSize: 11 }}>Semantic HTML with lists</span>
                      </div>
                      <div
                        style={{ padding: 14, maxHeight: 180, overflowY: "auto", fontSize: 13.5, lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{ __html: aiGeneratedData.descriptionHtml || "<p>No description generated</p>" }}
                      />
                    </div>

                    {aiGeneratedData.tags?.length > 0 && (
                      <div>
                        <span className="muted" style={{ fontSize: 12, marginRight: 8 }}>Suggested Tags:</span>
                        <div className="chips" style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                          {aiGeneratedData.tags.map((tg) => (
                            <span key={tg} className="chip" style={{ fontSize: 11.5 }}>#{tg}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: Google SERP Preview Card */}
                {aiPreviewTab === "seo" && (
                  <div className="stack" style={{ gap: 14 }}>
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                      Live simulation of how this product snippet will appear in Google Search for Bangladeshi online shoppers:
                    </p>

                    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                      {/* Google URL Breadcrumb */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#4285F4", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>G</span>
                        <span style={{ fontSize: 12, color: "#202124" }}>yourstore.biztrack.bd › products › {p.slug || "item"}</span>
                      </div>
                      {/* Google Blue Title Link */}
                      <div style={{ fontSize: 18, color: "#1A0DAB", fontWeight: 500, lineHeight: 1.3, marginBottom: 4, cursor: "pointer", textDecoration: "underline" }}>
                        {aiGeneratedData.seo.metaTitle || aiGeneratedData.titleEn || p.title}
                      </div>
                      {/* Google Meta Snippet */}
                      <div style={{ fontSize: 13.5, color: "#4D5156", lineHeight: 1.5 }}>
                        {aiGeneratedData.seo.metaDescription || "Order authentic items online with fast Cash on Delivery across Bangladesh."}
                      </div>
                    </div>

                    {/* Character Count Gauges */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ padding: 10, background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>Meta Title Length</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: (aiGeneratedData.seo.metaTitle?.length || 0) <= 60 ? "#16A34A" : "#DC2626" }}>
                            {aiGeneratedData.seo.metaTitle?.length || 0} / 60 chars
                          </span>
                        </div>
                        <span className="muted" style={{ fontSize: 11.5 }}>Recommended for Google Search in BD</span>
                      </div>
                      <div style={{ padding: 10, background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>Meta Description Length</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: (aiGeneratedData.seo.metaDescription?.length || 0) <= 160 ? "#16A34A" : "#DC2626" }}>
                            {aiGeneratedData.seo.metaDescription?.length || 0} / 160 chars
                          </span>
                        </div>
                        <span className="muted" style={{ fontSize: 11.5 }}>Includes call-to-action &amp; COD note</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: Social & WhatsApp Copy */}
                {aiPreviewTab === "social" && (
                  <div className="stack" style={{ gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {/* Facebook / Instagram Card */}
                      <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 14, background: "#F8FAFC" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#1877F2" }}>Facebook &amp; Instagram Post</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(aiGeneratedData.adCopy.facebookCaption);
                              setCopiedField("fb");
                              setTimeout(() => setCopiedField(null), 2000);
                            }}
                          >
                            {copiedField === "fb" ? "Copied!" : "📋 Copy Post"}
                          </button>
                        </div>
                        <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto", background: "#fff", padding: 10, borderRadius: 6, border: "1px solid #E2E8F0" }}>
                          {aiGeneratedData.adCopy.facebookCaption || "No social copy available."}
                        </div>
                      </div>

                      {/* WhatsApp Broadcast Card */}
                      <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 14, background: "#F0FDF4" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#15803D" }}>WhatsApp Broadcast Script</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(aiGeneratedData.adCopy.whatsAppBroadcast);
                              setCopiedField("wa");
                              setTimeout(() => setCopiedField(null), 2000);
                            }}
                          >
                            {copiedField === "wa" ? "Copied!" : "📋 Copy WhatsApp"}
                          </button>
                        </div>
                        <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto", background: "#DCF8C6", padding: 10, borderRadius: 8, border: "1px solid #BBF7D0", color: "#064E3B" }}>
                          {aiGeneratedData.adCopy.whatsAppBroadcast || "No WhatsApp script available."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: Image Alt-Tags */}
                {aiPreviewTab === "alts" && (
                  <div className="stack" style={{ gap: 10 }}>
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                      Proposed accessibility and SEO alt-tags for product images:
                    </p>
                    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: 8 }}>
                      {aiGeneratedData.imageAltTexts && aiGeneratedData.imageAltTexts.length > 0 ? (
                        aiGeneratedData.imageAltTexts.map((altItem, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: idx < aiGeneratedData.imageAltTexts.length - 1 ? "1px solid #E2E8F0" : "none" }}>
                            <span style={{ fontWeight: 700, fontSize: 12, width: 65, color: "#64748B" }}>Photo {idx + 1}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{altItem.altEn}</div>
                              <div style={{ fontSize: 12, color: "#64748B" }} lang="bn">{altItem.altBn}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: 14, textAlign: "center", color: "#64748B", fontSize: 13 }}>
                          No image alt tags generated. Upload product photos to auto-generate tags.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ACTION FOOTER */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: 14, marginTop: 4, flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAiGeneratedData(null)}
                  >
                    ← Edit Prompt / Back
                  </button>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setP((cur) => ({
                          ...cur,
                          descriptionHtml: aiGeneratedData.descriptionHtml || cur.descriptionHtml,
                        }));
                        setAiNotice("Description applied to editor!");
                        setShowAiModal(false);
                        setTimeout(() => setAiNotice(""), 5000);
                      }}
                    >
                      Apply Description Only
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setP((cur) => ({
                          ...cur,
                          seoTitle: aiGeneratedData.seo.metaTitle || cur.seoTitle,
                          seoDescription: aiGeneratedData.seo.metaDescription || cur.seoDescription,
                        }));
                        setAiNotice("SEO metadata applied to editor!");
                        setShowAiModal(false);
                        setTimeout(() => setAiNotice(""), 5000);
                      }}
                    >
                      Apply SEO Only
                    </button>
                    {aiGeneratedData.imageAltTexts?.length > 0 && p.images.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          const updated = p.images.map((img, i) => {
                            const tag = aiGeneratedData.imageAltTexts.find((d) => d.index === i) || aiGeneratedData.imageAltTexts[i];
                            return { ...img, alt: tag ? `${tag.altEn} (${tag.altBn})` : img.alt };
                          });
                          setP((cur) => ({ ...cur, images: updated }));
                          setAiNotice("Image alt-tags applied to photos!");
                          setShowAiModal(false);
                          setTimeout(() => setAiNotice(""), 5000);
                        }}
                      >
                        Apply Alt-Tags Only
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        const d = aiGeneratedData;
                        const updatedImages = p.images.map((img, i) => {
                          const tag = d.imageAltTexts?.find((x) => x.index === i) || d.imageAltTexts?.[i];
                          return { ...img, alt: tag ? `${tag.altEn} (${tag.altBn})` : img.alt };
                        });

                        setP((cur) => ({
                          ...cur,
                          title: d.titleEn || cur.title || d.titleBn,
                          titleBn: d.titleBn || cur.titleBn,
                          descriptionHtml: d.descriptionHtml || cur.descriptionHtml,
                          seoTitle: d.seo.metaTitle || cur.seoTitle,
                          seoDescription: d.seo.metaDescription || cur.seoDescription,
                          tags: Array.from(new Set([...cur.tags, ...(d.tags || [])])),
                          images: updatedImages,
                        }));
                        setAiNotice("All AI listing fields, SEO, and alt-tags applied successfully!");
                        setShowAiModal(false);
                        setTimeout(() => setAiNotice(""), 6000);
                      }}
                      style={{ background: "#4F46E5", fontWeight: 700 }}
                    >
                      ✓ Apply All to Product
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
