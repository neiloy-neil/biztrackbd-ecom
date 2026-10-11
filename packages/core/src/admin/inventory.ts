import { withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";

export type StockFilter = "all" | "low" | "out";
export const STOCK_REASONS = ["RECOUNT", "RECEIVED", "DAMAGED", "RETURNED", "CORRECTION", "OTHER"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export interface InventoryRow {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  shelf: string | null;
  /** Units reserved by orders that have not shipped yet. They are already taken off the available count. */
  committed: number;
  reorderLevel: number;
  available: number;
  state: "ok" | "low" | "out";
  costPrice: number | null;
}

export interface InventorySummary {
  unitsInStock: number;
  stockValueAtCost: number;
  low: number;
  out: number;
}

const stateOf = (stock: number, reorder: number): InventoryRow["state"] => (stock <= 0 ? "out" : stock <= reorder ? "low" : "ok");

export async function listInventory(
  tenantId: string, actor: StaffActor,
  opts: { filter?: StockFilter; q?: string; shelf?: string; page?: number; pageSize?: number } = {},
): Promise<{ rows: InventoryRow[]; total: number; summary: InventorySummary; shelves: string[]; page: number; pageSize: number }> {
  assertCan(actor, "products", "view");
  const pageSize = Math.min(Math.max(opts.pageSize ?? 40, 1), 200);
  const page = Math.max(opts.page ?? 1, 1);
  const q = opts.q?.trim().slice(0, 60);
  const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const filter = opts.filter ?? "all";
  const shelf = opts.shelf || null;

  return withTenant(tenantId, async (tx) => {
    // One SQL statement for the filtered list so low and out are compared column to column in the database.
    const rows = await tx.$queryRaw<
      { id: string; productId: string; product: string; variant: string; sku: string | null; shelf: string | null; stock: number; reorder: number; cost: number | null; committed: number }[]
    >`
      SELECT v.id, v."productId", p.title AS product, v.title AS variant, v.sku, v."shelfCode" AS shelf, v."stockQuantity" AS stock,
             v."reorderLevel" AS reorder, p."costPrice"::float8 AS cost,
             COALESCE((SELECT sum(oi.quantity) FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
                       WHERE oi."variantId" = v.id AND o.status IN ('PENDING', 'CONFIRMED', 'PROCESSING') AND o."deletedAt" IS NULL), 0)::int AS committed
      FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE p."deletedAt" IS NULL
        AND (${filter} = 'all' OR (${filter} = 'out' AND v."stockQuantity" <= 0) OR (${filter} = 'low' AND v."stockQuantity" > 0 AND v."stockQuantity" <= v."reorderLevel"))
        AND (${like}::text IS NULL OR p.title ILIKE ${like} OR v.sku ILIKE ${like} OR v.title ILIKE ${like})
        AND (${shelf}::text IS NULL OR v."shelfCode" = ${shelf})
      ORDER BY (CASE WHEN v."stockQuantity" <= 0 THEN 0 WHEN v."stockQuantity" <= v."reorderLevel" THEN 1 ELSE 2 END), v."stockQuantity", p.title
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    const [count] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE p."deletedAt" IS NULL
        AND (${filter} = 'all' OR (${filter} = 'out' AND v."stockQuantity" <= 0) OR (${filter} = 'low' AND v."stockQuantity" > 0 AND v."stockQuantity" <= v."reorderLevel"))
        AND (${like}::text IS NULL OR p.title ILIKE ${like} OR v.sku ILIKE ${like} OR v.title ILIKE ${like})
        AND (${shelf}::text IS NULL OR v."shelfCode" = ${shelf})`;
    const [sum] = await tx.$queryRaw<{ units: number; value: number; low: number; out: number }[]>`
      SELECT COALESCE(sum(GREATEST(v."stockQuantity", 0)), 0)::int AS units,
             COALESCE(sum(GREATEST(v."stockQuantity", 0) * COALESCE(p."costPrice", 0)), 0)::float8 AS value,
             count(*) FILTER (WHERE v."stockQuantity" > 0 AND v."stockQuantity" <= v."reorderLevel")::int AS low,
             count(*) FILTER (WHERE v."stockQuantity" <= 0)::int AS out
      FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE p."deletedAt" IS NULL`;
    const shelves = await tx.$queryRaw<{ shelf: string }[]>`
      SELECT DISTINCT v."shelfCode" AS shelf FROM "ProductVariant" v WHERE v."shelfCode" IS NOT NULL ORDER BY 1`;

    return {
      page, pageSize, total: count?.n ?? 0, shelves: shelves.map((s) => s.shelf),
      summary: { unitsInStock: sum?.units ?? 0, stockValueAtCost: Math.round(sum?.value ?? 0), low: sum?.low ?? 0, out: sum?.out ?? 0 },
      rows: rows.map((r) => ({
        variantId: r.id, productId: r.productId, productTitle: r.product, variantTitle: r.variant, sku: r.sku, shelf: r.shelf, committed: r.committed,
        reorderLevel: r.reorder, available: r.stock, state: stateOf(r.stock, r.reorder), costPrice: r.cost,
      })),
    };
  });
}

export interface AdjustInput {
  /** Change by this many units (negative to remove). Use either delta or setTo. */
  delta?: number;
  /** Set the shelf count to exactly this (a stock count). The change is worked out inside the transaction. */
  setTo?: number;
  reason: string;
  note?: string;
}

/**
 * Changes stock by hand and records who did it and why. The change is one conditional UPDATE, so it cannot take stock
 * below zero or lose a sale that was being placed at the same moment.
 */
export async function adjustStock(tenantId: string, actor: StaffActor, variantId: string, input: AdjustInput): Promise<{ quantityAfter: number; delta: number }> {
  assertCan(actor, "products", "edit");
  const reason = STOCK_REASONS.find((r) => r === input.reason);
  if (!reason) throw new ValidationError("Choose a reason for the change");
  const hasDelta = typeof input.delta === "number";
  const hasSet = typeof input.setTo === "number";
  if (hasDelta === hasSet) throw new ValidationError("Enter either a change or a new count");
  if (hasDelta && (!Number.isInteger(input.delta) || Math.abs(input.delta!) > 1_000_000 || input.delta === 0)) throw new ValidationError("Enter a whole number other than zero");
  if (hasSet && (!Number.isInteger(input.setTo) || input.setTo! < 0 || input.setTo! > 1_000_000)) throw new ValidationError("Enter a count of zero or more");

  return withTenant(tenantId, async (tx) => {
    const before = await tx.$queryRaw<{ stock: number; product: string; variant: string }[]>`
      SELECT v."stockQuantity" AS stock, p.title AS product, v.title AS variant
      FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE v.id = ${variantId} FOR UPDATE OF v`;
    const row = before[0];
    if (!row) throw new NotFoundError("Product variant");
    const delta = hasSet ? input.setTo! - row.stock : input.delta!;
    if (delta === 0) return { quantityAfter: row.stock, delta: 0 };
    const updated = await tx.$queryRaw<{ stock: number }[]>`
      UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + ${delta}, "updatedAt" = now()
      WHERE id = ${variantId} AND "stockQuantity" + ${delta} >= 0 RETURNING "stockQuantity" AS stock`;
    if (updated.length === 0) throw new ValidationError(`Only ${row.stock} in stock. You cannot remove ${Math.abs(delta)}.`);
    const quantityAfter = updated[0]!.stock;
    await tx.stockAdjustment.create({
      data: {
        tenantId, variantId, productTitle: row.product, variantTitle: row.variant, delta, quantityAfter, reason, note: input.note?.trim().slice(0, 200) || null,
        actorId: actor.userId, actorName: actor.name ?? actor.email,
      },
    });
    await audit(tx, tenantId, actor, "stock.adjusted", { product: row.product, variant: row.variant, delta, quantityAfter, reason });
    return { quantityAfter, delta };
  });
}

/** Reorder level and shelf label for a variant. */
export async function updateStockSettings(tenantId: string, actor: StaffActor, variantId: string, s: { reorderLevel?: number; shelfCode?: string | null }): Promise<void> {
  assertCan(actor, "products", "edit");
  if (s.reorderLevel !== undefined && (!Number.isInteger(s.reorderLevel) || s.reorderLevel < 0 || s.reorderLevel > 100_000)) throw new ValidationError("Reorder level must be zero or more");
  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.productVariant.updateMany({
      where: { id: variantId },
      data: { ...(s.reorderLevel !== undefined ? { reorderLevel: s.reorderLevel } : {}), ...(s.shelfCode !== undefined ? { shelfCode: s.shelfCode?.trim().slice(0, 20) || null } : {}) },
    });
    if (count === 0) throw new NotFoundError("Product variant");
  });
}

export async function listStockHistory(tenantId: string, actor: StaffActor, variantId: string, limit = 30) {
  assertCan(actor, "products", "view");
  return withTenant(tenantId, (tx) => tx.stockAdjustment.findMany({ where: { variantId }, orderBy: { createdAt: "desc" }, take: Math.min(limit, 100) }));
}
