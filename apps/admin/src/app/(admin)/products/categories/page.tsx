import type { Metadata } from "next";
import Link from "next/link";
import { can, listCategoriesAdmin } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { SubmitButton } from "@/components/ui";
import { ConfirmDelete } from "@/components/confirm-delete";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { deleteCategoryAction, saveCategoryAction } from "./actions";
import { ImageField } from "./image-field";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Categories" };

export default async function Categories({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("products");
  const canEdit = can(s.user.role, "products", "edit");
  const list = await listCategoriesAdmin(s.tenantId, s.actor);
  const editing = list.find((c) => c.id === one(sp.edit));
  const creating = one(sp.new) !== undefined;
  const showForm = canEdit && (creating || Boolean(editing));
  const tops = list.filter((c) => !c.parentId && c.id !== editing?.id);
  const hasChildren = editing ? list.some((c) => c.parentId === editing.id) : false;
  const err = one(sp.err);

  return (
    <>
      <PageHeader
        title="Categories"
        crumbs={[
          { label: "Products", href: "/products" },
          { label: "Categories" },
        ]}
        description="Group your products so customers can find them. A category can have sub-categories one level deep: the shop page of a category also shows the products in its sub-categories."
        actions={canEdit ? <Link href="/products/categories?new=1" className="btn btn-primary" prefetch={false} data-testid="new-category">Add a category</Link> : undefined}
      />
      {one(sp.saved) && <div className="notice good mb-md" role="status" data-testid="category-saved">Category saved.</div>}
      {one(sp.deleted) && <div className="notice good mb-md" role="status">Category deleted. Its products are kept, without a category.</div>}
      {err && <div className="notice bad mb-md" role="alert" data-testid="category-error">{err}</div>}

      <div className="split">
        <div className="col">
          {list.length === 0 ? (
            <div className="card empty">No categories yet.</div>
          ) : (
            <div className="stack" data-testid="category-list">
              {list.map((c) => (
                <div key={c.id} className={`card${c.parentId ? " category-indent" : ""}`} data-testid="category-row">
                  <div className="row flex-between nowrap">
                    <div className="flex-1">
                      <b>{c.parentId ? "↳ " : ""}{c.name}</b> {!c.isActive && <span className="pill grey">Hidden</span>}
                      <div className="muted text-sm">{c.products} {c.products === 1 ? "product" : "products"} · /{c.slug}</div>
                    </div>
                    {canEdit && (
                      <div className="row gap-md nowrap">
                        <Link href={`/products/categories?edit=${c.id}`} className="btn btn-secondary btn-sm" prefetch={false}>Edit</Link>
                        <ConfirmDelete action={async () => { "use server"; await deleteCategoryAction(c.id); }} message={`Delete category "${c.name}"? Products inside will be kept as uncategorized.`} label="Delete" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showForm && (
          <div className="col">
            <form action={saveCategoryAction} className="card stack" data-testid="category-form" key={editing?.id ?? "new"}>
              <h2>{editing ? `Edit ${editing.name}` : "New category"}</h2>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <label className="field mb-0"><span className="label">Name</span><input className="input" name="name" required minLength={2} maxLength={60} defaultValue={editing?.name ?? ""} data-testid="category-name" /></label>
              <label className="field mb-0">
                <span className="label">Inside <span className="opt">(optional)</span></span>
                <select className="select" name="parentId" defaultValue={editing?.parentId ?? ""} disabled={hasChildren} data-testid="category-parent">
                  <option value="">Nothing: a top-level category</option>
                  {tops.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {hasChildren && <span className="muted text-xs">It has sub-categories, so it stays top-level.</span>}
              </label>
              <label className="field mb-0"><span className="label">Description <span className="opt">(optional)</span></span><textarea className="textarea" name="description" rows={2} maxLength={500} defaultValue={editing?.description ?? ""} /></label>
              <ImageField initial={editing?.imageUrl ?? null} />
              <label className="field mb-0"><span className="label">Position <span className="opt">(smaller numbers come first)</span></span><input className="input" name="sortOrder" type="number" inputMode="numeric" min={0} max={9999} defaultValue={editing?.sortOrder ?? 0} /></label>
              <label className="row gap-md"><input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} className="pick-checkbox-mobile" /> Show it on my store</label>
              <div className="row">
                <SubmitButton className="btn btn-primary" pending="Saving…" data-testid="category-save">Save category</SubmitButton>
                <Link href="/products/categories" className="btn btn-secondary" prefetch={false}>Cancel</Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
