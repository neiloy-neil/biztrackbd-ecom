import { Prisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { landingKey } from "../builder/versions";
import { defaultLandingPage, validatePage, type PageJson } from "../builder/registry";
import { NotFoundError, PlanLimitError, ValidationError } from "../errors";
import { createOrder } from "../orders/service";
import { assertCan, type StaffActor } from "../permissions";
import { getProductBySlug, type ProductDetail } from "../storefront/catalog";
import { pageFromTemplate } from "./templates";
import { recordLandingOrder } from "./stats";
import { normalizeBdPhone } from "../phone";
import { bumpDiscount, dealDiscount, legacyOffers, parseOffers, type LandingOffers, type OfferOption } from "./offers";
import { randomBytes } from "node:crypto";

/**
 * Landing pages (docs/06 BldLanding): one product, one page, an order form with cash on delivery and no cart or account.
 * The layout is built in the same editor as the home page and published the same way; this file is the page's record,
 * its public read, and the order it takes.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set(["new", "edit", "api", "admin"]);

export interface LandingRow {
  id: string;
  title: string;
  slug: string;
  productId: string;
  productTitle: string | null;
  isPublished: boolean;
  pixelId: string | null;
  updatedAt: Date;
  pageKey: string;
  shortCode: string | null;
  offers: LandingOffers;
}

export const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** The page's offers, or its one product when it was made before offers existed or the saved offers are no longer valid. */
function offersOf(r: { offersJson: unknown; targetProductId: string }): LandingOffers {
  if (r.offersJson == null) return legacyOffers(r.targetProductId);
  try {
    return parseOffers(r.offersJson);
  } catch {
    return legacyOffers(r.targetProductId);
  }
}

const newShortCode = (): string => randomBytes(5).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x").slice(0, 7);

export async function listLandingPages(tenantId: string, actor: StaffActor): Promise<LandingRow[]> {
  assertCan(actor, "design", "view");
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.landingPage.findMany({ orderBy: { createdAt: "desc" } });
    const products = await tx.product.findMany({ where: { id: { in: rows.map((r) => r.targetProductId) } }, select: { id: true, title: true } });
    const name = new Map(products.map((p) => [p.id, p.title]));
    return rows.map((r) => ({ id: r.id, title: r.title, slug: r.slug, productId: r.targetProductId, productTitle: name.get(r.targetProductId) ?? null, isPublished: r.isPublished, pixelId: r.pixelId, updatedAt: r.updatedAt, pageKey: landingKey(r.id), shortCode: r.shortCode, offers: offersOf(r) }));
  });
}

