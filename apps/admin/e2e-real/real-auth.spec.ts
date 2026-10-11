import { expect, test, type Page } from "@playwright/test";
import { tenantId, withDb } from "../e2e/db";
import { PASSWORD, createUser, deleteAllTestUsers, emailCode, emailFor, runId, totp } from "./supabase";

/**
 * Real sign-in against the real Supabase project. Store staff: wrong password, unconfirmed email, unknown and deactivated
 * accounts, roles, two stores, sign-out that really ends the session, session refresh, an open-redirect attempt, first-time
 * password setup from an emailed code, joining from an invite, and two-factor. Platform team: team-only access and mandatory
 * two-factor. Every test account is created with Supabase's admin API and deleted at the end.
 */
const PLAT = "http://localhost:3003";
const run = runId();
const mail = (who: string) => emailFor(run, who);
const E = { owner: mail("owner"), packer: mail("packer"), left: mail("left"), unconfirmed: mail("unconfirmed"), stranger: mail("stranger"), multi: mail("multi"), setup: mail("setup"), brute: mail("brute"), joiner: mail("joiner"), plat: mail("plat"), platOut: mail("platout") };

async function addStaff(email: string, role: string, o: { tenant?: string; active?: boolean } = {}) {
  const t = o.tenant ?? (await tenantId());
  await withDb((c) => c.query(`INSERT INTO "TenantUser" (id, "tenantId", email, "passwordHash", name, role, "isActive", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, 'EXTERNAL_AUTH', $3, $4::"StaffRole", $5, now())`, [t, email, `Test ${role}`, role, o.active ?? true]));
}
const boundId = (email: string) => withDb(async (c) => (await c.query(`SELECT "authUserId" AS id FROM "TenantUser" WHERE email = $1 LIMIT 1`, [email])).rows[0]?.id as string | null);

/**
 * Signs in. Supabase limits password sign-ins to roughly 30 per 5 minutes per address, and this suite signs in a lot; when the
 * answer is "too many tries" it waits out the window once and tries again, so the suite measures our code, not that limit.
 */
