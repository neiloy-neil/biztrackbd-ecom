import { listCategories, listProducts, type CategoryCard, type ProductCard } from "../storefront/catalog";
import { productKey, type PageJson } from "./registry";
import { listContentItems, type SiteContentItem } from "../site/content-items";
import { getPublicMenu, type PublicMenuCategory } from "../site/menu";
import { getPublicDownloads, type PublicDownloadView } from "../site/downloads";

/**
 * The live data a page's sections need. Prices and stock come from the database, never from the layout.
 * Products are keyed by what a section asks for ("new", "sale", "featured", "cat:<slug>"), so the same data can feed a page
 * that is edited live in the browser without another trip to the server.
 *
 * For BizTrack Business verticals, also carries active structured content items, public restaurant menus, and digital downloads.
 */
export interface PageData {
  products: Record<string, ProductCard[]>;
  categories: CategoryCard[];
  contentItems?: Record<string, SiteContentItem[]>;
  menu?: PublicMenuCategory[];
  downloads?: PublicDownloadView[];
}

export const MAX_GRID = 12;

async function fetchKey(tenantId: string, key: string): Promise<ProductCard[]> {
  if (key === "sale") return (await listProducts(tenantId, { limit: MAX_GRID, onSale: true })).items;
  if (key === "featured") return (await listProducts(tenantId, { limit: MAX_GRID, featuredOnly: true })).items;
  if (key.startsWith("cat:")) return key.length > 4 ? (await listProducts(tenantId, { limit: MAX_GRID, categorySlug: key.slice(4) })).items : [];
  return (await listProducts(tenantId, { limit: MAX_GRID, sort: "newest" })).items;
}

const VERTICAL_SECTIONS = new Set([
  "service-cards",
  "team-grid",
  "portfolio-grid",
  "clinic-chambers",
]);

/** For a published page: only what its sections use. With `everything`, every kind of grid and vertical feed (the editor preview). */
export async function loadPageData(tenantId: string, page: PageJson, opts: { everything?: boolean } = {}): Promise<PageData> {
  const keys = new Set<string>();
  let wantsCategories = !!opts.everything;
  let wantsContentItems = !!opts.everything;
  let wantsMenu = !!opts.everything;
  let wantsDownloads = !!opts.everything;

  for (const s of page.sections) {
    if (s.disabled) continue;
    if (s.type === "featured-products") keys.add(productKey(s.settings as { source: string; categorySlug?: string }));
    if (s.type === "category-grid") wantsCategories = true;
    if (VERTICAL_SECTIONS.has(s.type)) wantsContentItems = true;
    if (s.type === "restaurant-menu") wantsMenu = true;
    if (s.type === "download-card") wantsDownloads = true;
  }
  const categories = wantsCategories ? await listCategories(tenantId) : [];
  if (opts.everything) {
    for (const k of ["new", "sale", "featured"]) keys.add(k);
    for (const c of categories) keys.add(`cat:${c.slug}`);
  }

  const [productEntries, rawItems, menu, downloads] = await Promise.all([
    Promise.all([...keys].map(async (k) => [k, await fetchKey(tenantId, k)] as const)),
    wantsContentItems ? listContentItems(tenantId, { isPublished: true }).catch(() => []) : Promise.resolve([]),
    wantsMenu ? getPublicMenu(tenantId).catch(() => []) : Promise.resolve([]),
    wantsDownloads ? getPublicDownloads(tenantId).catch(() => []) : Promise.resolve(undefined),
  ]);

  const contentItemsByKind: Record<string, SiteContentItem[]> = {};
  for (const item of rawItems) {
    if (!contentItemsByKind[item.kind]) {
      contentItemsByKind[item.kind] = [];
    }
    contentItemsByKind[item.kind]!.push(item);
  }

  return {
    products: Object.fromEntries(productEntries),
    categories,
    contentItems: contentItemsByKind,
    menu,
    downloads,
  };
}