export async function createLandingPage(tenantId: string, actor: StaffActor, input: { title: string; slug?: string; productId: string; templateId?: string }): Promise<{ id: string; pageKey: string }> {
  assertCan(actor, "design", "edit");
  const title = input.title.trim();
  if (title.length < 2 || title.length > 120) throw new ValidationError("Give the page a name of 2 to 120 characters", { field: "title" });
  const slug = (input.slug?.trim() || slugify(title)).toLowerCase();
  if (!SLUG.test(slug) || slug.length > 60 || RESERVED.has(slug)) throw new ValidationError("The address can use small letters, numbers and dashes, like eid-panjabi", { field: "slug" });
  return withTenant(tenantId, async (tx) => {
    const product = await tx.product.findFirst({ where: { id: input.productId, deletedAt: null }, select: { id: true } });
    if (!product) throw new ValidationError("Pick the product this page sells", { field: "productId" });
    const tenant = await tx.tenant.findFirstOrThrow({ select: { planTier: true } });
    const plan = await tx.plan.findUnique({ where: { tier: tenant.planTier } });
    const cap = (plan?.limits as Record<string, unknown> | null)?.landingPages;
    if (typeof cap === "number") {
      const used = await tx.landingPage.count();
      if (used >= cap) throw new PlanLimitError("landing pages", cap, used);
    }
    try {
      // Unpublished until the owner presses Publish in the editor: a half-built page never goes live.
      const row = await tx.landingPage.create({ data: { tenantId, title, slug, targetProductId: product.id, sectionsJson: (pageFromTemplate(input.templateId) ?? defaultLandingPage()) as object, isPublished: false, shortCode: newShortCode() } });
      await audit(tx, tenantId, actor, "landing.created", { slug });
      return { id: row.id, pageKey: landingKey(row.id) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("You already have a page at that address", { field: "slug" });
      throw e;
    }
  });
}

export async function updateLandingPage(tenantId: string, actor: StaffActor, id: string, input: { title?: string; productId?: string; pixelId?: string | null }): Promise<void> {
  assertCan(actor, "design", "edit");
  await withTenant(tenantId, async (tx) => {
    const row = await tx.landingPage.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("Landing page");
    const data: Prisma.LandingPageUpdateInput = {};
    if (input.title !== undefined) {
      const t = input.title.trim();
      if (t.length < 2 || t.length > 120) throw new ValidationError("Give the page a name of 2 to 120 characters", { field: "title" });
      data.title = t;
    }
    if (input.productId !== undefined) {
      if (!(await tx.product.findFirst({ where: { id: input.productId, deletedAt: null }, select: { id: true } }))) throw new ValidationError("Pick the product this page sells", { field: "productId" });
      data.targetProductId = input.productId;
    }
    if (input.pixelId !== undefined) {
      const p = input.pixelId?.trim() || null;
      if (p && !/^\d{8,20}$/.test(p)) throw new ValidationError("A Pixel ID is 8 to 20 digits", { field: "pixelId" });
      data.pixelId = p;
    }
    await tx.landingPage.update({ where: { id }, data });
  });
}

/**
 * Saves what the page sells. Every product and the bump's variant must be this store's own and on sale, so a page can never be pointed at
 * another store's goods. The first option's product becomes the page's main product (its title, picture and address).
 */
export async function updateLandingOffers(tenantId: string, actor: StaffActor, id: string, raw: unknown): Promise<void> {
  assertCan(actor, "design", "edit");
  const offers = parseOffers(raw);
  await withTenant(tenantId, async (tx) => {
    const row = await tx.landingPage.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("Landing page");
    const ids = [...new Set([...offers.options.map((o) => o.productId), ...(offers.bump ? [offers.bump.productId] : [])])];
    const found = await tx.product.findMany({ where: { id: { in: ids }, status: "ACTIVE", deletedAt: null }, select: { id: true } });
    if (found.length !== ids.length) throw new ValidationError("One of the products is not on sale in your store", { field: "offers" });
    if (offers.bump) {
      const v = await tx.productVariant.findFirst({ where: { id: offers.bump.variantId, productId: offers.bump.productId }, select: { id: true } });
      if (!v) throw new ValidationError("The extra item must be one of its product's options", { field: "offers" });
    }
    await tx.landingPage.update({ where: { id }, data: { offersJson: offers as object, targetProductId: offers.options[0]!.productId } });
    await audit(tx, tenantId, actor, "landing.offers", { slug: row.slug, options: offers.options.length, bump: Boolean(offers.bump) });
  });
}

export async function setLandingLive(tenantId: string, actor: StaffActor, id: string, live: boolean): Promise<void> {
  assertCan(actor, "design", "edit");
  await withTenant(tenantId, async (tx) => {
    const row = await tx.landingPage.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("Landing page");
    if (live && !(await tx.themeVersion.findFirst({ where: { pageKey: landingKey(id), state: "PUBLISHED" }, select: { id: true } }))) throw new ValidationError("Publish the page from the editor first");
    await tx.landingPage.update({ where: { id }, data: { isPublished: live } });
    await audit(tx, tenantId, actor, live ? "landing.live" : "landing.unpublished", { slug: row.slug });
  });
}

export async function deleteLandingPage(tenantId: string, actor: StaffActor, id: string): Promise<void> {
  assertCan(actor, "design", "edit");
  await withTenant(tenantId, async (tx) => {
    const row = await tx.landingPage.findFirst({ where: { id } });
    if (!row) throw new NotFoundError("Landing page");
    await tx.themeVersion.deleteMany({ where: { pageKey: landingKey(id) } });
    await tx.landingPage.delete({ where: { id } });
    await audit(tx, tenantId, actor, "landing.deleted", { slug: row.slug });
  });
}

export interface PublicOption {
  id: string;
  label: string;
  labelBn: string | null;
  productId: string;
  productTitle: string;
  imageUrl: string | null;
  /** Fixed pieces for a bundle; null when the customer chooses the quantity. */
  quantity: number | null;
  deal: OfferOption["deal"];
  variants: { id: string; title: string; price: number; compareAt: number | null; stock: number }[];
}
export interface PublicBump {
  label: string;
  labelBn: string | null;
  variantId: string;
  productTitle: string;
  price: number;
  percentOff: number;
  stock: number;
}
export interface PublicLanding {
  id: string;
  title: string;
  slug: string;
  pixelId: string | null;
  page: PageJson;
  product: ProductDetail;
  options: PublicOption[];
  bump: PublicBump | null;
}

/** The slug behind a short address, or null. Only reads the code; whether the page is live is decided when it is opened. */
export async function landingSlugByCode(tenantId: string, code: string): Promise<string | null> {
  if (!/^[a-z0-9]{4,12}$/.test(code)) return null;
  return withTenant(tenantId, async (tx) => (await tx.landingPage.findFirst({ where: { shortCode: code }, select: { slug: true } }))?.slug ?? null);
}

/**
 * The public read. Returns null unless the page is live, has a published layout and its first product is on sale.
 * With `preview`, the draft is shown instead and a page that is not live yet still renders.
 */
export async function getPublicLanding(tenantId: string, slug: string, preview?: { page: PageJson }): Promise<PublicLanding | null> {
  const row = await withTenant(tenantId, async (tx) => {
    const l = await tx.landingPage.findFirst({ where: { slug } });
    if (!l) return null;
    const offers = offersOf(l);
    const wanted = [...new Set([...offers.options.map((o) => o.productId), ...(offers.bump ? [offers.bump.productId] : [])])];
    const products = await tx.product.findMany({
      where: { id: { in: wanted }, status: "ACTIVE", deletedAt: null },
      select: { id: true, slug: true, title: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } }, variants: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, price: true, compareAtPrice: true, stockQuantity: true } } },
    });
    const live = await tx.themeVersion.findFirst({ where: { pageKey: landingKey(l.id), state: "PUBLISHED" }, orderBy: { version: "desc" }, select: { sectionsJson: true } });
    return { l, offers, products, liveJson: live?.sectionsJson ?? null };
  });
  if (!row) return null;
  const byId = new Map(row.products.map((p) => [p.id, p]));
  // An option whose product has gone off sale is left out; with none left the page is not shown.
  const options: PublicOption[] = row.offers.options.flatMap((o) => {
    const p = byId.get(o.productId);
    if (!p) return [];
    return [{
      id: o.id, label: o.label, labelBn: o.labelBn ?? null, productId: p.id, productTitle: p.title, imageUrl: p.images[0]?.url ?? null, quantity: o.quantity ?? null, deal: o.deal,
      variants: p.variants.map((v) => ({ id: v.id, title: v.title, price: Number(v.price), compareAt: v.compareAtPrice != null ? Number(v.compareAtPrice) : null, stock: v.stockQuantity })),
    }];
  });
  const first = options[0] && byId.get(options[0].productId);
  if (!first) return null;
  if (!preview && (!row.l.isPublished || !row.liveJson)) return null;
  const product = await getProductBySlug(tenantId, first.slug);
  if (!product) return null;
  let bump: PublicBump | null = null;
  const b = row.offers.bump;
  if (b) {
    const bp = byId.get(b.productId);
    const bv = bp?.variants.find((v) => v.id === b.variantId);
    if (bp && bv) bump = { label: b.label, labelBn: b.labelBn ?? null, variantId: bv.id, productTitle: bp.title, price: Number(bv.price), percentOff: b.percentOff, stock: bv.stockQuantity };
  }
  const page = preview?.page ?? validatePage("landing", row.liveJson);
  return { id: row.l.id, title: row.l.title, slug: row.l.slug, pixelId: row.l.pixelId, page, product, options, bump };
}

