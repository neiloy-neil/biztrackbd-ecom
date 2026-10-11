import {
  defaultPageFor, getLive, getProductBySlug, getReviewSummary, listCategories, listProducts, listPublicReviews, sanitizeProductHtml,
  type PageJson, type ProductSort,
} from "@biztrackbd/core";
import type { CollectionCtx, ProductCtx } from "@/lib/page-ctx";

/** Product, collection and cart pages (docs/39): the layout the owner published, or the one the storefront has always shown. */
export type StorePageKind = "product" | "collection" | "cart";

export async function getPageLayout(storeId: string, kind: StorePageKind): Promise<PageJson> {
  try {
    const live = await getLive(storeId, kind);
    if (live) return live.page;
  } catch (e) {
    // A layout that cannot be read must never take the page down.
    console.error("page layout failed", kind, e instanceof Error ? e.name : "unknown");
  }
  return defaultPageFor(kind);
}

export async function loadProductCtx(storeId: string, slug: string): Promise<ProductCtx | null> {
  const p = await getProductBySlug(storeId, slug);
  if (!p) return null;
  const [summary, reviews] = await Promise.all([getReviewSummary(storeId, p.id), listPublicReviews(storeId, p.id, 10)]);
  return { p, descriptionHtml: sanitizeProductHtml(p.descriptionHtml), summary, reviews };
}

export async function loadCollectionCtx(storeId: string, slug: string, sort: ProductSort, page: number): Promise<CollectionCtx | null> {
  const cat = (await listCategories(storeId)).find((c) => c.slug === slug);
  if (!cat) return null;
  const result = await listProducts(storeId, { categorySlug: slug, sort, page });
  return { category: { slug: cat.slug, name: cat.name, description: (cat as { description?: string | null }).description ?? null }, result, sort, basePath: `/c/${slug}` };
}
