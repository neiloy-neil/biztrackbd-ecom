import { assertNotDemo } from "../demo/guard";
import { Prisma, withTenant } from "@biztrackbd/db";
import { z } from "zod";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";

/**
 * Customer reviews (docs/07 section 10). Only someone who has received the product can review it, once. A review waits for
 * the owner unless the store has switched on auto-publish. Text is plain: tags are stripped, never rendered as HTML.
 */

export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  /** First name and the first letter of the second: "Tania A." */
  author: string;
  reply: string | null;
  createdAt: Date;
}

export interface ReviewSummary {
  count: number;
  average: number | null;
  /** Reviews with 1, 2, 3, 4 and 5 stars. */
  histogram: [number, number, number, number, number];
}

export function displayName(full: string): string {
  const [first = "Customer", second] = full.trim().split(/\s+/);
  return second ? `${first} ${second.charAt(0).toUpperCase()}.` : first;
}

/** Strips tags and control characters and squeezes whitespace. Reviews are shown as text, but stored clean too. */
export function cleanText(s: string, max: number): string {
  // eslint-disable-next-line no-control-regex -- control characters are removed on purpose
  return s.replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function getReviewSummary(tenantId: string, productId: string): Promise<ReviewSummary> {
  const rows = await withTenant(tenantId, (tx) => tx.review.groupBy({ by: ["rating"], where: { productId, isPublished: true }, _count: { _all: true } }));
  const h: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const r of rows) if (r.rating >= 1 && r.rating <= 5) h[r.rating - 1] = r._count._all;
  const count = h.reduce((a, b) => a + b, 0);
  return { count, average: count ? Math.round((h.reduce((s, n, i) => s + n * (i + 1), 0) / count) * 10) / 10 : null, histogram: h };
}

export async function listPublicReviews(tenantId: string, productId: string, limit = 20): Promise<PublicReview[]> {
  const rows = await withTenant(tenantId, (tx) => tx.review.findMany({ where: { productId, isPublished: true }, orderBy: { createdAt: "desc" }, take: limit, include: { customer: { select: { name: true } } } }));
  return rows.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, author: displayName(r.customer.name), reply: r.merchantReply, createdAt: r.createdAt }));
}

export interface ReviewableItem {
  productId: string;
  title: string;
  slug: string;
  orderNumber: string;
  alreadyReviewed: boolean;
}

/** What this signed-in customer may review: products from orders that were delivered to them. */
export async function reviewableItems(tenantId: string, customerId: string): Promise<ReviewableItem[]> {
  return withTenant(tenantId, async (tx) => {
    const orders = await tx.order.findMany({ where: { customerId, status: "DELIVERED" }, orderBy: { deliveredAt: "desc" }, take: 20, include: { items: { include: { product: { select: { slug: true } } } } } });
    const reviewed = new Set((await tx.review.findMany({ where: { customerId }, select: { productId: true } })).map((r) => r.productId));
    const seen = new Set<string>();
    const out: ReviewableItem[] = [];
    for (const o of orders) {
      for (const i of o.items) {
        if (seen.has(i.productId)) continue;
        seen.add(i.productId);
        out.push({ productId: i.productId, title: i.productTitle, slug: i.product.slug, orderNumber: o.orderNumber, alreadyReviewed: reviewed.has(i.productId) });
      }
    }
    return out;
  });
}

export const ReviewInput = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1, "Choose 1 to 5 stars").max(5, "Choose 1 to 5 stars"),
  title: z.string().max(120).optional(),
  body: z.string().min(1, "Write a few words about it").max(2000),
});

