"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CameraIcon, PlusIcon } from "@/components/icons";
import { taka } from "@/lib/format";
import { saveProductAction } from "./actions";

export interface VariantRow {
  id?: string;
  title: string;
  sku: string;
  price: number;
  stockQuantity: number;
  /** Stock as loaded, so saving applies only the difference. */
  stockBefore?: number;
  reorderLevel: number;
  options: Record<string, string>;
}
export interface OptionDef { name: string; values: string[] }
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
  if (list.length === 1 && Object.keys(list[0]!).length === 0) return current.length ? [current.find((v) => v.title.toLowerCase() === "default") ?? { ...current[0]!, title: "Default", options: {} }] : [{ title: "Default", sku: "", price: basePrice, stockQuantity: 0, reorderLevel: 5, options: {} }];
  return list.map((combo) => {
    const title = Object.values(combo).join(" / ");
    const old = current.find((v) => v.title.toLowerCase() === title.toLowerCase());
    return old ? { ...old, options: combo } : { title, sku: "", price: basePrice, stockQuantity: 0, reorderLevel: 5, options: combo };
  });
}

function wrap(el: HTMLTextAreaElement, before: string, after: string): string {
  const { selectionStart: a, selectionEnd: b, value } = el;
  return `${value.slice(0, a)}${before}${value.slice(a, b) || "text"}${after}${value.slice(b)}`;
}

export function ProductEditor({ initial, categories, canPublish }: { initial: EditorProduct; categories: { id: string; name: string }[]; canPublish: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [options, setOptions] = useState<OptionDef[]>(initial.options);
  const [newCategory, setNewCategory] = useState("");
  const [valueDraft, setValueDraft] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");
  const [field, setField] = useState("");
  const [limit, setLimit] = useState(false);
  const [busy, setBusy] = useState(false);
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
      compareAtPrice: p.compareAtPrice || null, costPrice: p.costPrice ?? null, status, categoryId: newCategory.trim() ? null : p.categoryId, newCategoryName: newCategory.trim() || undefined,
      tags: p.tags, seoTitle: p.seoTitle || null, seoDescription: p.seoDescription || null, isFeatured: p.isFeatured, images: p.images,
      variants: p.variants.map((v) => ({ id: v.id, title: v.title, sku: v.sku || null, price: v.price || 0, stockQuantity: v.stockQuantity, stockBefore: v.stockBefore, reorderLevel: v.reorderLevel, options: v.options })),
    }, initial.id);
    setBusy(false);
    if (!r.ok) { setError(r.error); setField(r.field ?? ""); setLimit(Boolean(r.limit)); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    router.push(isNew ? `/products/${r.id}?saved=1` : `/products/${r.id}?saved=1`);
    router.refresh();
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(p.status); }} className="has-sticky" data-testid="product-editor" noValidate>
      {error && (
        <div className="notice bad" role="alert" style={{ marginBottom: 14 }} data-testid="editor-error">
          {error} {limit && <Link href="/billing" className="link">See your plan</Link>}
        </div>
      )}
      <div className="split">
        <div className="col stack">
          <section className="card">
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
                  <label className="field"><span className="label">SKU <span className="opt">(optional)</span></span><input className="input" value={p.variants[0]?.sku ?? ""} onChange={(e) => setVariant(0, { sku: e.target.value })} /></label>
                </div>
                <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Does it come in sizes or colors? Add options and set stock for each.</p>
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
                {options.length < 2 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyOptions([...options, { name: options.length === 0 ? "Size" : "Color", values: [] }])}>+ Add {options.length === 0 ? "an option" : "another option"}</button>}
                <div style={{ overflowX: "auto", marginTop: 14 }}>
                  <table className="table" data-testid="variant-table">
                    <thead><tr><th>Variant</th><th>Price</th><th>SKU</th><th>In stock</th></tr></thead>
                    <tbody>
                      {p.variants.map((v, i) => (
                        <tr key={v.id ?? v.title}>
                          <td style={{ whiteSpace: "nowrap" }}><b>{v.title}</b></td>
                          <td><input className="input input-sm" style={{ width: 90 }} inputMode="decimal" aria-label={`Price for ${v.title}`} value={v.price || ""} onChange={(e) => setVariant(i, { price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></td>
                          <td><input className="input input-sm" style={{ width: 110 }} aria-label={`SKU for ${v.title}`} value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} /></td>
                          <td><input className="input input-sm" style={{ width: 70 }} inputMode="numeric" aria-label={`Stock for ${v.title}`} value={v.stockQuantity} onChange={(e) => setVariant(i, { stockQuantity: Math.max(0, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0) })} data-testid={`stock-${v.title}`} /></td>
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
            <h2>Organise</h2>
            <label className="field"><span className="label">Category</span>
              <select className="select" value={p.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)} disabled={newCategory.trim() !== ""} data-testid="p-category">
                <option value="">No category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
            <label className="field"><span className="label">…or create a new category</span><input className="input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Gamchha" maxLength={60} data-testid="p-newcat" /></label>
            <label className="field"><span className="label">Tags <span className="opt">(separate with commas)</span></span>
              <input className="input" value={p.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20))} placeholder="cotton, handloom" /></label>
            <label className="check"><input type="checkbox" checked={p.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} /><span>Feature on the home page</span></label>
          </section>

          <section className="card">
            <h2>Google preview</h2>
            {/* A picture of a Google result: Google shows these on white in every theme, so it stays white and dark-on-white. */}
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
  );
}
