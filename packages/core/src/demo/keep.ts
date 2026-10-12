import { timingSafeEqual } from "node:crypto";
import { withTenant, type TenantTx } from "@biztrackbd/db";
import { getLive, publish, saveDraft } from "../builder/versions";
import { deleteDemoTenant } from "./session";
import type { StaffActor } from "../permissions";

/**
 * "Keep this store" (docs/41). A visitor's demo copy has a secret code. Signing up with that code carries the demo's categories, products
 * (with variants and pictures), store details and home page into the new store, instead of the template's untouched sample products.
 * Pictures are copied (not linked): the template demo stores are rebuilt every night and their pictures deleted.
 */

export const KEEP_MAX_PRODUCTS = 200;

export interface KeepCode { tenantId: string; token: string }

export function parseKeepCode(code: string | null | undefined): KeepCode | null {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{16,64})$/.exec((code ?? "").trim());
  return m ? { tenantId: m[1]!, token: m[2]! } : null;
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export interface KeptStore {
  demoTenantId: string;
  template: string;
  categories: { id: string; name: string; slug: string; description: string | null; imageUrl: string | null; sortOrder: number; isActive: boolean }[];
  products: {
    title: string; titleBn: string | null; slug: string; descriptionHtml: string; shortExcerpt: string | null; status: string; basePrice: number; compareAtPrice: number | null; costPrice: number | null;
    isFeatured: boolean; categoryId: string | null; tags: string[]; images: { url: string; altText: string | null }[];
    variants: { title: string; sku: string | null; price: number; compareAtPrice: number | null; stockQuantity: number; reorderLevel: number; options: unknown; imageUrl: string | null }[];
  }[];
  settings: { tagline: string | null; description: string | null; announcement: string | null; announcementBn: string | null; storeNameBn: string | null } | null;
}

/** Reads what a code opens, or null when the code is wrong, used up, or the demo has ended. Changes nothing. */
export async function readKeptStore(code: string | null | undefined, now = new Date()): Promise<KeptStore | null> {
  const k = parseKeepCode(code);
  if (!k) return null;
  const data = await withTenant(k.tenantId, async (tx) => {
    const t = await tx.tenant.findFirst({ where: { id: k.tenantId, demoKind: "SESSION" }, select: { demoKeepToken: true, demoExpiresAt: true, demoTemplate: true } });
    if (!t?.demoKeepToken || !same(t.demoKeepToken, k.token) || !t.demoExpiresAt || t.demoExpiresAt <= now) return null;
    const categories = await tx.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const products = await tx.product.findMany({
      where: { deletedAt: null, status: { not: "ARCHIVED" } }, orderBy: { createdAt: "asc" }, take: KEEP_MAX_PRODUCTS,
      include: { variants: true, images: { orderBy: { sortOrder: "asc" } } },
    });
    const s = await tx.storeSettings.findFirst();
    return { t, categories, products, s };
  }).catch(() => null);
  if (!data) return null;
  return {
    demoTenantId: k.tenantId, template: data.t.demoTemplate ?? "",
    categories: data.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, sortOrder: c.sortOrder, isActive: c.isActive })),
    products: data.products.map((p) => ({
      title: p.title, titleBn: p.titleBn, slug: p.slug, descriptionHtml: p.descriptionHtml, shortExcerpt: p.shortExcerpt, status: p.status, basePrice: Number(p.basePrice),
      compareAtPrice: p.compareAtPrice == null ? null : Number(p.compareAtPrice), costPrice: p.costPrice == null ? null : Number(p.costPrice), isFeatured: p.isFeatured,
      categoryId: p.categoryId, tags: p.tags,
      images: p.images.map((i) => ({ url: i.url, altText: i.altText })),
      variants: p.variants.map((v) => ({ title: v.title, sku: v.sku, price: Number(v.price), compareAtPrice: v.compareAtPrice == null ? null : Number(v.compareAtPrice), stockQuantity: v.stockQuantity, reorderLevel: v.reorderLevel, options: v.options, imageUrl: v.imageUrl })),
    })),
    settings: data.s ? { tagline: data.s.tagline, description: data.s.description, announcement: data.s.announcement, announcementBn: data.s.announcementBn, storeNameBn: data.s.storeNameBn } : null,
  };
}