async function signInOnce(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signIn(page: Page, email: string, password = PASSWORD, base = "") {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(`${base}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    const limited = page.getByTestId("login-error").filter({ hasText: "Too many tries" });
    const moved = page.waitForURL((u) => !u.pathname.startsWith("/login") || u.search.includes("err="), { timeout: 8000 }).then(() => false, () => false);
    const hit = await Promise.race([moved, limited.waitFor({ timeout: 8000 }).then(() => true, () => false)]);
    if (!hit) return;
    console.log("sign-in rate limit reached; waiting 70 seconds");
    await page.waitForTimeout(70_000);
  }
}

test.describe.serial("real sign-in", () => {
  test.beforeAll(async () => {
    // Room for the test accounts under the plan's team limit; put back afterwards.
    await withDb(async (c) => c.query(`UPDATE "Tenant" SET "planTier" = 'BUSINESS' WHERE id = $1`, [await tenantId()]));
    await deleteAllTestUsers();
    await createUser(E.owner);
    await createUser(E.packer);
    await createUser(E.left);
    await createUser(E.unconfirmed, { confirmed: false });
    await createUser(E.stranger);
    await createUser(E.brute);
    await addStaff(E.brute, "STORE_MANAGER");
    await createUser(E.multi);
    await createUser(E.plat);
    await createUser(E.platOut);
    await addStaff(E.owner, "STORE_OWNER");
    await addStaff(E.packer, "ORDER_PACKER");
    await addStaff(E.left, "STORE_MANAGER", { active: false });
    await addStaff(E.unconfirmed, "STORE_MANAGER");
    await addStaff(E.multi, "STORE_MANAGER");
    await addStaff(E.setup, "STORE_MANAGER");
    const other = await withDb(async (c) => (await c.query(`SELECT id FROM "Tenant" WHERE id <> $1 ORDER BY "createdAt" LIMIT 1`, [await tenantId()])).rows[0]?.id as string | undefined);
    if (other) await addStaff(E.multi, "STORE_OWNER", { tenant: other });
    await withDb((c) => c.query(`INSERT INTO "PlatformUser" (id, email, name, role, "isActive") VALUES (gen_random_uuid()::text, $1, 'Test platform owner', 'OWNER', true)`, [E.plat]));
  });
  test.afterAll(async () => {
    await withDb(async (c) => {
      await c.query(`UPDATE "Tenant" SET "planTier" = 'PRO' WHERE id = $1`, [await tenantId()]);
      await c.query(`DELETE FROM "TenantUser" WHERE email LIKE 'e2e-real-%'`);
      await c.query(`DELETE FROM "PlatformUser" WHERE email LIKE 'e2e-real-%'`);
      await c.query(`DELETE FROM "StaffInvite" WHERE email LIKE 'e2e-real-%'`);
    });
    await deleteAllTestUsers();
  });

  test("a visitor who is not signed in is sent to the sign-in page, and the upload route says 401", async ({ page, request }) => {
    for (const path of ["/", "/orders", "/settings/payments", "/security"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    }
    expect((await request.post("/api/media", { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } } })).status()).toBe(401);
    expect((await request.get("/customers/export")).url()).toContain("/login");
  });

  test("a wrong password and an unknown email get the very same answer", async ({ page }) => {
    await signIn(page, E.owner, "not the right password");
    const wrong = await page.getByTestId("login-error").innerText();
    await signIn(page, mail("nobody"), "whatever whatever");
    const unknown = await page.getByTestId("login-error").innerText();
    expect(wrong).toBe(unknown);
    expect(wrong).toMatch(/not right/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("repeated wrong passwords for one account are stopped, and even the right password waits; correct sign-ins are never counted", async ({ page }) => {
    for (let i = 0; i < 8; i++) {
      await page.goto("/login");
      await page.getByLabel("Email").fill(E.brute);
      await page.getByLabel("Password").fill(`wrong password number ${i}`);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByTestId("login-error")).toContainText(/not right|Too many/);
    }
    await signInOnce(page, E.brute, PASSWORD);
    await expect(page.getByTestId("login-error")).toContainText("Too many tries");
    await expect(page).toHaveURL(/\/login/);
  });

  test("an account whose email is not confirmed cannot sign in, and nothing is tied to it", async ({ page }) => {
    await signIn(page, E.unconfirmed);
    await expect(page.getByTestId("login-error")).toContainText("confirm your email");
    expect(await boundId(E.unconfirmed)).toBeNull();
  });

  test("an account that is on no team, and a deactivated team member, are both turned away", async ({ page }) => {
    await signIn(page, E.stranger);
    await expect(page).toHaveURL(/err=no-store/);
    await expect(page.getByText("not on any store's team")).toBeVisible();
    await signIn(page, E.left);
    await expect(page).toHaveURL(/err=no-store/);
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the owner signs in, is tied to the account, sees the store and who they are, and the open-redirect attempt goes nowhere", async ({ page }) => {
    await page.goto("/login?next=//evil.example/steal");
    await page.getByLabel("Email").fill(E.owner);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("http://localhost:3001/");
    await expect(page.getByTestId("who-email")).toHaveText(E.owner);
    await expect(page.locator(".side .store-chip")).toContainText("Rongdhonu Fashion");
    expect(await boundId(E.owner)).not.toBeNull();
    // The tokens are httpOnly: no script on the page can read them.
    expect(await page.evaluate(() => document.cookie)).not.toMatch(/bt_at|bt_rt/);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "bt_at")?.httpOnly).toBe(true);
    expect(cookies.find((c) => c.name === "bt_rt")?.httpOnly).toBe(true);
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    // Already signed in: the sign-in page moves along.
    await page.goto("/login?next=/orders");
    await expect(page).toHaveURL(/\/orders$/);
  });

  test("roles come from our own records: a packer works orders but cannot open payments or the team", async ({ page }) => {
    await signIn(page, E.packer);
    await expect(page).toHaveURL("http://localhost:3001/");
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    for (const blocked of ["/settings/payments", "/settings/staff", "/billing"]) {
      await page.goto(blocked);
      await expect(page).toHaveURL(/\/no-access/);
    }
  });

  test("a person on two stores chooses one, and only a store they belong to is accepted", async ({ page }) => {
    const n = await withDb(async (c) => Number((await c.query(`SELECT count(*)::int AS n FROM "TenantUser" WHERE email = $1`, [E.multi])).rows[0].n));
    test.skip(n < 2, "needs a second store in the database");
    await signIn(page, E.multi);
    await expect(page).toHaveURL(/\/choose-store/);
    await expect(page.getByTestId("store-choices").locator("form")).toHaveCount(2);
    await page.getByTestId("store-choices").locator("button", { hasText: "Rongdhonu Fashion" }).click();
    await expect(page).toHaveURL("http://localhost:3001/");
    // A made-up store id in the cookie is ignored: the picker asks again.
    await page.context().addCookies([{ name: "bt_tenant", value: "not-a-store-of-mine", url: "http://localhost:3001" }]);
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/choose-store/);
  });

  test("signing out ends the session at Supabase, so the old cookie is dead", async ({ page, context }) => {
    await signIn(page, E.owner);
    await expect(page).toHaveURL("http://localhost:3001/");
    const before = (await context.cookies()).filter((c) => c.name === "bt_at" || c.name === "bt_rt");
    await page.getByTestId("sign-out").click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
    // Put the old cookies back, as someone who copied them would.
    await context.addCookies(before.map((c) => ({ name: c.name, value: c.value, url: "http://localhost:3001" })));
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a session whose access token has run out is renewed by itself, without asking for a password", async ({ page, context }) => {
    await signIn(page, E.owner);
    await expect(page).toHaveURL("http://localhost:3001/");
    const at = (await context.cookies()).find((c) => c.name === "bt_at")!;
    const claims = JSON.parse(Buffer.from(at.value.split(".")[1]!, "base64url").toString());
    // An access token that expired a minute ago, keeping everything else the same.
    const stale = `${at.value.split(".")[0]}.${Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 })).toString("base64url")}.${at.value.split(".")[2]}`;
    await context.addCookies([{ name: "bt_at", value: stale, url: "http://localhost:3001", httpOnly: true }]);
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    const now = (await context.cookies()).find((c) => c.name === "bt_at")!;
    expect(now.value).not.toBe(stale);
    expect(JSON.parse(Buffer.from(now.value.split(".")[1]!, "base64url").toString()).exp * 1000).toBeGreaterThan(Date.now());
  });

  test("first-time setup: a code proves the email, then the person chooses a password; an address on no team gets no special answer", async ({ page }) => {
    // An address that is on no team: the same screen, and a code that cannot be used.
    await page.goto("/login/start");
    await page.getByLabel("Email").fill(mail("nobody2"));
    await page.getByRole("button", { name: "Send me a code" }).click();
    await expect(page.getByTestId("code-sent")).toBeVisible();

    // A team member with no password yet.
    await page.goto("/login/start");
    await page.getByLabel("Email").fill(E.setup);
    await page.getByRole("button", { name: "Send me a code" }).click();
    await expect(page.getByTestId("code-sent")).toContainText(E.setup);
    await createUser(E.setup, { confirmed: true, password: "some long throwaway string" });
    const code = await emailCode(E.setup);
    await page.getByLabel("Code from the email").fill("000000");
    await page.getByLabel("New password", { exact: true }).fill("a brand new password");
    await page.getByLabel("Type it again").fill("a brand new password");
    await page.getByRole("button", { name: "Save password and sign in" }).click();
    await expect(page.getByTestId("login-error")).toContainText("not right");
    await page.getByLabel("Code from the email").fill(code);
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Type it again").fill("short");
    await page.getByRole("button", { name: "Save password and sign in" }).click();
    // The browser's own length check stops it before it is sent.
    await expect(page).toHaveURL(/\/login\/start/);
    await page.getByLabel("New password", { exact: true }).fill("a brand new password");
    await page.getByLabel("Type it again").fill("a different password");
    await page.getByRole("button", { name: "Save password and sign in" }).click();
    await expect(page.getByTestId("login-error")).toContainText("not the same");
    await page.getByLabel("Code from the email").fill(await emailCode(E.setup));
    await page.getByLabel("New password", { exact: true }).fill("a brand new password");
    await page.getByLabel("Type it again").fill("a brand new password");
    await page.getByRole("button", { name: "Save password and sign in" }).click();
    await expect(page).toHaveURL("http://localhost:3001/");
    // The new password works on its own from now on.
    await page.getByTestId("sign-out").click();
    await signIn(page, E.setup, "a brand new password");
    await expect(page).toHaveURL("http://localhost:3001/");
    await page.getByTestId("sign-out").click();
    await signIn(page, E.setup, "some long throwaway string");
    await expect(page.getByTestId("login-error")).toBeVisible();
  });

  test("an invited person chooses a password on the invite page and can then sign in with the role they were given", async ({ page, browser, context }) => {
    await signIn(page, E.owner);
    await expect(page).toHaveURL("http://localhost:3001/");
    await page.goto("/settings/staff");
    await page.getByLabel("Email").fill(E.joiner);
    await page.locator("form").filter({ has: page.getByLabel("Email") }).locator("select").first().selectOption({ index: 0 }).catch(() => undefined);
    await page.getByRole("button", { name: /Send invite|Invite/ }).first().click();
    const link = await page.locator("input[readonly]").first().inputValue();
    expect(link).toMatch(/\/join\/[a-f0-9]{64}$/);
    void context;

    const j = await browser.newContext();
    const jp = await j.newPage();
    await jp.goto(link);
    await jp.getByLabel("Your name").fill("New Joiner");
    await jp.getByLabel("Choose a password").fill("short");
    await jp.getByLabel("Type it again").fill("short");
    await jp.getByRole("button", { name: "Accept invite" }).click();
    await expect(jp.getByLabel("Choose a password")).toBeVisible(); // the browser's own length check
    await jp.getByLabel("Choose a password").fill(PASSWORD);
    await jp.getByLabel("Type it again").fill("something else entirely");
    await jp.getByRole("button", { name: "Accept invite" }).click();
    await expect(jp.getByTestId("join-error")).toContainText("not the same");
    // After a refusal the password boxes are empty again, and the name is still there.
    await expect(jp.getByLabel("Your name")).toHaveValue("New Joiner");
    await jp.getByLabel("Choose a password").fill(PASSWORD);
    await jp.getByLabel("Type it again").fill(PASSWORD);
    await jp.getByRole("button", { name: "Accept invite" }).click();
    await expect(jp.getByTestId("joined")).toBeVisible();
    // The link works once.
    await jp.goto(link);
    await expect(jp.getByText("not valid any more")).toBeVisible();
    await signIn(jp, E.joiner);
    await expect(jp).toHaveURL("http://localhost:3001/");
    expect(await withDb(async (c) => (await c.query(`SELECT role::text AS r, "authUserId" AS a FROM "TenantUser" WHERE email = $1`, [E.joiner])).rows[0] as { r: string; a: string | null })).toMatchObject({ a: expect.any(String) });
    await j.close();
  });

  test("two-factor for a store owner: set up, asked for a code at the next sign-in, wrong codes refused, then turned off with a code", async ({ page, context }) => {
    await signIn(page, E.owner);
    await expect(page).toHaveURL("http://localhost:3001/");
    await page.goto("/security");
    await page.getByTestId("totp-start").click();
    const secret = (await page.getByTestId("totp-secret").innerText()).trim();
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Turn on two-factor" }).click();
    await expect(page.getByTestId("sec-error")).toContainText("not right");
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Turn on two-factor" }).click();
    await expect(page.getByTestId("sec-done")).toBeVisible();

    await page.getByTestId("sign-out").click();
    await signIn(page, E.owner);
    await expect(page).toHaveURL(/\/login\/mfa/);
    // With only the password, nothing behind the sign-in is reachable.
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\/mfa/);
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("login-error")).toBeVisible();
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL("http://localhost:3001/");
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    expect((await context.cookies()).some((c) => c.name === "bt_at")).toBe(true);

    // Turning it off needs a code too.
    await page.goto("/security");
    await expect(page.getByTestId("totp-on")).toBeVisible();
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Turn off two-factor" }).click();
    await expect(page.getByTestId("sec-error")).toBeVisible();
    await page.getByLabel("6-digit code").fill(totp(secret, 0));
    await page.getByRole("button", { name: "Turn off two-factor" }).click();
    await expect(page).toHaveURL(/err=relogin/);
    await signIn(page, E.owner);
    await expect(page).toHaveURL("http://localhost:3001/");
  });

  test("changing the password needs the current one, and the old one stops working", async ({ page }) => {
    await signIn(page, E.owner);
    await expect(page).toHaveURL("http://localhost:3001/");
    await page.goto("/security");
    await page.getByLabel("Current password").fill("not my password at all");
    await page.getByLabel("New password", { exact: true }).fill("my second long password");
    await page.getByLabel("Type it again").fill("my second long password");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByTestId("sec-error")).toContainText("current password");
    // The browser empties the form after a refusal, so every box is filled again.
    await page.getByLabel("Current password").fill(PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill("my second long password");
    await page.getByLabel("Type it again").fill("my second long password");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByTestId("sec-done")).toBeVisible();
    await page.getByTestId("sign-out").click();
    await signIn(page, E.owner);
    await expect(page.getByTestId("login-error")).toBeVisible();
    await signIn(page, E.owner, "my second long password");
    await expect(page).toHaveURL("http://localhost:3001/");
  });

  // ---- The platform team ---------------------------------------------------------------------------------------------

  test("the platform app needs two-factor: a first sign-in is sent to set it up, and nothing opens before it is done", async ({ page }) => {
    await page.goto(`${PLAT}/tenants`);
    await expect(page).toHaveURL(/\/login/);
    await signIn(page, E.platOut, PASSWORD, PLAT);
    await expect(page).toHaveURL(/err=no-access/);
    await expect(page.getByText("not on the platform team")).toBeVisible();

    await signIn(page, E.plat, PASSWORD, PLAT);
    await expect(page).toHaveURL(`${PLAT}/enroll`);
    // Password alone opens nothing.
    for (const path of ["/", "/tenants", "/payments", "/plans"]) {
      await page.goto(`${PLAT}${path}`);
      await expect(page).toHaveURL(/\/enroll/);
    }
    await page.getByTestId("totp-start").click();
    const secret = (await page.getByTestId("totp-secret").innerText()).trim();
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Turn on and continue" }).click();
    await expect(page.getByTestId("sec-error")).toBeVisible();
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Turn on and continue" }).click();
    await expect(page).toHaveURL(`${PLAT}/`);
    await expect(page.getByText("Test platform owner")).toBeVisible();
    await page.goto(`${PLAT}/tenants`);
    await expect(page.getByRole("heading", { name: "Stores" })).toBeVisible();

    await page.getByTestId("sign-out").click();
    await signIn(page, E.plat, PASSWORD, PLAT);
    await expect(page).toHaveURL(/\/login\/mfa/);
    await page.goto(`${PLAT}/payments`);
    await expect(page).toHaveURL(/\/login\/mfa/);
    await page.getByLabel("6-digit code").fill("111111");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("login-error")).toBeVisible();
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(`${PLAT}/`);
  });

  test("a store owner's sign-in opens nothing in the platform app, and the platform's opens nothing in a store", async ({ page, context }) => {
    // (The owner's password was changed above, so a different store account is used.)
    await signIn(page, E.packer);
    await expect(page).toHaveURL("http://localhost:3001/");
    await page.goto(`${PLAT}/tenants`);
    await expect(page).toHaveURL(/\/login/);
    await context.clearCookies();
    await signIn(page, E.platOut, PASSWORD);
    await expect(page).toHaveURL(/err=no-store/);
  });
});
