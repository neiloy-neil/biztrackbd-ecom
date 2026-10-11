import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductForEdit, listCategoriesAdmin } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { archiveProductAction } from "../actions";
import { ProductEditor, type EditorProduct, type OptionDef } from "../editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit product" };

/** Rebuilds the option chips from the saved variants' option maps, in the order they first appear. */
function optionsOf(variants: { options: Record<string, string> }[]): OptionDef[] {
  const defs = new Map<string, string[]>();
  for (const v of variants) for (const [k, val] of Object.entries(v.options)) {
    const list = defs.get(k) ?? [];
    if (!list.includes(val)) list.push(val);
    defs.set(k, list);
  }
  return [...defs].map(([name, values]) => ({ name, values }));
}

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireAccess("products");
  const p = await getProductForEdit(s.tenantId, s.actor, id).catch(() => null);
  if (!p) notFound();
  const categories = await listCategoriesAdmin(s.tenantId, s.actor);
  const initial: EditorProduct = {
    id: p.id, title: p.title, titleBn: p.titleBn ?? "", descriptionHtml: p.descriptionHtml, basePrice: p.basePrice, compareAtPrice: p.compareAtPrice, costPrice: p.costPrice,
    status: p.status === "ACTIVE" ? "ACTIVE" : "DRAFT", categoryId: p.categoryId, tags: p.tags, seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "", isFeatured: p.isFeatured,
    images: p.images, slug: p.slug, options: optionsOf(p.variants),
    variants: p.variants.map((v) => ({ id: v.id, title: v.title, sku: v.sku ?? "", price: v.price, stockQuantity: v.stockQuantity, stockBefore: v.stockQuantity, reorderLevel: v.reorderLevel, options: v.options })),
  };
  return (
    <>
      <Link href="/products" className="back" prefetch={false}>← Products</Link>
      <div className="page-head">
        <h1>{p.title}</h1>
        <span className={`pill ${p.status === "ACTIVE" ? "ok" : "grey"}`}>{p.status === "ACTIVE" ? "Active" : "Draft"}</span>
        <div className="actions"><a className="btn btn-secondary btn-sm" href={`http://${s.tenantSubdomain}.localhost:3000/products/${p.slug}`} target="_blank" rel="noopener noreferrer">View on store</a></div>
      </div>
      {one(sp.saved) && <div className="notice good" role="status" style={{ marginBottom: 14 }} data-testid="saved">Saved.</div>}
      <ProductEditor key={`${p.id}-${one(sp.saved) ?? ""}`} initial={initial} categories={categories.map((c) => ({ id: c.id, name: c.name }))} canPublish />
      <section className="card" style={{ marginTop: 14 }}>
        <details>
          <summary className="link" style={{ cursor: "pointer" }}>Delete this product</summary>
          <form action={async () => { "use server"; await archiveProductAction(id); const { redirect } = await import("next/navigation"); redirect("/products"); }} className="stack" style={{ marginTop: 12 }}>
            <p className="muted">It disappears from your store and your product list. Past orders keep their details.</p>
            <SubmitButton className="btn btn-danger" pending="Deleting…">Delete product</SubmitButton>
          </form>
        </details>
      </section>
    </>
  );
}
