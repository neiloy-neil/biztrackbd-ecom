// The project checkup, stage by stage, against the REAL Supabase project (start the apps first: node tools/dev-real.mjs).
//   node tools/checkup-run.mjs reference            screenshots of the design canvas artboards (what the product should look like)
//   node tools/checkup-run.mjs marketing            the public marketing site
//   node tools/checkup-run.mjs signup               a new store, through the real signup wizard, into the real database
//   node tools/checkup-run.mjs owner                the owner sets a password, signs in and tours the store admin
//   node tools/checkup-run.mjs platform             a platform admin is created, signs in with two-step, approves the store
//   node tools/checkup-run.mjs storefront           a customer visits the new store and orders
// Screenshots: checkup/screens/actual/*.png and checkup/screens/reference/*.png. Everything the run creates is named
// "e2e-checkup-..." and listed in checkup/state.json so it can be found and removed.
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(join(root, ".env.local"));
const req = createRequire(join(root, "apps/admin/package.json"));
const { chromium } = req("@playwright/test");
const pg = req("pg");

const OUT = join(root, "checkup");
const ACTUAL = join(OUT, "screens", "actual");
const REFERENCE = join(OUT, "screens", "reference");
const STATE = join(OUT, "state.json");
mkdirSync(ACTUAL, { recursive: true });
mkdirSync(REFERENCE, { recursive: true });

const URLS = { marketing: "http://localhost:3002", admin: "http://localhost:3001", platform: "http://localhost:3003" };
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));
const log = (...a) => console.log(...a);

