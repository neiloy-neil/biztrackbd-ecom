import { withTenant } from "@biztrackbd/db";
import { themeDefinition, validateThemeId, type ThemeId } from "../builder/theme";

/**
 * Read models for the storefront. Plain, serialisable objects (numbers, not Decimals) so they can cross the
 * server/client boundary. Everything runs inside withTenant, so a store only ever sees its own catalog.
 */

export interface StoreInfo {
  storeName: string;
  tagline: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  addressLine: string | null;
  logoUrl: string | null;
  announcement: string | null;
  announcementBn: string | null;
  bkashNumber: string | null;
  bkashKind: string;
  nagadNumber: string | null;
  nagadKind: string;
  paymentNote: string | null;
  offlineMessage: string | null;
  /** The owner has paused orders: customers can look around but cannot place one. */
  ordersPaused: boolean;
}

export async function getStoreInfo(tenantId: string): Promise<StoreInfo> {
  return withTenant(tenantId, async (tx) => {
    const s = await tx.storeSettings.findFirst();
    if (s) return s;
    // A store that has not filled in its details yet still renders, under its subdomain.
    const t = await tx.tenant.findFirstOrThrow({ select: { name: true } });
    return {
      storeName: t.name, tagline: null, contactPhone: null, whatsappNumber: null, facebookUrl: null, instagramUrl: null, addressLine: null,
      logoUrl: null, announcement: null, announcementBn: null, bkashNumber: null, bkashKind: "PERSONAL", nagadNumber: null, nagadKind: "PERSONAL",
      paymentNote: null, offlineMessage: null, ordersPaused: false,
    };
  });
}

/** Theme text and options. Stored per store in ThemeInstall.settings (docs/06); these defaults fill any gaps. */
export interface KaporSettings {
  heroEyebrow: string;
  heroEyebrowBn: string;
  heroTitle: string;
  heroTitleBn: string;
  heroText: string;
  heroTextBn: string;
  heroCta: string;
  heroCtaBn: string;
  newArrivalsTitle: string;
  newArrivalsTitleBn: string;
  freeDeliveryOver: number | null;
}

export interface StorefrontSettings extends KaporSettings {
  themeId: ThemeId;
}

export const KAPOR_DEFAULTS: KaporSettings = {
  heroEyebrow: "NEW COLLECTION",
  heroEyebrowBn: "নতুন কালেকশন",
  heroTitle: "Made well. Delivered across Bangladesh.",
  heroTitleBn: "যত্নে তৈরি। সারা বাংলাদেশে পৌঁছে দিই।",
  heroText: "Shop our latest pieces and pay the way you like.",
  heroTextBn: "নতুন পণ্য দেখুন, পছন্দের উপায়ে দাম দিন।",
  heroCta: "Shop the collection",
  heroCtaBn: "কালেকশন দেখুন",
  newArrivalsTitle: "New arrivals",
  newArrivalsTitleBn: "নতুন পণ্য",
  freeDeliveryOver: null,
};

const THEME_COPY: Record<ThemeId, Partial<KaporSettings>> = {
  kapor: {},
  gadgetstudio: {
    heroEyebrow: "SMARTER TECH, EVERY DAY", heroEyebrowBn: "প্রতিদিনের স্মার্ট প্রযুক্তি",
    heroTitle: "Useful technology. Clearly chosen.", heroTitleBn: "কাজের প্রযুক্তি। বুঝে বেছে নিন।",
    heroText: "Explore dependable devices, accessories and everyday upgrades.", heroTextBn: "নির্ভরযোগ্য ডিভাইস, অ্যাক্সেসরিজ ও দৈনন্দিন আপগ্রেড দেখুন।",
    heroCta: "Shop latest tech", heroCtaBn: "নতুন প্রযুক্তি দেখুন", newArrivalsTitle: "Just landed", newArrivalsTitleBn: "নতুন এসেছে",
  },
  "mini-bunny": {
    heroEyebrow: "LITTLE THINGS, BIG JOY", heroEyebrowBn: "ছোট্ট জিনিসে বড় আনন্দ",
    heroTitle: "Made for their happiest days.", heroTitleBn: "ওদের আনন্দের দিনের জন্য।",
    heroText: "Comfortable picks for babies, children and thoughtful gifts.", heroTextBn: "শিশু, বাচ্চা ও সুন্দর উপহারের আরামদায়ক পছন্দ।",
    heroCta: "Find something lovely", heroCtaBn: "পছন্দেরটি খুঁজুন", newArrivalsTitle: "New for little ones", newArrivalsTitleBn: "সোনামণিদের জন্য নতুন",
  },
  axionwear: {
    heroEyebrow: "THE NEXT DROP", heroEyebrowBn: "পরবর্তী ড্রপ",
    heroTitle: "Built to move. Made to stand out.", heroTitleBn: "চলার জন্য তৈরি। আলাদা হয়ে ওঠার জন্য।",
    heroText: "Performance essentials and limited streetwear, delivered nationwide.", heroTextBn: "পারফরম্যান্স পোশাক ও সীমিত স্ট্রিটওয়্যার, সারা দেশে ডেলিভারি।",
    heroCta: "Enter the drop", heroCtaBn: "ড্রপ দেখুন", newArrivalsTitle: "Latest release", newArrivalsTitleBn: "সর্বশেষ রিলিজ",
  },
  berber: {
    heroEyebrow: "NEW COLLECTION", heroEyebrowBn: "নতুন কালেকশন",
    heroTitle: "Wear your story.", heroTitleBn: "পরুন আপনার গল্প।",
    heroText: "Modern formalwear for the unapologetic individual.", heroTextBn: "আত্মবিশ্বাসী মানুষের জন্য আধুনিক ফরমালওয়্যার।",
    heroCta: "Shop now", heroCtaBn: "এখনই কিনুন", newArrivalsTitle: "New arrivals", newArrivalsTitleBn: "নতুন পণ্য",
  },
  bindu: {
    heroEyebrow: "A RITUAL OF YOUR OWN", heroEyebrowBn: "আপনার নিজের যত্ন",
    heroTitle: "Everyday beauty, thoughtfully selected.", heroTitleBn: "প্রতিদিনের সৌন্দর্য, যত্নে বাছাই করা।",
    heroText: "Considered essentials for beauty, wellbeing and a calmer routine.", heroTextBn: "সৌন্দর্য, সুস্থতা ও শান্ত দিনের জন্য বাছাই করা প্রয়োজনীয় জিনিস।",
    heroCta: "Explore the collection", heroCtaBn: "কালেকশন দেখুন", newArrivalsTitle: "The latest edit", newArrivalsTitleBn: "নতুন বাছাই",
  },
};