export async function submitReview(tenantId: string, customerId: string, raw: unknown): Promise<{ published: boolean }> {
  const parsed = ReviewInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check your review");
  const input = parsed.data;
  const body = cleanText(input.body, 1000);
  if (body.length < 5) throw new ValidationError("Write a few words about it");
  const title = input.title ? cleanText(input.title, 100) || null : null;
  try {
    return await withTenant(tenantId, async (tx) => {
      await assertNotDemo(tx);
      const delivered = await tx.order.findFirst({ where: { customerId, status: "DELIVERED", items: { some: { productId: input.productId } } }, select: { id: true } });
      if (!delivered) throw new ValidationError("You can review a product after it has been delivered to you.");
      const settings = await tx.storeSettings.findFirst({ select: { reviewsAutoPublish: true } });
      const published = Boolean(settings?.reviewsAutoPublish);
      await tx.review.create({ data: { tenantId, productId: input.productId, customerId, rating: input.rating, title, body, isVerified: true, isPublished: published, orderId: delivered.id } });
      return { published };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("You have already reviewed this product.");
    throw e;
  }
}

// ---- Owner moderation ----------------------------------------------------------------------------------------------

export type ReviewTab = "pending" | "published" | "hidden" | "all";

export interface AdminReview {
  id: string;
  productId: string;
  productTitle: string;
  customerName: string;
  customerPhone: string;
  rating: number;
  title: string | null;
  body: string;
  isPublished: boolean;
  everDecided: boolean;
  reply: string | null;
  createdAt: Date;
}

export async function listReviews(tenantId: string, actor: StaffActor, tab: ReviewTab = "pending"): Promise<AdminReview[]> {
  assertCan(actor, "marketing", "view");
  const where: Prisma.ReviewWhereInput = tab === "pending" ? { isPublished: false, decidedAt: null } : tab === "published" ? { isPublished: true } : tab === "hidden" ? { isPublished: false, decidedAt: { not: null } } : {};
  const rows = await withTenant(tenantId, (tx) => tx.review.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { product: { select: { title: true } }, customer: { select: { name: true, phone: true } } } }));
  return rows.map((r) => ({
    id: r.id, productId: r.productId, productTitle: r.product.title, customerName: r.customer.name, customerPhone: r.customer.phone, rating: r.rating, title: r.title, body: r.body,
    isPublished: r.isPublished, everDecided: r.decidedAt !== null, reply: r.merchantReply, createdAt: r.createdAt,
  }));
}

export async function reviewTabCounts(tenantId: string, actor: StaffActor): Promise<Record<ReviewTab, number>> {
  assertCan(actor, "marketing", "view");
  return withTenant(tenantId, async (tx) => {
    const [pending, published, hidden, all] = await Promise.all([
      tx.review.count({ where: { isPublished: false, decidedAt: null } }), tx.review.count({ where: { isPublished: true } }),
      tx.review.count({ where: { isPublished: false, decidedAt: { not: null } } }), tx.review.count(),
    ]);
    return { pending, published, hidden, all };
  });
}

export async function setReviewPublished(tenantId: string, actor: StaffActor, id: string, published: boolean): Promise<void> {
  assertCan(actor, "marketing", "edit");
  await withTenant(tenantId, async (tx) => {
    const r = await tx.review.findFirst({ where: { id } });
    if (!r) throw new NotFoundError("Review");
    await tx.review.update({ where: { id }, data: { isPublished: published, decidedAt: new Date() } });
    await audit(tx, tenantId, actor, published ? "review.published" : "review.hidden", { reviewId: id, productId: r.productId });
  });
}

export async function replyToReview(tenantId: string, actor: StaffActor, id: string, text: string): Promise<void> {
  assertCan(actor, "marketing", "edit");
  const reply = cleanText(text, 500);
  await withTenant(tenantId, async (tx) => {
    const r = await tx.review.findFirst({ where: { id } });
    if (!r) throw new NotFoundError("Review");
    await tx.review.update({ where: { id }, data: { merchantReply: reply || null, repliedAt: reply ? new Date() : null } });
    await audit(tx, tenantId, actor, "review.replied", { reviewId: id });
  });
}

export async function setReviewsAutoPublish(tenantId: string, actor: StaffActor, on: boolean): Promise<void> {
  assertCan(actor, "marketing", "edit");
  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.storeSettings.updateMany({ data: { reviewsAutoPublish: on } });
    if (count === 0) throw new NotFoundError("Store settings");
    await audit(tx, tenantId, actor, "review.auto_publish", { on });
  });
}

export async function reviewsAutoPublish(tenantId: string): Promise<boolean> {
  return withTenant(tenantId, async (tx) => Boolean((await tx.storeSettings.findFirst({ select: { reviewsAutoPublish: true } }))?.reviewsAutoPublish));
}
