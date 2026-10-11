import { DEMO, withDb } from "./db";

/** Puts the demo store in a known state: open, stocked, with payment numbers and a sensible plan. */
export default async function globalSetup() {
  await withDb(async (c) => {
    const { rows } = await c.query(`SELECT id FROM "Tenant" WHERE subdomain = $1`, [DEMO]);
    if (!rows[0]) throw new Error("Demo store not found. Run pnpm db:seed first.");
    const id = rows[0].id as string;
    await c.query(`UPDATE "Tenant" SET status = 'ACTIVE', "planTier" = 'PRO', "orderPrefix" = 'BT-' WHERE id = $1`, [id]);
    await c.query(`UPDATE "Plan" SET limits = jsonb_set(jsonb_set(limits::jsonb, '{products}', '2000'), '{storageGb}', '20') WHERE tier = 'PRO'`);
    await c.query(`UPDATE "ProductVariant" SET "stockQuantity" = 60, "reorderLevel" = 5 WHERE "tenantId" = $1`, [id]);
    await c.query(`UPDATE "Product" SET status = 'ACTIVE', "deletedAt" = NULL WHERE "tenantId" = $1 AND slug NOT LIKE 'e2e-%'`, [id]);
    await c.query(`DELETE FROM "BlockedContact" WHERE "tenantId" = $1`, [id]);
    await c.query(`UPDATE "Customer" SET "isBlacklisted" = false WHERE "tenantId" = $1`, [id]);
    await c.query(
      `UPDATE "StoreSettings" SET "ordersPaused" = false, "codEnabled" = true, "codFee" = 0, "codMaxAmount" = NULL, "bkashEnabled" = true, "nagadEnabled" = true,
         "bkashNumber" = '01712345678', "nagadNumber" = '01712345678' WHERE "tenantId" = $1`,
      [id],
    );
    await c.query(`UPDATE "Coupon" SET "usageCount" = 0 WHERE "tenantId" = $1`, [id]);
    await c.query(`DELETE FROM "Coupon" WHERE "tenantId" = $1 AND code LIKE 'E2E%'`, [id]);
    await c.query(`UPDATE "Tenant" SET "productCount" = (SELECT count(*) FROM "Product" WHERE "tenantId" = $1 AND "deletedAt" IS NULL) WHERE id = $1`, [id]);
  });
}