export async function getKaporSettings(tenantId: string): Promise<KaporSettings> {
  return getStorefrontSettings(tenantId);
}

export async function getStorefrontSettings(tenantId: string): Promise<StorefrontSettings> {
  return withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findFirstOrThrow({ select: { themeId: true } });
    let themeId: ThemeId;
    try { themeId = validateThemeId(tenant.themeId); } catch { themeId = "kapor"; }
    const install = await tx.themeInstall.findFirst({ where: { themeId } });
    const saved = (install?.settings && typeof install.settings === "object" ? install.settings : {}) as Partial<KaporSettings>;
    // Free delivery threshold comes from the shipping zones, the single source of the rule.
    const zones = await tx.shippingZone.findMany({ where: { freeOverAmount: { not: null } }, orderBy: { freeOverAmount: "asc" }, take: 1 });
    return { ...KAPOR_DEFAULTS, ...THEME_COPY[themeDefinition(themeId).id], ...saved, themeId, freeDeliveryOver: zones[0]?.freeOverAmount != null ? Number(zones[0].freeOverAmount) : null };
  });
}

export interface CategoryCard {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export async function listCategories(tenantId: string): Promise<CategoryCard[]> {
  return withTenant(tenantId, (tx) =>
    tx.category.findMany({ where: { isActive: true, parentId: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, imageUrl: true } }),
  );
}

export interface ProductCard {
  id: string;
  slug: string;
  title: string;
  titleBn: string | null;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  categoryName: string | null;
  inStock: boolean;
  isFeatured: boolean;
}

export type ProductSort = "newest" | "price_asc" | "price_desc";

export interface ListProductsOptions {
  categorySlug?: string;
  query?: string;
  sort?: ProductSort;
  featuredOnly?: boolean;
  /** Products with a compare-at price, which is what the storefront shows as a sale. */
  onSale?: boolean;
  limit?: number;
  page?: number;
}

const ORDER: Record<ProductSort, object> = {
  newest: { createdAt: "desc" },
  price_asc: { basePrice: "asc" },
  price_desc: { basePrice: "desc" },
};

export async function listProducts(tenantId: string, opts: ListProductsOptions = {}): Promise<{ items: ProductCard[]; total: number; page: number; pageSize: number }> {
  const pageSize = Math.min(Math.max(opts.limit ?? 24, 1), 60);
  const page = Math.max(opts.page ?? 1, 1);
  // Prisma passes "contains" to LIKE as is, so % and _ typed by a shopper would act as wildcards. Escape them.
  const q = opts.query?.trim().slice(0, 80);
  const like = q?.replace(/[%_\\]/g, (c) => "\\" + c);
  return withTenant(tenantId, async (tx) => {
    const where = {
      status: "ACTIVE" as const,
      deletedAt: null,
      // A top-level category also shows the products of its sub-categories.
      ...(opts.categorySlug ? { AND: [{ OR: [{ category: { slug: opts.categorySlug } }, { category: { parent: { slug: opts.categorySlug } } }] }] } : {}),
      ...(opts.featuredOnly ? { isFeatured: true } : {}),
      ...(opts.onSale ? { compareAtPrice: { not: null } } : {}),
      ...(q ? { OR: [{ title: { contains: like, mode: "insensitive" as const } }, { titleBn: { contains: like } }, { tags: { has: q.toLowerCase() } }] } : {}),
    };
    const rows = await tx.product.findMany({
      relationLoadStrategy: "join",
      where, orderBy: ORDER[opts.sort ?? "newest"], skip: (page - 1) * pageSize, take: pageSize,
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, category: { select: { name: true } }, variants: { select: { stockQuantity: true } } },
    });
    const total = await tx.product.count({ where });
    return {
      total, page, pageSize,
      items: rows.map((p) => ({
        id: p.id, slug: p.slug, title: p.title, titleBn: p.titleBn, price: Number(p.basePrice),
        compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
        imageUrl: p.images[0]?.url ?? null, imageAlt: p.images[0]?.altText ?? null, categoryName: p.category?.name ?? null,
        inStock: p.variants.some((v) => v.stockQuantity > 0), isFeatured: p.isFeatured,
      })),
    };
  });
}

