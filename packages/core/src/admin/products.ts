import { afterRestock } from "./stock-alerts";
import { assertNotInDemo } from "../demo/guard";
import { Prisma, withTenant } from "@biztrackbd/db";
import { z } from "zod";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { claimProductSlot } from "../limits/plan";
import { archiveProduct } from "../products/service";
import { assertCan, type StaffActor } from "../permissions";
import { sanitizeProductHtml } from "../storefront/html";
import { headerKey, parseCsv, parseMoney } from "../finance/csv";

export type ProductTab = "all" | "active" | "draft" | "out";

export interface AdminProductRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  imageUrl: string | null;
  variantCount: number;
  optionSummary: string;
  stock: number;
  categoryName: string | null;
  price: number;
  sold30d: number;
}

/** "Panjabi" -> "panjabi". Non-Latin titles (Bangla) have no Latin letters, so they fall back to a short random slug. */
export function slugify(title: string): string {
  const s = title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
  return s.length >= 2 ? s : `product-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listAdminProducts(
  tenantId: string, actor: StaffActor, opts: { tab?: ProductTab; q?: string; categoryId?: string; collectionId?: string; page?: number; pageSize?: number } = {},
) {
  assertCan(actor, "products", "view");
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const q = opts.q?.trim().slice(0, 60);
  const like = q?.replace(/[\\%_]/g, (c) => `\\${c}`);
  const tab = opts.tab ?? "all";
  const base: Prisma.ProductWhereInput = { deletedAt: null, status: { not: "ARCHIVED" } };
  const tabWhere: Prisma.ProductWhereInput =
    tab === "active" ? { status: "ACTIVE" } : tab === "draft" ? { status: "DRAFT" } : tab === "out" ? { status: "ACTIVE", variants: { none: { stockQuantity: { gt: 0 } } } } : {};
  const where: Prisma.ProductWhereInput = {
    ...base, ...tabWhere,
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.collectionId ? { collections: { some: { collectionId: opts.collectionId } } } : {}),
    ...(q ? { OR: [{ title: { contains: like, mode: "insensitive" } }, { titleBn: { contains: like } }, { variants: { some: { sku: { contains: like, mode: "insensitive" } } } }] } : {}),
  };

  return withTenant(tenantId, async (tx) => {
    const products = await tx.product.findMany({
      relationLoadStrategy: "join",
      where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, category: { select: { name: true } }, variants: { select: { stockQuantity: true, options: true } } },
    });
    const total = await tx.product.count({ where });
    const ids = products.map((p) => p.id);
    const sold = ids.length
      ? await tx.$queryRaw<{ id: string; n: number }[]>`
          SELECT oi."productId" AS id, COALESCE(sum(oi.quantity), 0)::int AS n
          FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
          WHERE oi."productId" = ANY(${ids}) AND o."createdAt" > now() - interval '30 days' AND o.status NOT IN ('CANCELLED', 'RETURNED', 'REFUNDED')
          GROUP BY oi."productId"`
      : [];
    const counts = {
      all: await tx.product.count({ where: base }),
      active: await tx.product.count({ where: { ...base, status: "ACTIVE" } }),
      draft: await tx.product.count({ where: { ...base, status: "DRAFT" } }),
      out: await tx.product.count({ where: { ...base, status: "ACTIVE", variants: { none: { stockQuantity: { gt: 0 } } } } }),
    };
    const categories = await tx.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });

    const collections = await tx.collection.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true } });

    const rows = products.map<AdminProductRow>((p) => {
      const names = new Set<string>();
      for (const v of p.variants) for (const k of Object.keys((v.options ?? {}) as Record<string, string>)) names.add(k);
      const options = [...names].map((k) => new Set(p.variants.map((v) => ((v.options ?? {}) as Record<string, string>)[k]).filter(Boolean)).size > 0 ? `${new Set(p.variants.map((v) => ((v.options ?? {}) as Record<string, string>)[k]).filter(Boolean)).size} ${k.toLowerCase()}s` : "");
      return {
        id: p.id, slug: p.slug, title: p.title, status: p.status, imageUrl: p.images[0]?.url ?? null, variantCount: p.variants.length,
        optionSummary: options.filter(Boolean).join(" · ") || (p.variants.length > 1 ? `${p.variants.length} variants` : "1 variant"),
        stock: p.variants.reduce((n, v) => n + Math.max(v.stockQuantity, 0), 0), categoryName: p.category?.name ?? null, price: Number(p.basePrice),
        sold30d: sold.find((s) => s.id === p.id)?.n ?? 0,
      };
    });
    return { rows, total, counts, categories, collections, page, pageSize };
  });
}

export const SaveProductInput = z.object({
  title: z.string().trim().min(2, "Enter the product name").max(200),
  titleBn: z.string().trim().max(200).optional().nullable(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes").max(100).optional().or(z.literal("")),
  descriptionHtml: z.string().max(100_000).default(""),
  shortExcerpt: z.string().trim().max(300).optional().nullable(),
  basePrice: z.number().positive("Enter the price").max(10_000_000),
  compareAtPrice: z.number().positive().max(10_000_000).optional().nullable(),
  costPrice: z.number().min(0).max(10_000_000).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
  categoryId: z.string().optional().nullable(),
  newCategoryName: z.string().trim().max(60).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  seoTitle: z.string().trim().max(70).optional().nullable(),
  seoDescription: z.string().trim().max(160).optional().nullable(),
  isFeatured: z.boolean().default(false),
  images: z.array(z.object({ url: z.string().max(500), alt: z.string().trim().max(150).optional().nullable() })).max(10).default([]),
  variants: z
    .array(z.object({
      id: z.string().optional(),
      title: z.string().trim().min(1, "Name each variant").max(80),
      sku: z.string().trim().max(60).optional().nullable(),
      price: z.number().positive("Enter a price for each variant").max(10_000_000),
      compareAtPrice: z.number().positive().max(10_000_000).optional().nullable(),
      stockQuantity: z.number().int().min(0).max(1_000_000),
      /** Stock as it was when the editor loaded. The save applies the difference, so sales made meanwhile are not undone. */
      stockBefore: z.number().int().min(0).max(1_000_000).optional(),
      reorderLevel: z.number().int().min(0).max(100_000).default(5),
      shelfCode: z.string().trim().max(20).optional().nullable(),
      options: z.record(z.string().max(40), z.string().max(60)).default({}),
    }))
    .min(1, "Add at least one variant")
    .max(100),
});
export type SaveProductInput = z.input<typeof SaveProductInput>;

/** Images the store may reference: its own uploads, or https links (for example Supabase Storage). Blocks javascript: and data: URLs. */
const IMAGE_OK = /^(\/media\/[A-Za-z0-9/_.-]+|https:\/\/[^\s"'<>]+)$/;

export async function saveProduct(tenantId: string, actor: StaffActor, raw: unknown, productId?: string): Promise<{ id: string; slug: string; removedImages: string[] }> {
  assertCan(actor, "products", "edit");
  const parsed = SaveProductInput.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    throw new ValidationError(i?.message ?? "Check the product details", { field: String(i?.path.join(".") ?? "") });
  }
  const p = parsed.data;
  if (p.compareAtPrice != null && p.compareAtPrice <= p.basePrice) throw new ValidationError("The compare-at price must be higher than the price", { field: "compareAtPrice" });
  for (const v of p.variants) if (v.compareAtPrice != null && v.compareAtPrice <= v.price) throw new ValidationError("The compare-at price must be higher than the price", { field: "variants" });
  for (const img of p.images) if (!IMAGE_OK.test(img.url)) throw new ValidationError("That photo address is not allowed");
  const skus = p.variants.map((v) => v.sku?.trim().toUpperCase()).filter(Boolean) as string[];
  if (new Set(skus).size !== skus.length) throw new ValidationError("Two variants have the same SKU", { field: "variants" });
  const titles = p.variants.map((v) => v.title.toLowerCase());
  if (new Set(titles).size !== titles.length) throw new ValidationError("Two variants have the same name", { field: "variants" });

  const saved = await withTenant(tenantId, async (tx) => {
    // Category: an existing one, or a new one typed in the editor.
    let categoryId = p.categoryId || null;
    if (p.newCategoryName) {
      const name = p.newCategoryName;
      const slug = slugify(name);
      const existing = await tx.category.findFirst({ where: { slug } });
      categoryId = existing?.id ?? (await tx.category.create({ data: { tenantId, name, slug } })).id;
    } else if (categoryId && !(await tx.category.findFirst({ where: { id: categoryId } }))) {
      throw new ValidationError("Choose a category from the list", { field: "categoryId" });
    }

    let id = productId;
    let slug = p.slug || "";
    const existing = productId ? await tx.product.findFirst({ where: { id: productId }, include: { variants: true } }) : null;
    if (productId && !existing) throw new NotFoundError("Product");

    if (!slug) slug = existing?.slug ?? slugify(p.title);
    // A free URL name: add -2, -3 ... when another product already has it.
    let candidate = slug;
    for (let n = 2; await tx.product.findFirst({ where: { slug: candidate, ...(productId ? { id: { not: productId } } : {}) }, select: { id: true } }); n++) {
      if (p.slug && !existing) throw new ValidationError("A product with that URL name already exists", { field: "slug" });
      if (p.slug && existing && p.slug !== existing.slug) throw new ValidationError("A product with that URL name already exists", { field: "slug" });
      candidate = `${slug}-${n}`;
    }
    slug = candidate;

    const common = {
      title: p.title, titleBn: p.titleBn || null, slug, descriptionHtml: sanitizeProductHtml(p.descriptionHtml), shortExcerpt: p.shortExcerpt || null,
      basePrice: p.basePrice, compareAtPrice: p.compareAtPrice ?? null, costPrice: p.costPrice ?? null, status: p.status, categoryId,
      tags: [...new Set(p.tags.map((t) => t.toLowerCase()))], seoTitle: p.seoTitle || null, seoDescription: p.seoDescription || null, isFeatured: p.isFeatured,
    };

    if (!existing) {
      await claimProductSlot(tx, tenantId);
      const created = await tx.product.create({ data: { tenantId, ...common } });
      id = created.id;
      for (const v of p.variants) {
        await tx.productVariant.create({
          data: {
            tenantId, productId: id, title: v.title, sku: v.sku?.trim().toUpperCase() || null, price: v.price, compareAtPrice: v.compareAtPrice ?? null,
            stockQuantity: v.stockQuantity, reorderLevel: v.reorderLevel, shelfCode: v.shelfCode?.trim() || null, options: v.options,
          },
        });
      }
    } else {
      await tx.product.update({ where: { id: existing.id }, data: common });
      const incomingIds = new Set(p.variants.map((v) => v.id).filter(Boolean) as string[]);
      for (const old of existing.variants) {
        if (!incomingIds.has(old.id)) await tx.productVariant.delete({ where: { id: old.id } });
      }
      for (const v of p.variants) {
        const data = {
          title: v.title, sku: v.sku?.trim().toUpperCase() || null, price: v.price, compareAtPrice: v.compareAtPrice ?? null,
          reorderLevel: v.reorderLevel, shelfCode: v.shelfCode?.trim() || null, options: v.options,
        };
        const current = v.id ? existing.variants.find((x) => x.id === v.id) : undefined;
        if (v.id && !current) throw new ValidationError("A variant on this page no longer exists. Reload and try again.");
        if (!current) {
          await tx.productVariant.create({ data: { tenantId, productId: existing.id, stockQuantity: v.stockQuantity, ...data } });
          continue;
        }
        await tx.productVariant.update({ where: { id: current.id }, data });
        const delta = v.stockQuantity - (v.stockBefore ?? current.stockQuantity);
        if (delta !== 0) {
          const after = await tx.$queryRaw<{ stock: number }[]>`
            UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + ${delta}, "updatedAt" = now()
            WHERE id = ${current.id} AND "stockQuantity" + ${delta} >= 0 RETURNING "stockQuantity" AS stock`;
          if (after.length === 0) throw new ValidationError(`Stock for ${v.title} changed while you were editing. Reload the page and try again.`);
          await tx.stockAdjustment.create({
            data: { tenantId, variantId: current.id, productTitle: p.title, variantTitle: v.title, delta, quantityAfter: after[0]!.stock, reason: "CORRECTION", note: "Edited on the product page", actorId: actor.userId, actorName: actor.name ?? actor.email },
          });
        }
      }
    }

    // Photos are replaced as a set, in the order given. The first is the cover. A photo that is no longer used by any product
    // is reported back, so the caller can delete the file and give the storage back.
    const before = (await tx.productImage.findMany({ where: { productId: id! }, select: { url: true } })).map((i) => i.url);
    await tx.productImage.deleteMany({ where: { productId: id! } });
    for (const [i, img] of p.images.entries()) {
      await tx.productImage.create({ data: { tenantId, productId: id!, url: img.url, altText: img.alt || null, sortOrder: i } });
    }

    const kept = new Set(p.images.map((i) => i.url));
    const dropped = before.filter((u) => !kept.has(u));
    const stillUsed = dropped.length ? new Set((await tx.productImage.findMany({ where: { url: { in: dropped } }, select: { url: true } })).map((i) => i.url)) : new Set<string>();
    const removedImages = [...new Set(dropped)].filter((u) => !stillUsed.has(u));

    await audit(tx, tenantId, actor, existing ? "product.updated" : "product.created", { productId: id, title: p.title, status: p.status });
    return { id: id!, slug, removedImages };
  }).catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("That SKU or URL name is already used by another product");
    throw e;
  });
  // Stock may have gone up: tell shoppers who were waiting. A failed message never undoes the save.
  await afterRestock(tenantId);
  return saved;
}

export async function getProductForEdit(tenantId: string, actor: StaffActor, productId: string) {
  assertCan(actor, "products", "view");
  return withTenant(tenantId, async (tx) => {
    const p = await tx.product.findFirst({
      relationLoadStrategy: "join",
      where: { id: productId, deletedAt: null },
      include: { images: { orderBy: { sortOrder: "asc" } }, variants: { orderBy: { createdAt: "asc" } } },
    });
    if (!p) throw new NotFoundError("Product");
    return {
      id: p.id, title: p.title, titleBn: p.titleBn, slug: p.slug, descriptionHtml: p.descriptionHtml, shortExcerpt: p.shortExcerpt, status: p.status as "DRAFT" | "ACTIVE" | "ARCHIVED",
      basePrice: Number(p.basePrice), compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null, costPrice: p.costPrice != null ? Number(p.costPrice) : null,
      categoryId: p.categoryId, tags: p.tags, seoTitle: p.seoTitle, seoDescription: p.seoDescription, isFeatured: p.isFeatured,
      images: p.images.map((i) => ({ url: i.url, alt: i.altText })),
      variants: p.variants.map((v) => ({
        id: v.id, title: v.title, sku: v.sku, price: Number(v.price), compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
        stockQuantity: v.stockQuantity, reorderLevel: v.reorderLevel, shelfCode: v.shelfCode, options: (v.options ?? {}) as Record<string, string>,
      })),
    };
  });
}

export async function setProductStatus(tenantId: string, actor: StaffActor, productId: string, status: "ACTIVE" | "DRAFT"): Promise<void> {
  assertCan(actor, "products", "edit");
  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.product.updateMany({ where: { id: productId, deletedAt: null }, data: { status } });
    if (count === 0) throw new NotFoundError("Product");
    await audit(tx, tenantId, actor, "product.status_changed", { productId, status });
  });
}

export interface CategoryAdminRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  products: number;
}

/** Every category, newest structure first: top-level ones in their chosen order, each followed by its sub-categories. */
export async function listCategoriesAdmin(tenantId: string, actor: StaffActor): Promise<CategoryAdminRow[]> {
  assertCan(actor, "products", "view");
  return withTenant(tenantId, async (tx) => {
    const cats = await tx.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
    const row = (c: (typeof cats)[number]): CategoryAdminRow => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, parentId: c.parentId, sortOrder: c.sortOrder, isActive: c.isActive, products: c._count.products });
    const top = cats.filter((c) => !c.parentId);
    const ids = new Set(cats.map((c) => c.id));
    const out: CategoryAdminRow[] = [];
    for (const t of top) { out.push(row(t)); for (const k of cats.filter((c) => c.parentId === t.id)) out.push(row(k)); }
    // A sub-category whose parent is gone cannot be reached from a parent; keep it visible rather than lose it.
    for (const c of cats) if (c.parentId && !ids.has(c.parentId)) out.push(row(c));
    return out;
  });
}

export interface CategoryInput {
  name: string;
  description?: string | null;
  /** A cover picture, from the upload route. */
  imageUrl?: string | null;
  /** The top-level category this one sits under. Only one level is allowed. */
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function saveCategory(tenantId: string, actor: StaffActor, input: CategoryInput, categoryId?: string): Promise<{ id: string }> {
  assertCan(actor, "products", "edit");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) throw new ValidationError("Enter a category name", { field: "name" });
  const description = input.description === undefined ? undefined : input.description?.trim().slice(0, 500) || null;
  if (input.imageUrl && !/^\/media\/[A-Za-z0-9_-]+\/[0-9a-f-]{36}\.webp$/.test(input.imageUrl)) throw new ValidationError("Upload the picture from this page");
  const sortOrder = input.sortOrder === undefined ? undefined : Math.min(Math.max(Math.round(input.sortOrder), 0), 9999);
  return withTenant(tenantId, async (tx) => {
    // One level of sub-categories: the parent must exist, must be top-level itself, and a category that has children cannot become one.
    let parentId: string | null | undefined = input.parentId === undefined ? undefined : input.parentId || null;
    if (parentId) {
      if (parentId === categoryId) throw new ValidationError("A category cannot be inside itself", { field: "parentId" });
      const parent = await tx.category.findFirst({ where: { id: parentId } });
      if (!parent) throw new ValidationError("Choose a parent category from the list", { field: "parentId" });
      if (parent.parentId) throw new ValidationError("Sub-categories can only go one level deep. Choose a top-level category.", { field: "parentId" });
      if (categoryId && (await tx.category.count({ where: { parentId: categoryId } })) > 0) throw new ValidationError("This category has sub-categories of its own, so it cannot go inside another one.", { field: "parentId" });
    }
    const data = {
      name, ...(description !== undefined ? { description } : {}), ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
      ...(parentId !== undefined ? { parentId } : {}), ...(sortOrder !== undefined ? { sortOrder } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
    if (categoryId) {
      const { count } = await tx.category.updateMany({ where: { id: categoryId }, data });
      if (count === 0) throw new NotFoundError("Category");
      await audit(tx, tenantId, actor, "category.saved", { categoryId });
      return { id: categoryId };
    }
    const slug = slugify(name);
    if (await tx.category.findFirst({ where: { slug } })) throw new ValidationError("You already have a category with that name", { field: "name" });
    const made = await tx.category.create({ data: { tenantId, slug, ...data } });
    await audit(tx, tenantId, actor, "category.saved", { categoryId: made.id });
    return { id: made.id };
  });
}

/** Products in a deleted category are kept and become uncategorised. */
export async function deleteCategory(tenantId: string, actor: StaffActor, categoryId: string): Promise<void> {
  assertCan(actor, "products", "edit");
  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.category.deleteMany({ where: { id: categoryId } });
    if (count === 0) throw new NotFoundError("Category");
    await audit(tx, tenantId, actor, "category.deleted", { categoryId });
  });
}

/** Publish, unpublish or archive many products at once. Ones that are already archived or missing are skipped. Returns how many changed. */
export async function bulkProductAction(tenantId: string, actor: StaffActor, ids: string[], action: "publish" | "unpublish" | "archive"): Promise<{ done: number; skipped: number }> {
  assertCan(actor, "products", "edit");
  const unique = [...new Set(ids)].slice(0, 200);
  if (action === "archive") {
    let done = 0;
    for (const id of unique) {
      const before = await withTenant(tenantId, (tx) => tx.product.findFirst({ where: { id, deletedAt: null }, select: { id: true } }));
      if (!before) continue;
      await archiveProduct(tenantId, id, actor);
      done++;
    }
    return { done, skipped: unique.length - done };
  }
  const status = action === "publish" ? "ACTIVE" : "DRAFT";
  return withTenant(tenantId, async (tx) => {
    const { count } = await tx.product.updateMany({ where: { id: { in: unique }, deletedAt: null, status: { not: status } }, data: { status } });
    await audit(tx, tenantId, actor, "product.bulk_status", { status, count, ids: unique });
    return { done: count, skipped: unique.length - count };
  });
}

import { parseCatalogCsv, type DetectedPlatform } from "../catalog/import-parser";

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_TEMPLATE = "title,price,stock,sku,status,category,description,compare_at_price\nCotton Panjabi,1850,12,PJ-001,active,Panjabi,Soft cotton for Eid,2200\n";

export interface ProductImportResult {
  platform: DetectedPlatform;
  created: number;
  totalVariants: number;
  failed: { line: number; title: string; reason: string }[];
  /** True when the plan's product limit stopped the import part way. */
  stoppedByPlan: boolean;
}

/**
 * Creates products from a CSV file. Automatically detects Shopify, WooCommerce, BizTrackBD,
 * or generic spreadsheets. Supports multi-variant options (Size/Color) and external product image URLs.
 */
export async function importProductsCsv(tenantId: string, actor: StaffActor, text: string): Promise<ProductImportResult> {
  await assertNotInDemo(tenantId, "Importing products");
  assertCan(actor, "products", "edit");

  const parsed = parseCatalogCsv(text);
  if (parsed.products.length === 0) {
    const msg = parsed.errors[0]?.message ?? "The file has no valid products. Use the template or an export from Shopify/WooCommerce.";
    throw new ValidationError(msg);
  }

  if (parsed.products.length > IMPORT_MAX_ROWS) {
    throw new ValidationError(`Import up to ${IMPORT_MAX_ROWS} products at a time. This file has ${parsed.products.length}.`);
  }

  const out: ProductImportResult = {
    platform: parsed.platform,
    created: 0,
    totalVariants: 0,
    failed: [...parsed.errors.map((e) => ({ line: e.line, title: "", reason: e.message }))],
    stoppedByPlan: false,
  };

  for (let n = 0; n < parsed.products.length; n++) {
    const p = parsed.products[n]!;
    const line = n + 2;

    try {
      const validImages = p.imageUrls
        .filter((u) => u.startsWith("https://") || u.startsWith("/media/"))
        .slice(0, 10)
        .map((url) => ({ url, alt: p.title }));

      const variantsPayload = p.variants.map((v) => ({
        title: v.title || "Default",
        sku: v.sku || null,
        price: v.price > 0 ? v.price : p.basePrice,
        compareAtPrice: v.compareAtPrice && v.compareAtPrice > (v.price || p.basePrice) ? v.compareAtPrice : null,
        stockQuantity: Math.max(0, v.stockQuantity),
        options: v.options || {},
      }));

      await saveProduct(tenantId, actor, {
        title: p.title,
        basePrice: p.basePrice,
        compareAtPrice: p.compareAtPrice && p.compareAtPrice > p.basePrice ? p.compareAtPrice : null,
        status: p.status,
        descriptionHtml: p.descriptionHtml || "",
        tags: p.tags.slice(0, 20),
        images: validImages,
        ...(p.categoryName ? { newCategoryName: p.categoryName.slice(0, 60) } : {}),
        variants: variantsPayload,
      });

      out.created++;
      out.totalVariants += variantsPayload.length;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "PLAN_LIMIT") {
        out.stoppedByPlan = true;
        out.failed.push({ line, title: p.title, reason: (e as Error).message });
        break;
      }
      if (e instanceof ValidationError || e instanceof NotFoundError) {
        out.failed.push({ line, title: p.title, reason: e.message });
      } else {
        throw e;
      }
    }
  }

  return out;
}