export interface LandingOrderInput {
  /** A keyed hash of the buyer's address (hashClient). Never a raw address. */
  clientHash?: string;
  idempotencyKey: string;
  /** Which option the customer picked; the first one when absent. */
  optionId?: string;
  variantId: string;
  quantity: number;
  /** The customer ticked the order bump. */
  bump?: boolean;
  name: string;
  phone: string;
  address: string;
  district: string;
  division: string;
  city?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  affiliateRef?: string;
}

/** What an order from this page will contain and how much the deals take off, from database prices. */
export function priceLandingChoice(landing: Pick<PublicLanding, "options" | "bump">, input: Pick<LandingOrderInput, "optionId" | "variantId" | "quantity" | "bump">) {
  const option = landing.options.find((o) => o.id === (input.optionId || landing.options[0]!.id));
  if (!option) throw new ValidationError("Pick one of the offers shown", { field: "optionId" });
  // The variant must belong to the chosen option's product: a form for one product cannot be bent into ordering another.
  const variant = option.variants.find((v) => v.id === input.variantId);
  if (!variant) throw new ValidationError("Pick one of the options shown", { field: "variantId" });
  const quantity = option.quantity ?? input.quantity;
  const items: { variantId: string; quantity: number }[] = [{ variantId: variant.id, quantity }];
  let offerDiscount = dealDiscount(option.deal, variant.price * quantity);
  if (input.bump) {
    if (!landing.bump) throw new ValidationError("That extra item is not offered", { field: "bump" });
    items.push({ variantId: landing.bump.variantId, quantity: 1 });
    offerDiscount += bumpDiscount(landing.bump, landing.bump.price);
  }
  return { items, offerDiscount, optionLabel: option.label };
}

