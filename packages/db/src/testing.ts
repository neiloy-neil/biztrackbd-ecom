// Test and tooling helpers. Imported as "@biztrackbd/db/testing". Never import from application code.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { PrismaClient } from "@prisma/client";
import { createBaseClient } from "./client";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../prisma/migrations");

export const APP_ROLE_PASSWORD = "app_password"; // test and local dev only

export function testUrls() {
  const direct = process.env.TEST_DIRECT_URL;
  const app = process.env.TEST_DATABASE_URL;
  if (!direct || !app) {
    throw new Error("TEST_DIRECT_URL and TEST_DATABASE_URL must be set (see /.env.example). Tests never use DATABASE_URL.");
  }
  if (!/test/i.test(new URL(direct).pathname)) {
    throw new Error("Refusing to reset a database whose name does not contain 'test'");
  }
  return { direct, app };
}

/** Drops everything in the public schema and re-applies every migration as the owner role. */
export async function resetDatabase(directUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: directUrl });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    const dirs = readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    for (const d of dirs) {
      await client.query(readFileSync(resolve(migrationsDir, d, "migration.sql"), "utf8"));
    }
    await client.query(`ALTER ROLE biztrack_app LOGIN PASSWORD '${APP_ROLE_PASSWORD}'`);
  } finally {
    await client.end();
  }
}

/** Owner-role client. Bypasses RLS (superuser/owner). For fixtures and assertions only. */
export function createOwnerClient(directUrl: string): PrismaClient {
  return createBaseClient(directUrl, 3);
}

export const PLAN_ROWS = [
  { tier: "STARTER", name: "Starter", priceMonthlyBdt: 699, priceYearlyBdt: 6990, sortOrder: 1,
    limits: { products: 300, ordersPerMonth: 500, staff: 2, storageGb: 5, smsCredits: 200, landingPages: 3, aiCredits: 50 },
    features: { customDomain: false, courierBooking: "manual", fraud: "basic", sectionBuilder: "settings", modules: 0, paymentGateway: false, capi: true } },
  { tier: "PRO", name: "Pro", priceMonthlyBdt: 1499, priceYearlyBdt: 14990, sortOrder: 2,
    limits: { products: 2000, ordersPerMonth: 3000, staff: 5, storageGb: 20, smsCredits: 1000, landingPages: 20, aiCredits: 250 },
    features: { customDomain: true, courierBooking: "auto", fraud: "full", sectionBuilder: "home", modules: 3, paymentGateway: false, capi: true } },
  { tier: "BUSINESS", name: "Business", priceMonthlyBdt: 3499, priceYearlyBdt: 34990, sortOrder: 3,
    limits: { products: null, ordersPerMonth: null, staff: 15, storageGb: 100, smsCredits: 3000, landingPages: null, aiCredits: 1000 },
    features: { customDomain: true, courierBooking: "auto", fraud: "full", sectionBuilder: "all", modules: "all", paymentGateway: true, capi: true } },
] as const;

export async function seedPlans(owner: PrismaClient): Promise<void> {
  for (const p of PLAN_ROWS) {
    await owner.plan.upsert({
      where: { tier: p.tier },
      create: { ...p, limits: p.limits as object, features: p.features as object },
      update: { name: p.name, priceMonthlyBdt: p.priceMonthlyBdt, priceYearlyBdt: p.priceYearlyBdt, limits: p.limits as object, features: p.features as object },
    });
  }
}

export interface TenantFixture {
  tenantId: string;
  subdomain: string;
  zones: { insideDhaka: string; outsideDhaka: string };
  products: { id: string; title: string; variants: { id: string; title: string; price: number; stock: number }[] }[];
}

/** A tenant with shipping zones, one category and three products with sized variants. Created as the owner role. */
export async function createTenantFixture(owner: PrismaClient, opts: { name: string; subdomain: string; stock?: number }): Promise<TenantFixture> {
  const stock = opts.stock ?? 10;
  const tenant = await owner.tenant.create({
    data: { name: opts.name, subdomain: opts.subdomain, themeId: "kapor", trialEndsAt: new Date(Date.now() + 14 * 86_400_000) },
  });
  const t = tenant.id;
  const insideDhaka = await owner.shippingZone.create({
    data: { tenantId: t, name: "Inside Dhaka city", districts: ["Dhaka"], rate: 80, freeOverAmount: 3000 },
  });
  const outsideDhaka = await owner.shippingZone.create({
    data: { tenantId: t, name: "Outside Dhaka", districts: ["*"], rate: 130, freeOverAmount: 5000 },
  });
  const category = await owner.category.create({ data: { tenantId: t, name: "Panjabi", slug: "panjabi" } });
  const defs = [
    { title: "Cotton Panjabi, Off-white", slug: "cotton-panjabi-off-white", price: 1150, sizes: ["M", "L", "XL"] },
    { title: "Linen Shirt, Sage", slug: "linen-shirt-sage", price: 850, sizes: ["M", "L"] },
    { title: "Slim Chino, Navy", slug: "slim-chino-navy", price: 1290, sizes: ["32", "34"] },
  ];
  const products: TenantFixture["products"] = [];
  for (const d of defs) {
    const product = await owner.product.create({
      data: { tenantId: t, title: d.title, slug: d.slug, descriptionHtml: "<p>Handloom cotton.</p>", status: "ACTIVE", basePrice: d.price, categoryId: category.id },
    });
    const variants = [];
    for (const size of d.sizes) {
      const v = await owner.productVariant.create({
        data: { tenantId: t, productId: product.id, title: size, sku: `${d.slug}-${size}`.toUpperCase(), price: d.price, stockQuantity: stock, options: { Size: size } },
      });
      variants.push({ id: v.id, title: v.title, price: d.price, stock });
    }
    products.push({ id: product.id, title: d.title, variants });
  }
  return { tenantId: t, subdomain: opts.subdomain, zones: { insideDhaka: insideDhaka.id, outsideDhaka: outsideDhaka.id }, products };
}
