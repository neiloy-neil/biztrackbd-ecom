import { Prisma, withTenant } from "@biztrackbd/db";
import { z } from "zod";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { claimProductSlot, readUsage, releaseProductSlot, type UsageSummary } from "../limits/plan";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateProductInput = z.object({
  title: z.string().trim().min(2).max(200),
  titleBn: z.string().trim().max(200).optional(),
  slug: z.string().trim().min(2).max(120).regex(SLUG, "Use lowercase letters, numbers and dashes"),
  descriptionHtml: z.string().max(50_000).default(""),
  basePrice: z.number().positive().max(10_000_000),
  categoryId: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
  variants: z
    .array(z.object({
      title: z.string().trim().min(1).max(80),
      price: z.number().positive().max(10_000_000).optional(),
      sku: z.string().trim().max(80).optional(),
      stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
    }))
    .min(1)
    .max(100)
    .default([{ title: "Default", stockQuantity: 0 }]),
});
export type CreateProductInput = z.input<typeof CreateProductInput>;

/** Creates a product, enforcing the plan's hard product limit atomically. A failed insert gives the slot back. */
export async function createProduct(tenantId: string, rawInput: unknown, actor?: StaffActor): Promise<{ id: string; usage: UsageSummary }> {
  if (actor) assertCan(actor, "products", "edit");
  const parsed = CreateProductInput.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid product", { issues: parsed.error.issues });
  const input = parsed.data;

  try {
    return await withTenant(tenantId, async (tx) => {
      await claimProductSlot(tx, tenantId);
      const product = await tx.product.create({
        data: {
          tenantId, title: input.title, titleBn: input.titleBn, slug: input.slug, descriptionHtml: input.descriptionHtml,
          basePrice: input.basePrice, categoryId: input.categoryId, status: input.status,
          variants: {
            create: input.variants.map((v) => ({
              tenantId, title: v.title, sku: v.sku, price: v.price ?? input.basePrice, stockQuantity: v.stockQuantity, options: {},
            })),
          },
        },
      });
      if (actor) await audit(tx, tenantId, actor, "product.created", { productId: product.id, title: input.title });
      return { id: product.id, usage: await readUsage(tx) };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ValidationError("A product with that URL name already exists", { field: "slug" });
    }
    throw e;
  }
}

/** Soft delete. Frees the slot. */
export async function archiveProduct(tenantId: string, productId: string, actor?: StaffActor): Promise<void> {
  if (actor) assertCan(actor, "products", "edit");
  await withTenant(tenantId, async (tx) => {
    // Only the call that actually flips deletedAt releases the slot, so a double click cannot release twice.
    const { count } = await tx.product.updateMany({ where: { id: productId, deletedAt: null }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
    if (count === 0) {
      const exists = await tx.product.findFirst({ where: { id: productId } });
      if (!exists) throw new NotFoundError("Product");
      return;
    }
    await releaseProductSlot(tx, tenantId);
    if (actor) await audit(tx, tenantId, actor, "product.archived", { productId });
  });
}

/** Restoring takes a slot again, so it is blocked at the limit like any new product. */
export async function restoreProduct(tenantId: string, productId: string, actor?: StaffActor): Promise<void> {
  if (actor) assertCan(actor, "products", "edit");
  await withTenant(tenantId, async (tx) => {
    const p = await tx.product.findFirst({ where: { id: productId, deletedAt: { not: null } } });
    if (!p) throw new NotFoundError("Product");
    await claimProductSlot(tx, tenantId);
    await tx.product.update({ where: { id: productId }, data: { deletedAt: null, status: "DRAFT" } });
    if (actor) await audit(tx, tenantId, actor, "product.restored", { productId });
  });
}

export async function getUsage(tenantId: string): Promise<UsageSummary> {
  return withTenant(tenantId, (tx) => readUsage(tx));
}
