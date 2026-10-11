// Screenshots every design artboard next to the live page it should match, for the UX gap report (docs/37, phase 0).
//   node tools/ux-capture.mjs [name-filter]      needs the four apps running locally (node tools/dev-local.mjs) and the seeded demo store
// Output: checkup/ux/<Artboard>.png (design left, app right), checkup/ux/<Artboard>.json (measurements) and checkup/ux/index.json.
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(join(root, "apps/admin/package.json"))("@playwright/test");
const board = join(root, "design/canvas/project");
const out = join(root, "checkup/ux");
mkdirSync(out, { recursive: true });

const A = "http://localhost:3001", S = "http://rongdhonu.localhost:3000", M = "http://localhost:3002", P = "http://localhost:3003";
// artboard -> [live url, width]. null url = the app has no such screen (itself a finding).
const MAP = {
  AdmDashboard: [A + "/"], AdmOrders: [A + "/orders"], AdmOrderDetail: [A + "/orders/@first:/orders"], AdmProducts: [A + "/products"], AdmProductEditor: [A + "/products/new"],
  AdmInventory: [A + "/inventory"], AdmCustomers: [A + "/customers"], AdmCustomerDetail: [A + "/customers/@first:/customers"], AdmCoupons: [A + "/marketing/coupons"], AdmReports: [A + "/reports"],
  AdmPayments: [A + "/settings/payments"], AdmShipping: [A + "/settings/shipping"], AdmNotifications: [null], AdmDomains: [A + "/settings/domains"], AdmBilling: [A + "/billing"],
  AdmStaff: [A + "/settings/staff"], AdmStoreDetails: [A + "/settings/store"], AdmIntegrations: [A + "/settings/integrations"], AdmApps: [A + "/settings/apps"], AdmFraud: [A + "/fraud"],
  AdmReturns: [A + "/returns"], AdmReviews: [A + "/reviews"], AdmLoyalty: [A + "/marketing/loyalty"], AdmPixels: [A + "/marketing/pixels"], AdmAbandoned: [A + "/abandoned"],
  AdmCodRecon: [A + "/finance/cod"], AdmProfit: [A + "/finance/profit"], AdmLanding: [A + "/landing"], AdmPagesBlog: [A + "/content"], AdmQuickOrder: [A + "/orders/new"],
  AdmLimit: [A + "/locked"], AdmReadOnly: [A + "/locked"], AdmInvoice: [null],
  BldEditor: [A + "/design"], BldTheme: [A + "/design"], BldLibrary: [A + "/design"], BldLanding: [A + "/landing"],
  DarkDashboard: [A + "/", 1440, "dark"],
  MobDashboard: [A + "/", 390], MobOrders: [A + "/orders", 390], MobAddProduct: [A + "/products/new", 390], MobMore: [A + "/more", 390], MobFraud: [A + "/fraud", 390],
  MobAbandoned: [A + "/abandoned", 390], MobCodRecon: [A + "/finance/cod", 390], MobPixels: [A + "/marketing/pixels", 390], MobQuickOrder: [A + "/orders/new", 390], MobLanding: [A + "/landing", 390],
  MobOrderBn: [A + "/orders/@first:/orders", 390], MobBkash: [null], MobCourier: [null],
  SaOverview: [P + "/"], SaTenants: [P + "/tenants"], SaTenant: [P + "/tenants/@first:/tenants"], SaPayments: [P + "/payments"], SaPlans: [P + "/plans"], SaDomains: [P + "/domains"], SaAudit: [P + "/audit"],
  SaAnnouncements: [null], SaTickets: [null], SaThemes: [null],
  StrHome: [S + "/"], StrProduct: [S + "/products/@first:/"], StrCheckout: [S + "/checkout"], StrAccount: [S + "/account"], StrSuccess: [null], StrOffline: [S + "/offline"], StrHomeMobile: [S + "/", 390],
  MktHome: [M + "/"], MktPricing: [M + "/pricing"], MktTemplates: [M + "/templates"], MktHomeMobile: [M + "/", 390], OnbSignup: [M + "/start"],
};
const filter = process.argv[2];

