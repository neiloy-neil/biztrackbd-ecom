import type { Metadata } from "next";
import Link from "next/link";
import { listCategoriesAdmin } from "@biztrackbd/core";
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
      <Link href="/products" className="back" prefetch={false}>← Products</Link>
      <div className="page-head"><h1>Add product</h1></div>
      <ProductEditor initial={EMPTY} categories={categories.map((c) => ({ id: c.id, name: c.name }))} canPublish />
    </>
  );
}
