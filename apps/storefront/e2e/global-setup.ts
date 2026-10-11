import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DEMO_SUBDOMAIN, withDb } from "./db";

/** Puts the demo store in a known state: active, stocked, coupon unused, empty SMS outbox. */
export default async function globalSetup() {
  await withDb(async (c) => {
    const { rows } = await c.query(`SELECT id FROM "Tenant" WHERE subdomain = $1`, [DEMO_SUBDOMAIN]);
    if (!rows[0]) throw new Error("Demo store not found. Run pnpm db:seed first.");
    const id = rows[0].id;
    await c.query(`UPDATE "Tenant" SET status = 'ACTIVE' WHERE id = $1`, [id]);
    await c.query(`UPDATE "ProductVariant" SET "stockQuantity" = 60 WHERE "tenantId" = $1`, [id]);
    await c.query(`UPDATE "Coupon" SET "usageCount" = 0 WHERE "tenantId" = $1`, [id]);
    await c.query(`UPDATE "Product" SET status = 'ACTIVE', "deletedAt" = NULL WHERE "tenantId" = $1`, [id]);
    await c.query(`DELETE FROM "CustomerOtp" WHERE "tenantId" = $1`, [id]);
  });
  const outbox = process.env.E2E_SMS_OUTBOX_PATH!;
  mkdirSync(dirname(outbox), { recursive: true });
  writeFileSync(outbox, "");
}
