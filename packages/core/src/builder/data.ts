import { listCategories, listProducts, type CategoryCard, type ProductCard } from "../storefront/catalog";
import { productKey, type PageJson } from "./registry";

/**
 * The live data a page's sections need. Prices and stock come from the database, never from the layout.
 * Products are keyed by what a section asks for ("new", "sale", "featured", "cat:<slug>"), so the same data can feed a page
 * that is edited live in the browser without another trip to the server.
 */
export interface PageData {
  products: Record<string, ProductCard[]>;
  categories: CategoryCard[];
}

export const MAX_GRID = 12;

async function fetchKey(tenantId: string, key: string): Promise<ProductCard[]> {
  if (key === "sale") return (await listProducts(tenantId, { limit: MAX_GRID, onSale: true })).items;
  if (key === "featured") return (await listProducts(tenantId, { limit: MAX_GRID, featuredOnly: true })).items;
  if (key.startsWith("cat:")) return key.length > 4 ? (await listProducts(tenantId, { limit: MAX_GRID, categorySlug: key.slice(4) })).items : [];
  return (await listProducts(tenantId, { limit: MAX_GRID, sort: "newest" })).items;
}

/** For a published page: only what its sections use. With `everything`, every kind of grid (the editor preview). */
export async function loadPageData(tenantId: string, page: PageJson, opts: { everything?: boolean } = {}): Promise<PageData> {
  const keys = new Set<string>();
  let wantsCategories = !!opts.everything;
  for (const s of page.sections) {
    if (s.disabled) continue;
    if (s.type === "featured-products") keys.add(productKey(s.settings as { source: string; categorySlug?: string }));
    if (s.type === "category-grid") wantsCategories = true;
  }
  const categories = wantsCategories ? await listCategories(tenantId) : [];
  if (opts.everything) {
    for (const k of ["new", "sale", "featured"]) keys.add(k);
    for (const c of categories) keys.add(`cat:${c.slug}`);
  }
  const entries = await Promise.all([...keys].map(async (k) => [k, await fetchKey(tenantId, k)] as const));
  return { products: Object.fromEntries(entries), categories };
}