/** The demo's published home page, as plain data, so its pictures can be copied too. */
export async function keptPageJson(demoTenantId: string): Promise<unknown> {
  return (await getLive(demoTenantId, "home").catch(() => null))?.page ?? null;
}

/** Every picture the kept store uses, so they can be copied before the rows are written. */
export function keptPictureUrls(k: KeptStore, pageJson?: unknown): string[] {
  const urls = new Set<string>();
  for (const c of k.categories) if (c.imageUrl) urls.add(c.imageUrl);
  for (const p of k.products) { for (const i of p.images) urls.add(i.url); for (const v of p.variants) if (v.imageUrl) urls.add(v.imageUrl); }
  for (const u of JSON.stringify(pageJson ?? {}).match(/https:\/\/[^"\\]+\.webp/g) ?? []) urls.add(u);
  return [...urls];
}

/** Copies each picture into the new store. A picture that cannot be copied is left out; nothing else is affected. */
export async function copyKeptPictures(newTenantId: string, urls: string[], copy: (tenantId: string, url: string) => Promise<string>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const u of urls) {
    try { map.set(u, await copy(newTenantId, u)); } catch (e) { console.error("[keep] picture not copied", e instanceof Error ? e.name : "unknown"); }
  }
  return map;
}

/** Writes the demo's categories and products into the new store (inside the signup's own transaction). */
export async function writeKeptCatalog(tx: TenantTx, newTenantId: string, k: KeptStore, pictures: Map<string, string>): Promise<number> {
  const cat = new Map<string, string>();
  for (const c of k.categories) {
    cat.set(c.id, (await tx.category.create({ data: { tenantId: newTenantId, name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder, isActive: c.isActive, imageUrl: c.imageUrl ? pictures.get(c.imageUrl) ?? null : null } })).id);
  }
  for (const p of k.products) {
    const created = await tx.product.create({
      data: {
        tenantId: newTenantId, title: p.title, titleBn: p.titleBn, slug: p.slug, descriptionHtml: p.descriptionHtml, shortExcerpt: p.shortExcerpt, status: p.status as never,
        basePrice: p.basePrice, compareAtPrice: p.compareAtPrice, costPrice: p.costPrice, isFeatured: p.isFeatured, categoryId: p.categoryId ? cat.get(p.categoryId) ?? null : null, tags: p.tags,
      },
    });
    let order = 0;
    for (const i of p.images) {
      const url = pictures.get(i.url);
      if (url) await tx.productImage.create({ data: { tenantId: newTenantId, productId: created.id, url, altText: i.altText, sortOrder: order++ } });
    }
    for (const v of p.variants) {
      await tx.productVariant.create({
        data: { tenantId: newTenantId, productId: created.id, title: v.title, sku: v.sku, price: v.price, compareAtPrice: v.compareAtPrice, stockQuantity: v.stockQuantity, reorderLevel: v.reorderLevel, options: v.options as never, imageUrl: v.imageUrl ? pictures.get(v.imageUrl) ?? null : null },
      });
    }
  }
  await tx.$executeRaw`UPDATE "Tenant" SET "productCount" = "productCount" + ${k.products.length} WHERE id = ${newTenantId}`;
  return k.products.length;
}

/** The demo's home page (sections and look), with its pictures swapped for the copies, published on the new store. Skipped quietly when the plan does not allow it. */
export async function copyKeptPage(demoTenantId: string, newTenantId: string, actor: StaffActor, pictures: Map<string, string>): Promise<boolean> {
  try {
    const live = await getLive(demoTenantId, "home");
    if (!live) return false;
    let json = JSON.stringify(live.page);
    for (const [from, to] of pictures) json = json.split(from).join(to);
    await saveDraft(newTenantId, actor, "home", JSON.parse(json), live.theme);
    await publish(newTenantId, actor, "home", "From your demo");
    return true;
  } catch (e) {
    console.error("[keep] home page not copied", e instanceof Error ? e.name : "unknown");
    return false;
  }
}

/** The store was kept, so the demo is over: its copy is deleted, which also ends the visitor's demo session and makes the code useless. */
export async function finishKeep(demoTenantId: string): Promise<void> {
  await withTenant(demoTenantId, (tx) => tx.tenant.updateMany({ where: { id: demoTenantId }, data: { demoKeepToken: null } })).catch(() => undefined);
  await deleteDemoTenant(demoTenantId).catch((e) => console.error("[keep] demo copy not deleted", e instanceof Error ? e.name : "unknown"));
}