const mime = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const srv = createServer((req, res) => {
  const p = join(board, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(board) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": mime[extname(p)] ?? "application/octet-stream" });
  createReadStream(p).pipe(res);
}).listen(4100);

const MEASURE = () => ({
  h1: document.querySelector("h1")?.textContent?.trim().slice(0, 80) ?? null,
  pageHeight: document.documentElement.scrollHeight,
  buttons: document.querySelectorAll("button, .btn, a.btn, [role=button]").length,
  inputs: document.querySelectorAll("input, select, textarea").length,
  tables: document.querySelectorAll("table").length,
  cards: document.querySelectorAll(".card, .sec, .stat, .kpi, section").length,
  tabs: document.querySelectorAll(".tabs a, [role=tab]").length,
  headings: [...document.querySelectorAll("h1,h2,h3")].map((e) => e.textContent.trim().slice(0, 40)).slice(0, 14),
});

const browser = await chromium.launch({ channel: "chrome" });
const index = {};
for (const [name, [url0, width = 1440, scheme = "light"]] of Object.entries(MAP)) {
  if (filter && !name.toLowerCase().includes(filter.toLowerCase())) continue;
  const vp = { width, height: width === 390 ? 844 : 900 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: scheme });
  const d = await ctx.newPage();
  const rec = { artboard: name, width, live: url0 };
  try {
    await d.goto(`http://localhost:4100/${name}.dc.html`, { waitUntil: "networkidle", timeout: 30000 });
    await d.waitForTimeout(800);
    rec.design = await d.evaluate(MEASURE);
  } catch (e) { rec.designError = String(e).slice(0, 120); }
  let designPng = null, appPng = null;
  try { designPng = await d.screenshot({ fullPage: true, type: "jpeg", quality: 70 }); } catch { /* none */ }
  if (url0) {
    const a = await ctx.newPage();
    try {
      let url = url0;
      const m = url.match(/@first:(\S+)$/);
      if (m) {
        const base = url.slice(0, url.indexOf("@first:"));
        const origin = new URL(base).origin;
        await a.goto(origin + m[1], { waitUntil: "domcontentloaded", timeout: 120000 });
        const href = await a.evaluate((pfx) => [...document.querySelectorAll("a")].map((x) => x.getAttribute("href")).find((h) => h && h.startsWith(pfx === "/" ? "/products/" : pfx + "/") && h.length > pfx.length + 2) ?? null, m[1]);
        url = href ? origin + href : base.replace(/\/$/, "");
      }
      const resp = await a.goto(url, { waitUntil: "load", timeout: 120000 });
      await a.waitForTimeout(1200);
      rec.status = resp?.status();
      rec.app = await a.evaluate(MEASURE);
      appPng = await a.screenshot({ fullPage: true, type: "jpeg", quality: 70 });
    } catch (e) { rec.appError = String(e).slice(0, 160); }
  }
  // Side by side: design left, app right, both capped at 2200px tall.
  const c = await ctx.newPage();
  const img = (b) => (b ? `<img src="data:image/jpeg;base64,${b.toString("base64")}" style="width:100%;display:block;max-height:2200px;object-fit:cover;object-position:top">` : `<div style="padding:40px;font:600 20px sans-serif;color:#b91c1c">${url0 ? "app screen failed" : "NO SCREEN IN THE APP"}</div>`);
  const w = width === 390 ? 390 : 720;
  await c.setViewportSize({ width: w * 2 + 30, height: 800 });
  await c.setContent(`<body style="margin:0;background:#888;display:flex;gap:30px"><div style="width:${w}px;background:#fff">${img(designPng)}</div><div style="width:${w}px;background:#fff">${img(appPng)}</div></body>`);
  await c.screenshot({ path: join(out, `${name}.png`), fullPage: true, type: "png" });
  writeFileSync(join(out, `${name}.json`), JSON.stringify(rec, null, 1));
  index[name] = rec;
  console.log(name.padEnd(18), rec.status ?? (url0 ? "ERR" : "none"), `design h=${rec.design?.pageHeight ?? "-"} app h=${rec.app?.pageHeight ?? "-"}`);
  await ctx.close();
}
await browser.close();
srv.close();
writeFileSync(join(out, filter ? `index-${filter}.json` : "index.json"), JSON.stringify(index, null, 1));
