import type { Metadata } from "next";
import { listCategoriesAdmin } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { requireAccess } from "@/lib/session";
import { ProductEditor, type EditorProduct } from "../editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add product" };

const EMPTY: EditorProduct = {
  title: "", titleBn: "", descriptionHtml: "", basePrice: 0, compareAtPrice: null, costPrice: null, status: "ACTIVE", categoryId: null, tags: [], seoTitle: "",
  seoDescription: "", isFeatured: false, images: [], slug: "", options: [],
  variants: [{ title: "Default", sku: "", price: 0, stockQuantity: 0, reorderLevel: 5, options: {} }],
};

export default async function NewProduct() {
  const s = await requireAccess("products", "edit");
  const categories = await listCategoriesAdmin(s.tenantId, s.actor);
  return (
    <>
      <PageHeader
        title="Add product"
        crumbs={[
          { label: "Products", href: "/products" },
          { label: "Add product" },
        ]}
      />
      <ProductEditor initial={EMPTY} categories={categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }))} canPublish />
    </>
  );
}
