import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductForEdit, listCategoriesAdmin } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { SubmitButton } from "@/components/ui";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { archiveProductAction, restoreProductAction, deleteProductAction } from "../actions";
import { ConfirmDelete } from "@/components/confirm-delete";
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
    variants: p.variants.map((v) => ({ id: v.id, title: v.title, sku: v.sku ?? "", price: v.price, stockQuantity: v.stockQuantity, stockBefore: v.stockQuantity, reorderLevel: v.reorderLevel, isActive: v.isActive ?? true, options: v.options })),
  };
  return (
    <>
      <PageHeader
        title={p.title}
        crumbs={[
          { label: "Products", href: "/products" },
          { label: p.title },
        ]}
        badge={<span className={`pill ${p.status === "ACTIVE" ? "ok" : p.status === "ARCHIVED" ? "warn" : "grey"}`}>{p.status === "ACTIVE" ? "Active" : p.status === "ARCHIVED" ? "Archived" : "Draft"}</span>}
        actions={
          <a className="btn btn-secondary btn-sm" href={`${storefrontOrigin(s.tenantSubdomain)}/products/${p.slug}`} target="_blank" rel="noopener noreferrer">
            View on store
          </a>
        }
      />
      {one(sp.saved) && <div className="notice good mb-md" role="status" data-testid="saved">Saved.</div>}
      {p.status === "ARCHIVED" && (
        <div className="notice warn mb-md">
          <div className="row flex-between gap-lg">
            <span>This product is currently <b>archived</b>. It is hidden from your store and active inventory.</span>
            <form action={async () => { "use server"; await restoreProductAction(id); const { redirect } = await import("next/navigation"); redirect(`/products/${id}?saved=1`); }}>
              <SubmitButton className="btn btn-primary btn-sm" pending="Restoring…">Restore product to draft</SubmitButton>
            </form>
          </div>
        </div>
      )}
      <ProductEditor key={`${p.id}-${one(sp.saved) ?? ""}`} initial={initial} categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))} canPublish />
      <section className="card mt-md">
        <h3 className="text-lg text-bold mb-xs">Product Lifecycle & Danger Zone</h3>
        <p className="muted mb-md">Archive to hide this product safely from customers and stock lists, or permanently remove it if it has no sales history.</p>
        
        <div className="stack gap-lg">
          {p.status !== "ARCHIVED" ? (
            <div className="card-panel-muted flex-between">
              <div>
                <b>Archive Product</b>
                <p className="muted text-sm mt-xs">Removes from your online store and inventory counts. Can be unarchived anytime.</p>
              </div>
              <form action={async () => { "use server"; await archiveProductAction(id); const { redirect } = await import("next/navigation"); redirect("/products?tab=archived&msg=archive-1-0"); }}>
                <SubmitButton className="btn btn-secondary btn-sm" pending="Archiving…">Archive product</SubmitButton>
              </form>
            </div>
          ) : (
            <div className="card-panel-muted flex-between">
              <div>
                <b>Restore Product</b>
                <p className="muted text-sm mt-xs">Restores this product to draft status so you can edit and republish it.</p>
              </div>
              <form action={async () => { "use server"; await restoreProductAction(id); const { redirect } = await import("next/navigation"); redirect(`/products/${id}?saved=1`); }}>
                <SubmitButton className="btn btn-primary btn-sm" pending="Restoring…">Restore to draft</SubmitButton>
              </form>
            </div>
          )}

          <div className="card-panel-danger flex-between">
            <div>
              <b className="text-danger">Permanent Deletion</b>
              <p className="muted text-sm mt-xs">If no orders exist for this product, it will be deleted permanently. Past order data is always preserved.</p>
            </div>
            <ConfirmDelete action={async () => { "use server"; await deleteProductAction(id); const { redirect } = await import("next/navigation"); redirect("/products?msg=delete-1-0"); }} message={`Permanently delete "${p.title}"? This cannot be undone. Past customer invoices and orders remain preserved.`} label="Delete product" testId="delete-product-btn" />
          </div>
        </div>
      </section>
    </>
  );
}
