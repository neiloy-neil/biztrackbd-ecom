import { Prisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { landingKey } from "../builder/versions";
import { defaultLandingPage, validatePage, type PageJson } from "../builder/registry";
import { NotFoundError, PlanLimitError, ValidationError } from "../errors";
import { createOrder } from "../orders/service";
import { assertCan, type StaffActor } from "../permissions";
import { getProductBySlug, type ProductDetail } from "../storefront/catalog";

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
}

export const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export async function listLandingPages(tenantId: string, actor: StaffActor): Promise<LandingRow[]> {
  assertCan(actor, "design", "view");
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.landingPage.findMany({ orderBy: { createdAt: "desc" } });
    const products = await tx.product.findMany({ where: { id: { in: rows.map((r) => r.targetProductId) } }, select: { id: true, title: true } });
    const name = new Map(products.map((p) => [p.id, p.title]));
    return rows.map((r) => ({ id: r.id, title: r.title, slug: r.slug, productId: r.targetProductId, productTitle: name.get(r.targetProductId) ?? null, isPublished: r.isPublished, pixelId: r.pixelId, updatedAt: r.updatedAt, pageKey: landingKey(r.id) }));
  });
}

export async function createLandingPage(tenantId: string, actor: StaffActor, input: { title: string; slug?: string; productId: string }): Promise<{ id: string; pageKey: string }> {
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
      const row = await tx.landingPage.create({ data: { tenantId, title, slug, targetProductId: product.id, sectionsJson: defaultLandingPage() as object, isPublished: false } });
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

export interface PublicLanding {
  id: string;
  title: string;
  slug: string;
  pixelId: string | null;
  page: PageJson;
  product: ProductDetail;
}

/**
 * The public read. Returns null unless the page is live, has a published layout and its product is on sale.
 * With `preview`, the draft is shown instead and a page that is not live yet still renders.
 */
export async function getPublicLanding(tenantId: string, slug: string, preview?: { page: PageJson }): Promise<PublicLanding | null> {
  const row = await withTenant(tenantId, async (tx) => {
    const l = await tx.landingPage.findFirst({ where: { slug } });
    if (!l) return null;
    const product = await tx.product.findFirst({ where: { id: l.targetProductId, status: "ACTIVE", deletedAt: null }, select: { slug: true } });
    const live = await tx.themeVersion.findFirst({ where: { pageKey: landingKey(l.id), state: "PUBLISHED" }, orderBy: { version: "desc" }, select: { sectionsJson: true } });
    return { l, productSlug: product?.slug ?? null, liveJson: live?.sectionsJson ?? null };
  });
  if (!row?.productSlug) return null;
  if (!preview && (!row.l.isPublished || !row.liveJson)) return null;
  const product = await getProductBySlug(tenantId, row.productSlug);
  if (!product) return null;
  const page = preview?.page ?? validatePage("landing", row.liveJson);
  return { id: row.l.id, title: row.l.title, slug: row.l.slug, pixelId: row.l.pixelId, page, product };
}

export interface LandingOrderInput {
  /** A keyed hash of the buyer's address (hashClient). Never a raw address. */
  clientHash?: string;
  idempotencyKey: string;
  variantId: string;
  quantity: number;
  name: string;
  phone: string;
  address: string;
  district: string;
  division: string;
  city?: string;
  utmSource?: string;
  utmCampaign?: string;
}

/** Places the cash on delivery order a landing page collects. The price and stock are read from the product, never the page. */
export async function placeLandingOrder(tenantId: string, slug: string, input: LandingOrderInput) {
  const landing = await getPublicLanding(tenantId, slug);
  if (!landing) throw new NotFoundError("Page");
  // The variant must belong to this page's product: a form for one product cannot be bent into ordering another.
  if (!landing.product.variants.some((v) => v.id === input.variantId)) throw new ValidationError("Pick one of the options shown", { field: "variantId" });
  return createOrder(tenantId, {
    idempotencyKey: input.idempotencyKey,
    customer: { name: input.name, phone: input.phone },
    shipping: { address: input.address, city: input.city?.trim() || input.district, district: input.district, division: input.division },
    items: [{ variantId: input.variantId, quantity: input.quantity }],
    paymentMethod: "COD",
    channel: "LANDING_PAGE",
    clientHash: input.clientHash,
    utmSource: input.utmSource ?? `landing:${slug}`.slice(0, 100),
    utmCampaign: input.utmCampaign,
  });
}