// --- Supabase admin API (test accounts, the code an email would carry) ---------------------------------------------------------
const sb = (path, init = {}) => fetch(`${process.env.SUPABASE_URL}${path}`, { ...init, headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", ...(init.headers ?? {}) } });
export async function emailCode(email) {
  const j = await (await sb("/auth/v1/admin/generate_link", { method: "POST", body: JSON.stringify({ type: "magiclink", email }) })).json();
  const otp = j.email_otp ?? j.properties?.email_otp;
  if (!otp) throw new Error(`no code for ${email}`);
  return otp;
}
async function createAuthUser(email, password) {
  const j = await (await sb("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  if (!j.id) throw new Error(`createUser ${email}: ${j.msg ?? "failed"}`);
  return j.id;
}
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function totp(secret) {
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(Array.from({ length: Math.floor(bits.length / 8) }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2)));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = createHmac("sha1", key).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, "0");
}
/** The owner connection (bypasses row security): only for setting up and checking what the apps stored. */
const owner = () => new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
async function sql(text, params = []) {
  const c = owner();
  await c.connect();
  try {
    return (await c.query(text, params)).rows;
  } finally {
    await c.end();
  }
}

// --- browser helpers -----------------------------------------------------------------------------------------------------------
let browser;
async function open(width = 1440, height = 900, extra = {}) {
  browser ??= await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width, height }, ...extra });
  ctx.setDefaultTimeout(60_000);
  return { ctx, page: await ctx.newPage() };
}
let shotNo = Object.keys(state.shots ?? {}).length;
async function shot(page, name, { full = true } = {}) {
  await page.waitForTimeout(600);
  const file = `${String(++shotNo).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: join(ACTUAL, file), fullPage: full });
  (state.shots ??= {})[name] = file;
  save();
  log("  screenshot", file);
  return file;
}
const go = (page, url) => page.goto(url, { waitUntil: "load", timeout: 120_000 });

// --- stages --------------------------------------------------------------------------------------------------------------------
const stages = {
  async reference() {
    const SP = process.argv[3];
    if (!SP) throw new Error("usage: checkup-run.mjs reference <folder rendered by tools/render-canvas.mjs>");
    const sizes = JSON.parse(readFileSync(join(root, "design/canvas/project/canvas.json"), "utf8")).boards;
    const { ctx, page } = await open();
    for (const [file, { w, h }] of Object.entries(sizes)) {
      const name = file.replace(".dc.html", "");
      await page.setViewportSize({ width: w, height: Math.min(h, 1200) });
      await page.goto(`file:///${join(SP, name + ".html").replace(/\\/g, "/")}`, { waitUntil: "load" });
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(REFERENCE, `${name}.png`), fullPage: true });
    }
    await ctx.close();
    log(`reference: ${Object.keys(sizes).length} artboards`);
  },

  async signup() {
    const run = Math.random().toString(36).slice(2, 6);
    const sub = `e2e-checkup-${run}`;
    const email = `e2e-checkup-owner-${run}@biztrack-e2e.test`;
    const phone = `0171${String(Math.floor(1000000 + Math.random() * 8999999))}`;
    Object.assign(state, { run, subdomain: sub, ownerEmail: email, ownerPhone: phone, storeName: `Checkup Store ${run}` });
    save();
    const { ctx, page } = await open();
    await go(page, URLS.marketing + "/start");
    await shot(page, "signup-1-you");
    await page.getByLabel("Your name").fill("Checkup Owner");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mobile number").fill(phone);
    await page.getByTestId("next").click();
    await page.getByTestId("step-store").waitFor();
    await shot(page, "signup-2-store");
    await page.getByLabel("Store name").fill(state.storeName);
    await page.getByPlaceholder(/./).first().isVisible().catch(() => undefined);
    await page.getByTestId("next").click();
    await page.getByTestId("step-address").waitFor();
    await page.locator("#sub").fill(sub);
    await page.getByTestId("address-status").getByText(/available|free/i).waitFor();
    await shot(page, "signup-3-address");
    await page.getByTestId("next").click();
    await page.getByTestId("step-plan").waitFor();
    await page.getByTestId("pick-PRO").click();
    await shot(page, "signup-4-template-and-plan");
    await page.getByTestId("next").click();
    await page.getByTestId("step-create").waitFor();
    await page.getByTestId("f-demo").check();
    await shot(page, "signup-5-create");
    await page.getByTestId("create").click();
    await page.waitForURL(/\/start\/done/, { timeout: 120_000 });
    await shot(page, "signup-6-done");
    await ctx.close();
    const t = (await sql(`SELECT id, status::text AS status, "planTier"::text AS plan, "trialEndsAt", "createdAt" FROM "Tenant" WHERE subdomain = $1`, [sub]))[0];
    if (!t) throw new Error("the store was not written to the database");
    state.tenantId = t.id;
    state.afterSignup = {
      tenant: t,
      users: await sql(`SELECT email, role::text AS role, "isActive", "authUserId" FROM "TenantUser" WHERE "tenantId" = $1`, [t.id]),
      products: (await sql(`SELECT count(*)::int AS n FROM "Product" WHERE "tenantId" = $1`, [t.id]))[0].n,
      zones: (await sql(`SELECT count(*)::int AS n FROM "ShippingZone" WHERE "tenantId" = $1`, [t.id]))[0].n,
      settings: (await sql(`SELECT "storeName" FROM "StoreSettings" WHERE "tenantId" = $1`, [t.id]))[0] ?? null,
    };
    save();
    log("stored in the Supabase database:", JSON.stringify(state.afterSignup));
  },

  async owner() {
    const email = state.ownerEmail;
    if (!email) throw new Error("run the signup stage first");
    const PASSWORD = "checkup owner password 2026";
    const { ctx, page } = await open();
    await go(page, URLS.admin + "/login");
    await shot(page, "owner-login");
    await go(page, URLS.admin + "/login/start");
    await shot(page, "owner-first-time-email");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Email").press("Enter");
    await page.getByTestId("code-sent").waitFor();
    await page.getByLabel("Code from the email").fill(await emailCode(email));
    await page.getByLabel("New password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Type it again").fill(PASSWORD);
    await shot(page, "owner-first-time-code-and-password");
    await page.getByLabel("Type it again").press("Enter");
    await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 120_000 });
    await shot(page, "owner-dashboard");
    state.afterOwnerLogin = (await sql(`SELECT email, "authUserId" IS NOT NULL AS bound, "lastLoginAt" IS NOT NULL AS logged FROM "TenantUser" WHERE "tenantId" = $1`, [state.tenantId]).catch(async () => sql(`SELECT email, "authUserId" IS NOT NULL AS bound FROM "TenantUser" WHERE "tenantId" = $1`, [state.tenantId])));
    save();
    log("owner row after sign-in:", JSON.stringify(state.afterOwnerLogin));
    const tour = [
      ["/orders", "admin-orders"], ["/orders/new", "admin-quick-order"], ["/products", "admin-products"], ["/products/new", "admin-product-new"],
      ["/customers", "admin-customers"], ["/inventory", "admin-inventory"], ["/reports", "admin-reports"], ["/finance/profit", "admin-profit"],
      ["/finance/cod", "admin-cod"], ["/returns", "admin-returns"], ["/fraud", "admin-fraud"], ["/abandoned", "admin-abandoned"], ["/reviews", "admin-reviews"],
      ["/marketing/coupons", "admin-coupons"], ["/marketing/loyalty", "admin-loyalty"], ["/marketing/pixels", "admin-pixels"],
      ["/design", "admin-design"], ["/landing", "admin-landing"], ["/content", "admin-pages-blog"],
      ["/settings/store", "admin-store-details"], ["/settings/domains", "admin-domains"], ["/settings/payments", "admin-payments"], ["/settings/shipping", "admin-shipping"],
      ["/settings/integrations", "admin-integrations"], ["/settings/staff", "admin-staff"], ["/settings/apps", "admin-apps"], ["/settings/audit", "admin-audit"],
      ["/billing", "admin-billing"], ["/security", "admin-security"],
    ];
    state.tourStatus = {};
    for (const [path, name] of tour) {
      const r = await go(page, URLS.admin + path);
      state.tourStatus[path] = r?.status();
      await shot(page, name);
    }
    save();
    await ctx.close();
    const m = await open(390, 844, { isMobile: true, hasTouch: true });
    await go(m.page, URLS.admin + "/login");
    await m.page.getByLabel("Email").fill(email);
    await m.page.getByLabel("Password").fill(PASSWORD);
    await m.page.getByLabel("Password").press("Enter");
    await m.page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 120_000 });
    for (const [path, name] of [["/", "mobile-dashboard"], ["/orders", "mobile-orders"], ["/more", "mobile-more"], ["/products/new", "mobile-add-product"]]) {
      await go(m.page, URLS.admin + path);
      await shot(m.page, name);
    }
    await m.ctx.close();
  },

  /** A second signup whose store name looks like a well-known brand: it is held for the platform team to review. */
  async flagged() {
    const run = Math.random().toString(36).slice(2, 6);
    const sub = `e2e-checkup-apex-${run}`;
    const email = `e2e-checkup-flag-${run}@biztrack-e2e.test`;
    const phone = `0181${String(Math.floor(1000000 + Math.random() * 8999999))}`;
    state.flagged = { subdomain: sub, email, storeName: `Apex Tailors ${run}` };
    const { ctx, page } = await open();
    await go(page, URLS.marketing + "/start");
    await page.getByLabel("Your name").fill("Flagged Owner");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mobile number").fill(phone);
    await page.getByTestId("next").click();
    await page.getByLabel("Store name").fill(state.flagged.storeName);
    await page.getByTestId("next").click();
    await page.locator("#sub").fill(sub);
    await page.getByTestId("address-status").getByText(/available|free/i).waitFor();
    await page.getByTestId("next").click();
    await page.getByTestId("pick-STARTER").click();
    await page.getByTestId("next").click();
    await page.getByTestId("create").click();
    await page.waitForURL(/\/start\/done/, { timeout: 120_000 });
    await shot(page, "signup-flagged-done");
    await ctx.close();
    const t = (await sql(`SELECT id, status::text AS status, quarantined, "quarantineReason" FROM "Tenant" WHERE subdomain = $1`, [sub]))[0];
    if (!t) throw new Error("the flagged store was not written to the database");
    state.flagged.tenantId = t.id;
    state.flagged.stored = t;
    save();
    log("flagged store in the Supabase database:", JSON.stringify(t));
  },

  async platform() {
    const PASSWORD = "checkup platform password 2026";
    const OWNER_PW = "checkup owner password 2026";
    const email = `e2e-checkup-platform-${state.run}@biztrack-e2e.test`;
    state.platformEmail = email;
    // Re-runnable: remove an earlier platform admin of this run first (its authenticator secret is not kept).
    const found = await (await sb("/auth/v1/admin/users?page=1&per_page=200")).json();
    for (const u of found.users ?? []) if (u.email === email) await sb(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" });
    await sql(`DELETE FROM "PlatformUser" WHERE email = $1`, [email]);
    await createAuthUser(email, PASSWORD);
    await sql(`INSERT INTO "PlatformUser" (id, email, name, role, "isActive") VALUES (gen_random_uuid()::text, $1, 'Checkup Platform Owner', 'OWNER', true)`, [email]);
    save();

    // 1. The store owner pays for the plan (a manual bKash payment), from the real billing screen.
    const o = await open();
    await go(o.page, URLS.admin + "/login");
    await o.page.getByLabel("Email").fill(state.ownerEmail);
    await o.page.getByLabel("Password").fill(OWNER_PW);
    await o.page.getByLabel("Password").press("Enter");
    await o.page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 120_000 });
    await go(o.page, URLS.admin + "/billing");
    await shot(o.page, "billing-before-payment");
    if (!state.proof) {
      state.trx = `CHK${state.run.toUpperCase()}${Date.now().toString().slice(-5)}`.slice(0, 12);
      await o.page.locator('input[name="senderNumber"]').fill("01712345678");
      await o.page.locator('input[name="trxId"]').fill(state.trx);
      await shot(o.page, "billing-payment-form");
      await o.page.locator('input[name="trxId"]').press("Enter");
      await o.page.getByTestId("proof-sent").waitFor();
      await shot(o.page, "billing-payment-sent");
    }
    state.proof = (await sql(`SELECT id, status::text AS status, amount::text AS amount, "trxId" FROM "PaymentProof" WHERE "tenantId" = $1`, [state.tenantId]).catch(() => []))[0] ?? null;
    state.trx = state.proof?.trxId ?? state.trx;
    save();

    // 2. The platform team signs in: password, then the authenticator.
    const { ctx, page } = await open();
    await go(page, URLS.platform + "/login");
    await shot(page, "platform-login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByLabel("Password").press("Enter");
    await page.waitForURL(/\/enroll/, { timeout: 120_000 });
    await shot(page, "platform-enroll-start");
    await page.getByTestId("totp-start").click();
    await page.getByTestId("totp-secret").waitFor();
    const secret = (await page.getByTestId("totp-secret").innerText()).trim();
    state.platformTotpSecret = secret; // a test account's secret; the account is removed with the checkup
    await shot(page, "platform-enroll-secret");
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByLabel("6-digit code").press("Enter");
    await page.waitForTimeout(3000);
    if (/\/login\/mfa/.test(page.url())) {
      await page.getByLabel("6-digit code").fill(totp(secret));
      await page.getByLabel("6-digit code").press("Enter");
    }
    await go(page, URLS.platform + "/");
    if (/\/login/.test(page.url())) throw new Error("the platform admin is not signed in: " + page.url());
    await shot(page, "platform-overview");

    // 3. Review the flagged store, then approve it.
    await go(page, URLS.platform + "/tenants");
    await shot(page, "platform-tenants");
    await go(page, URLS.platform + `/tenants/${state.flagged.tenantId}`);
    await shot(page, "platform-tenant-flagged");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.waitForTimeout(4000);
    await page.reload();
    await shot(page, "platform-tenant-approved");
    state.flagged.afterApprove = (await sql(`SELECT status::text AS status, quarantined FROM "Tenant" WHERE id = $1`, [state.flagged.tenantId]))[0];

    // 4. Approve the owner's payment.
    await go(page, URLS.platform + "/payments");
    await shot(page, "platform-payments-pending");
    await page.getByTestId("payment-card").filter({ hasText: state.trx }).getByRole("button", { name: /approve/i }).click();
    await page.waitForTimeout(4000);
    await page.reload();
    await shot(page, "platform-payments-after-approve");
    state.afterApproval = {
      proof: (await sql(`SELECT status::text AS status FROM "PaymentProof" WHERE "tenantId" = $1`, [state.tenantId]).catch(() => []))[0] ?? null,
      tenant: (await sql(`SELECT status::text AS status, "planTier"::text AS plan FROM "Tenant" WHERE id = $1`, [state.tenantId]))[0],
      subscription: (await sql(`SELECT status::text AS status, "currentPeriodEnd" FROM "Subscription" WHERE "tenantId" = $1`, [state.tenantId]).catch(() => []))[0] ?? null,
    };
    save();
    log("after approval:", JSON.stringify(state.afterApproval), JSON.stringify(state.flagged.afterApprove));

    for (const [path, name] of [[`/tenants/${state.tenantId}`, "platform-tenant-detail"], ["/plans", "platform-plans"], ["/domains", "platform-domains"], ["/audit", "platform-audit"], ["/payments?tab=APPROVED", "platform-payments-approved"]]) {
      await go(page, URLS.platform + path);
      await shot(page, name);
    }
    await ctx.close();
    await o.page.reload();
    await shot(o.page, "billing-after-approval");
    await o.ctx.close();
  },

  async approveflagged() {
    const PASSWORD = "checkup platform password 2026";
    const { ctx, page } = await open();
    await go(page, URLS.platform + "/login");
    await page.getByLabel("Email").fill(state.platformEmail);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByLabel("Password").press("Enter");
    await page.getByLabel("6-digit code").waitFor();
    await page.getByLabel("6-digit code").fill(totp(state.platformTotpSecret));
    await page.getByLabel("6-digit code").press("Enter");
    await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 120_000 });
    await go(page, URLS.platform + `/tenants/${state.flagged.tenantId}`);
    await page.getByPlaceholder("What you checked").fill("Checked the name and address: an unrelated tailoring shop. Fine.");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.waitForTimeout(4000);
    await page.reload();
    await shot(page, "platform-tenant-approved-with-note");
    state.flagged.afterApprove = (await sql(`SELECT status::text AS status, quarantined FROM "Tenant" WHERE id = $1`, [state.flagged.tenantId]))[0];
    state.flagged.audit = await sql(`SELECT action, "createdAt" FROM "AuditLog" WHERE "tenantId" = $1 ORDER BY "createdAt"`, [state.flagged.tenantId]).catch(() => []);
    save();
    log("flagged store after approval:", JSON.stringify(state.flagged.afterApprove), "audit:", JSON.stringify(state.flagged.audit.map((a) => a.action)));
    await ctx.close();
  },

  async storefront() {
    const STORE = `http://${state.subdomain}.localhost:3000`;
    const prods = await sql(`SELECT p.slug, p.title FROM "Product" p WHERE p."tenantId" = $1 ORDER BY p."createdAt" LIMIT 3`, [state.tenantId]);
    const variant = (await sql(`SELECT v.id, v.size FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE p."tenantId" = $1 AND p.slug = $2 AND v."stockQty" > 0 ORDER BY v."createdAt" LIMIT 1`, [state.tenantId, prods[0].slug]).catch(() => []))[0];
    const { ctx, page } = await open(1440, 900);
    await ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }]);
    await go(page, STORE + "/");
    await shot(page, "store-home");
    await go(page, `${STORE}/products/${prods[0].slug}`);
    await shot(page, "store-product");
    // choose the first size if the product has sizes, then add to cart
    const size = page.locator('[data-testid^="size-"]').first();
    if (await size.count()) await size.click();
    await page.getByTestId("add-to-cart").click();
    await page.getByTestId("cart-count").waitFor();
    await go(page, STORE + "/cart");
    await shot(page, "store-cart");
    await go(page, STORE + "/checkout");
    const phone = `0191${String(Math.floor(1000000 + Math.random() * 8999999))}`;
    await page.getByLabel("Mobile number").fill(phone.slice(1));
    await page.getByLabel("Full name").fill("Checkup Customer");
    await page.locator("#f-upazila").selectOption("Mirpur");
    await page.getByLabel("House, road and area").fill("House 12, Road 3, Mirpur 10");
    await shot(page, "store-checkout");
    await page.locator('[data-testid="place-order"]:visible, [data-testid="place-order-desktop"]:visible').first().click();
    await page.waitForURL(/\/order\//, { timeout: 120_000 });
    await shot(page, "store-order-success");
    state.order = (await page.getByTestId("order-success").innerText()).match(/BT-\d+/)?.[0];
    await go(page, STORE + "/account");
    await shot(page, "store-account-login");
    const m = await open(390, 844, { isMobile: true, hasTouch: true });
    await m.ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }]);
    await go(m.page, STORE + "/");
    await shot(m.page, "store-home-mobile");
    await go(m.page, `${STORE}/products/${prods[0].slug}`);
    await shot(m.page, "store-product-mobile");
    await m.ctx.close();
    await ctx.close();
    state.afterOrder = {
      order: (await sql(`SELECT "orderNumber", status::text AS status, "paymentMethod"::text AS method, "totalAmount"::text AS total, "customerPhone", "deliveryCharge"::text AS delivery FROM "Order" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [state.tenantId]))[0],
      customers: (await sql(`SELECT count(*)::int AS n FROM "Customer" WHERE "tenantId" = $1`, [state.tenantId]))[0].n,
      items: (await sql(`SELECT count(*)::int AS n FROM "OrderItem" WHERE "tenantId" = $1`, [state.tenantId]))[0].n,
      stockMoved: (await sql(`SELECT count(*)::int AS n FROM "InventoryMovement" WHERE "tenantId" = $1`, [state.tenantId]).catch(() => [{ n: "n/a" }]))[0].n,
    };
    save();
    log("order in the Supabase database:", JSON.stringify(state.afterOrder), "variant:", JSON.stringify(variant ?? null));
  },

  async fulfil() {
    const PASSWORD = "checkup owner password 2026";
    const { ctx, page } = await open();
    await go(page, URLS.admin + "/login");
    await page.getByLabel("Email").fill(state.ownerEmail);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByLabel("Password").press("Enter");
    await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 120_000 });
    await go(page, URLS.admin + "/");
    await shot(page, "owner-dashboard-with-order");
    await go(page, URLS.admin + "/orders?tab=all");
    await shot(page, "owner-orders-with-order");
    const orderId = (await sql(`SELECT id FROM "Order" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [state.tenantId]))[0].id;
    await go(page, URLS.admin + `/orders/${orderId}`);
    await shot(page, "owner-order-detail");
    await page.getByRole("button", { name: "Confirm order" }).filter({ visible: true }).first().click();
    await page.waitForTimeout(4000);
    await page.reload();
    await shot(page, "owner-order-confirmed");
    state.afterConfirm = (await sql(`SELECT status::text AS status FROM "Order" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [state.tenantId]))[0];
    state.orderAudit = await sql(`SELECT action FROM "AuditLog" WHERE "tenantId" = $1 ORDER BY "createdAt"`, [state.tenantId]).catch(() => []);
    save();
    log("after the owner confirmed it:", JSON.stringify(state.afterConfirm), "audit:", JSON.stringify(state.orderAudit.map((a) => a.action)));
    await go(page, URLS.admin + "/customers");
    await shot(page, "owner-customers-with-customer");
    await ctx.close();
  },

  /** Actual (left) beside the design reference (right), one image per screen: checkup/screens/compare/. */
  async compare() {
    const PAIRS = [
      ["marketing-home", "MktHome"], ["marketing-templates", "MktTemplates"], ["marketing-pricing", "MktPricing"], ["marketing-home-mobile", "MktHomeMobile"],
      ["signup-1-you", "OnbSignup"], ["signup-2-store", "OnbStore"], ["signup-3-address", "OnbSubdomain"], ["signup-4-template-and-plan", "OnbTemplate"], ["signup-5-create", "OnbBrand"],
      ["owner-dashboard", "AdmDashboard"], ["owner-dashboard-with-order", "AdmDashboard"], ["admin-orders", "AdmOrders"], ["owner-orders-with-order", "AdmOrders"], ["owner-order-detail", "AdmOrderDetail"],
      ["admin-products", "AdmProducts"], ["admin-product-new", "AdmProductEditor"], ["admin-customers", "AdmCustomers"], ["owner-customers-with-customer", "AdmCustomers"],
      ["admin-quick-order", "AdmQuickOrder"], ["admin-inventory", "AdmInventory"], ["admin-reports", "AdmReports"], ["admin-profit", "AdmProfit"], ["admin-cod", "AdmCodRecon"],
      ["admin-returns", "AdmReturns"], ["admin-fraud", "AdmFraud"], ["admin-abandoned", "AdmAbandoned"], ["admin-reviews", "AdmReviews"], ["admin-coupons", "AdmCoupons"],
      ["admin-loyalty", "AdmLoyalty"], ["admin-pixels", "AdmPixels"], ["admin-design", "BldEditor"], ["admin-landing", "AdmLanding"], ["admin-pages-blog", "AdmPagesBlog"],
      ["admin-store-details", "AdmStoreDetails"], ["admin-domains", "AdmDomains"], ["admin-payments", "AdmPayments"], ["admin-shipping", "AdmShipping"], ["admin-integrations", "AdmIntegrations"],
      ["admin-staff", "AdmStaff"], ["admin-apps", "AdmApps"], ["admin-billing", "AdmBilling"],
      ["mobile-dashboard", "MobDashboard"], ["mobile-orders", "MobOrders"], ["mobile-more", "MobMore"], ["mobile-add-product", "MobAddProduct"],
      ["platform-overview", "SaOverview"], ["platform-tenants", "SaTenants"], ["platform-tenant-detail", "SaTenant"], ["platform-payments-pending", "SaPayments"],
      ["platform-plans", "SaPlans"], ["platform-domains", "SaDomains"], ["platform-audit", "SaAudit"],
      ["store-home", "StrHome"], ["store-product", "StrProduct"], ["store-checkout", "StrCheckout"], ["store-order-success", "StrSuccess"], ["store-account-login", "StrAccount"], ["store-home-mobile", "StrHomeMobile"],
    ];
    const COMPARE = join(OUT, "screens", "compare");
    mkdirSync(COMPARE, { recursive: true });
    const { ctx, page } = await open(1500, 1000);
    const b64 = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
    let n = 0;
    for (const [a, ref] of PAIRS) {
      const file = state.shots?.[a];
      if (!file) { log("  no screenshot for", a); continue; }
      const mobile = /Mob|Mobile/.test(ref) || /mobile/.test(a);
      const html = `<body style="margin:0;background:#888;font:14px sans-serif;color:#fff"><div style="display:flex;gap:12px;padding:12px;align-items:flex-start">
        <div style="flex:1"><div style="padding:4px 0">ACTUAL: ${a}</div><img style="width:100%;display:block" src="${b64(join(ACTUAL, file))}"></div>
        <div style="flex:1"><div style="padding:4px 0">DESIGN: ${ref}</div><img style="width:100%;display:block" src="${b64(join(REFERENCE, ref + ".png"))}"></div></div></body>`;
      await page.setViewportSize({ width: mobile ? 900 : 1500, height: 1000 });
      await page.setContent(html);
      await page.waitForTimeout(150);
      await page.screenshot({ path: join(COMPARE, `${String(++n).padStart(2, "0")}-${a}.png`), fullPage: true });
    }
    await ctx.close();
    log(`compare: ${n} side-by-side images in checkup/screens/compare`);
  },

  async retake() {
    const { ctx, page } = await open();
    await go(page, URLS.admin + "/login");
    await page.getByLabel("Email").fill(state.ownerEmail);
    await page.getByLabel("Password").fill("checkup owner password 2026");
    await page.getByLabel("Password").press("Enter");
    await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 120_000 });
    const id = (await sql(`SELECT id FROM "Order" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [state.tenantId]))[0].id;
    await go(page, URLS.admin + `/orders/${id}`);
    await shot(page, "owner-order-detail");
    await ctx.close();
  },

  async marketing() {
    const { ctx, page } = await open();
    for (const [path, name] of [["/", "marketing-home"], ["/templates", "marketing-templates"], ["/pricing", "marketing-pricing"]]) {
      await go(page, URLS.marketing + path);
      await shot(page, name);
    }
    await ctx.close();
    const m = await open(390, 844, { isMobile: true, hasTouch: true });
    await go(m.page, URLS.marketing + "/");
    await shot(m.page, "marketing-home-mobile");
    await m.ctx.close();
  },
};

const which = process.argv[2];
if (!stages[which]) {
  console.error(`stages: ${Object.keys(stages).join(", ")}`);
  process.exit(1);
}
try {
  await stages[which]();
} finally {
  await browser?.close();
}
void totp; void createAuthUser; void emailCode; void sql;
