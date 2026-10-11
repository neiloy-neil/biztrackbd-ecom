// Visits every route of the four apps (local database, development sign-in) and records, per page: browser console errors and warnings,
// uncaught page errors, failed or 4xx/5xx network requests, and the HTTP status of the page. Start the apps with tools/dev-local.mjs first.
// Output: checkup/crawl.json and a summary on screen.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(join(root, ".env.local"));
const req = createRequire(join(root, "apps/admin/package.json"));
const { chromium } = req("@playwright/test");
const pg = req("pg");
const db = new pg.Client({ connectionString: process.env.DIRECT_URL });
await db.connect();
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0] ?? {};
const t = await one(`SELECT id FROM "Tenant" WHERE subdomain = 'rongdhonu'`);
const ids = {
  order: (await one(`SELECT id FROM "Order" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [t.id])).id,
  customer: (await one(`SELECT id FROM "Customer" WHERE "tenantId" = $1 LIMIT 1`, [t.id])).id,
  product: (await one(`SELECT id, slug FROM "Product" WHERE "tenantId" = $1 AND status = 'ACTIVE' LIMIT 1`, [t.id])),
  category: (await one(`SELECT slug FROM "Category" WHERE "tenantId" = $1 LIMIT 1`, [t.id])).slug,
  landing: (await one(`SELECT id FROM "LandingPage" WHERE "tenantId" = $1 LIMIT 1`, [t.id]).catch(() => ({}))).id,
  page: (await one(`SELECT slug FROM "Page" WHERE "tenantId" = $1 AND "isPublished" LIMIT 1`, [t.id]).catch(() => ({}))).slug,
  post: (await one(`SELECT slug FROM "BlogPost" WHERE "tenantId" = $1 AND "isPublished" LIMIT 1`, [t.id]).catch(() => ({}))).slug,
  returnId: (await one(`SELECT id FROM "ReturnRequest" WHERE "tenantId" = $1 LIMIT 1`, [t.id]).catch(() => ({}))).id,
};
const platformTenant = (await one(`SELECT id FROM "Tenant" WHERE subdomain = 'rongdhonu'`)).id;
await db.end();

const STORE = "http://rongdhonu.localhost:3000", ADMIN = "http://localhost:3001", MKT = "http://localhost:3002", PLAT = "http://localhost:3003";
const R = (base, paths) => paths.filter(Boolean).map((p) => base + p);
const targets = [
  ...R(MKT, ["/", "/pricing", "/start", "/templates", "/robots.txt"]),
  ...R(ADMIN, ["/", "/abandoned", "/billing", "/content", "/customers", ids.customer && `/customers/${ids.customer}`, "/design", "/finance/cod", "/finance/profit", "/fraud", "/inventory", "/landing", ids.landing && `/landing/${ids.landing}`, "/login", "/login/start", "/marketing/coupons", "/marketing/loyalty", "/marketing/pixels", "/more", "/orders", ids.order && `/orders/${ids.order}`, "/orders/new", "/products", ids.product.id && `/products/${ids.product.id}`, "/products/new", "/reports", "/returns", "/returns/new", "/reviews", "/security", "/settings/apps", "/settings/audit", "/settings/domains", "/settings/integrations", "/settings/payments", "/settings/shipping", "/settings/staff", "/settings/store", "/manifest.webmanifest"]),
  ...R(PLAT, ["/", "/audit", "/domains", "/payments", "/plans", "/tenants", `/tenants/${platformTenant}`, "/login"]),
  ...R(STORE, ["/", "/account", "/blog", ids.post && `/blog/${ids.post}`, ids.category && `/c/${ids.category}`, "/cart", "/checkout", ids.page && `/p/${ids.page}`, ids.product.slug && `/products/${ids.product.slug}`, "/search?q=cotton", "/offline", "/robots.txt", "/sitemap.xml", "/does-not-exist"]),
];
const browser = await chromium.launch({ channel: "chrome" });
const report = [];
for (const url of targets) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([
    { name: "dev_user", value: "owner@rongdhonu.example", url: ADMIN },
    { name: "dev_platform_user", value: "owner@biztrackbd.example", url: PLAT },
    { name: "bt_lang", value: "en", url: STORE },
  ]);
  const page = await ctx.newPage();
  const row = { url: url.replace(/[a-z0-9]{20,}/g, "<id>"), status: null, console: [], pageErrors: [], badRequests: [] };
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) row.console.push(`${m.type()}: ${m.text().replace(/\s+/g, " ").slice(0, 240)}`); });
  page.on("pageerror", (e) => row.pageErrors.push(String(e).slice(0, 240)));
  page.on("requestfailed", (r) => row.badRequests.push(`FAILED ${r.method()} ${r.url().slice(0, 110)} ${r.failure()?.errorText ?? ""}`));
  page.on("response", (r) => { if (r.status() >= 400) row.badRequests.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 110)}`); });
  try {
    const resp = await page.goto(url, { waitUntil: "load", timeout: 120_000 });
    row.status = resp?.status() ?? null;
    await page.waitForTimeout(1500);
  } catch (e) {
    row.pageErrors.push("navigation: " + String(e).slice(0, 160));
  }
  report.push(row);
  await ctx.close();
  const bad = row.console.length + row.pageErrors.length + row.badRequests.length;
  console.log(`${String(row.status).padEnd(4)} ${bad ? "!!" : "ok"} ${row.url}${bad ? "  (" + bad + ")" : ""}`);
}
await browser.close();
writeFileSync(join(root, "checkup", "crawl.json"), JSON.stringify(report, null, 1));
const flagged = report.filter((r) => r.console.length || r.pageErrors.length || r.badRequests.length);
console.log(`\n${report.length} pages, ${flagged.length} with console, page-error or network problems. Details: checkup/crawl.json`);