/** Places the cash on delivery order a landing page collects. The price, the deal and stock are read from the database, never the page. */
export async function placeLandingOrder(tenantId: string, slug: string, input: LandingOrderInput) {
  const landing = await getPublicLanding(tenantId, slug);
  if (!landing) throw new NotFoundError("Page");
  const { items, offerDiscount } = priceLandingChoice(landing, input);
  const placed = await createOrder(tenantId, {
    idempotencyKey: input.idempotencyKey,
    customer: { name: input.name, phone: input.phone },
    shipping: { address: input.address, city: input.city?.trim() || input.district, district: input.district, division: input.division },
    items,
    offerDiscount,
    paymentMethod: "COD",
    channel: "LANDING_PAGE",
    clientHash: input.clientHash,
    // Ad tools can send long campaign names; the order only keeps 100 characters, and a long tag must never fail a customer's order.
    utmSource: (input.utmSource ?? `landing:${slug}`).slice(0, 100),
    utmCampaign: input.utmCampaign?.slice(0, 100),
    utmMedium: input.utmMedium?.slice(0, 100),
    landingPageId: landing.id,
    affiliateRef: input.affiliateRef,
  });
  // The count is a convenience: a failure here must never lose or fail an order that was placed.
  if (!placed.replayed) {
    try {
      await recordLandingOrder(tenantId, landing.id, normalizeBdPhone(input.phone));
    } catch (e) {
      console.error("landing order count failed", e instanceof Error ? e.name : "unknown");
    }
  }
  return placed;
}

export async function listPublishedLandingSlugs(tenantId: string): Promise<{ slug: string; updatedAt: Date }[]> {
  return withTenant(tenantId, async (tx) => {
    return tx.landingPage.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });
  });
}