export interface ProductDetail extends ProductCard {
  descriptionHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  shortExcerpt: string | null;
  images: { url: string; alt: string | null }[];
  variants: { id: string; title: string; price: number; compareAtPrice: number | null; stock: number; options: Record<string, string> }[];
  rating: { average: number; count: number } | null;
  related: ProductCard[];
}

export async function getProductBySlug(tenantId: string, slug: string): Promise<ProductDetail | null> {
  const cardOf = (p: { id: string; slug: string; title: string; titleBn: string | null; basePrice: unknown; compareAtPrice: unknown; isFeatured: boolean; images: { url: string; altText: string | null }[]; category: { name: string } | null; variants: { stockQuantity: number }[] }): ProductCard => ({
    id: p.id, slug: p.slug, title: p.title, titleBn: p.titleBn, price: Number(p.basePrice), compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
    imageUrl: p.images[0]?.url ?? null, imageAlt: p.images[0]?.altText ?? null, categoryName: p.category?.name ?? null, inStock: p.variants.some((v) => v.stockQuantity > 0), isFeatured: p.isFeatured,
  });
  return withTenant(tenantId, async (tx) => {
    const p = await tx.product.findFirst({
      relationLoadStrategy: "join",
      where: { slug, status: "ACTIVE", deletedAt: null },
      include: { images: { orderBy: { sortOrder: "asc" } }, category: { select: { name: true } }, variants: { orderBy: { createdAt: "asc" } } },
    });
    if (!p) return null;
    const cardInclude = { images: { orderBy: { sortOrder: "asc" as const }, take: 1 }, category: { select: { name: true } }, variants: { select: { stockQuantity: true } } };
    const base = { status: "ACTIVE" as const, deletedAt: null, id: { not: p.id } };
    const agg = await tx.review.aggregate({ where: { productId: p.id, isPublished: true }, _avg: { rating: true }, _count: true });
    // "Goes well with": other categories first (a shirt with trousers), then more of the same category if the store is small.
    const other = p.categoryId ? await tx.product.findMany({ relationLoadStrategy: "join", where: { ...base, categoryId: { not: p.categoryId } }, take: 4, orderBy: { createdAt: "desc" }, include: cardInclude }) : [];
    const same = other.length < 4
      ? await tx.product.findMany({ relationLoadStrategy: "join", where: { ...base, ...(p.categoryId ? { categoryId: p.categoryId } : {}), id: { notIn: [p.id, ...other.map((o) => o.id)] } }, take: 4 - other.length, orderBy: { createdAt: "desc" }, include: cardInclude })
      : [];
    const relatedRows = [...other, ...same];
    return {
      ...cardOf(p),
      descriptionHtml: p.descriptionHtml, seoTitle: p.seoTitle, seoDescription: p.seoDescription, shortExcerpt: p.shortExcerpt,
      images: p.images.map((i) => ({ url: i.url, alt: i.altText })),
      variants: p.variants.map((v) => ({
        id: v.id, title: v.title, price: Number(v.price), compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
        stock: v.stockQuantity, options: (v.options && typeof v.options === "object" ? v.options : {}) as Record<string, string>,
      })),
      rating: agg._count > 0 ? { average: Math.round((agg._avg.rating ?? 0) * 10) / 10, count: agg._count } : null,
      related: relatedRows.map(cardOf),
    };
  });
}

export async function listProductSlugs(tenantId: string): Promise<{ slug: string; updatedAt: Date }[]> {
  return withTenant(tenantId, (tx) => tx.product.findMany({ where: { status: "ACTIVE", deletedAt: null }, select: { slug: true, updatedAt: true } }));
}

export async function listCategorySlugs(tenantId: string): Promise<{ slug: string }[]> {
  return withTenant(tenantId, (tx) => tx.category.findMany({ where: { isActive: true }, select: { slug: true } }));
}
