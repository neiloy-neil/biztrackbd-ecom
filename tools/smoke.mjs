// Smoke test for the live site: the handful of requests that, if they fail, mean real people are looking at an error page.
//   node tools/smoke.mjs                 checks production (biztrack.bd)
//   SMOKE_ROOT=example.test node ...     another root domain; SMOKE_DEMO=0 skips starting a demo (it makes a temporary store)
// Prints one line per check and exits 1 if any failed. Uses no secrets and changes nothing real: the demo it starts is a private,
// temporary copy that the cleanup job deletes within 3 hours.
const ROOT = process.env.SMOKE_ROOT || "biztrack.bd";
const MKT = `https://${ROOT}`;
const ADMIN = `https://admin.${ROOT}`;
const PLATFORM = `https://platform.${ROOT}`;
const STORE = (h) => `https://${h}.${ROOT}`;
const WITH_DEMO = process.env.SMOKE_DEMO !== "0";

const results = [];
async function check(name, fn) {
  const t = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, ms: Date.now() - t, note });
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t, note: e instanceof Error ? e.message : String(e) });
  }
}

const get = async (url, init = {}) => fetch(url, { redirect: "manual", signal: AbortSignal.timeout(45_000), ...init });
function expectStatus(res, ...ok) {
  if (!ok.includes(res.status)) throw new Error(`HTTP ${res.status} (wanted ${ok.join(" or ")})`);
}
function expectText(text, ...needles) {
  for (const n of needles) if (!text.includes(n)) throw new Error(`page does not contain "${n}"`);
}

// ---- marketing
await check("marketing home", async () => { const r = await get(MKT + "/"); expectStatus(r, 200); expectText(await r.text(), "Start free trial", "Try the admin"); });
await check("marketing pricing", async () => { const r = await get(MKT + "/pricing"); expectStatus(r, 200); expectText(await r.text(), "Compare plans"); });
await check("marketing templates", async () => { const r = await get(MKT + "/templates"); expectStatus(r, 200); expectText(await r.text(), "admin-demo-kapor"); });
await check("signup page", async () => { const r = await get(MKT + "/start"); expectStatus(r, 200); });

// ---- storefronts (the demo stores are real tenants, so this goes through host routing and the database)
for (const h of ["kapor", "berber"]) {
  await check(`storefront ${h}`, async () => { const r = await get(STORE(h) + "/"); expectStatus(r, 200); const t = await r.text(); if (t.length < 5000) throw new Error("page is suspiciously small"); });
}
await check("storefront unknown address", async () => { const r = await get(STORE("no-such-store-zz9") + "/"); expectStatus(r, 404); });

// ---- admin and platform: signed-out pages answer, and protected ones send people to sign in rather than failing
await check("admin sign-in page", async () => { const r = await get(ADMIN + "/login"); expectStatus(r, 200); });
await check("admin protected page redirects", async () => { const r = await get(ADMIN + "/orders"); expectStatus(r, 307, 302, 303); });
await check("admin cron refuses strangers", async () => { const r = await get(ADMIN + "/api/cron/demo-sweep"); expectStatus(r, 401, 503); });
await check("admin keeps its pages unframeable", async () => { const r = await get(ADMIN + "/login"); if ((r.headers.get("x-frame-options") || "").toUpperCase() !== "DENY") throw new Error("X-Frame-Options is not DENY"); });
await check("platform sign-in or redirect", async () => { const r = await get(PLATFORM + "/"); expectStatus(r, 200, 307, 302, 303); });
await check("demo chooser", async () => { const r = await get(ADMIN + "/demo"); expectStatus(r, 200); expectText(await r.text(), "demo-open-kapor"); });

// ---- a whole signed-in admin, through the demo: this is the check that proves the layout, the database and the session work together
if (WITH_DEMO) {
  let cookie = "";
  await check("demo starts", async () => {
    const r = await get(ADMIN + "/demo/start?template=kapor");
    expectStatus(r, 303);
    const set = r.headers.getSetCookie?.() ?? [];
    const c = set.find((x) => x.startsWith("bt_demo="));
    if (!c) throw new Error(`no demo cookie (sent to ${r.headers.get("location")})`);
    cookie = c.split(";")[0];
    if ((r.headers.get("location") || "").includes("/demo?msg=")) throw new Error("demo refused: " + decodeURIComponent(r.headers.get("location")));
  });
  if (cookie) {
    const page = async (path) => { const r = await get(ADMIN + path, { headers: { cookie } }); return r; };
    await check("demo dashboard", async () => { const r = await page("/"); expectStatus(r, 200); expectText(await r.text(), "demo-banner", "dash-stats"); });
    await check("demo orders", async () => { const r = await page("/orders"); expectStatus(r, 200); expectText(await r.text(), "orders-table"); });
    await check("demo products", async () => { const r = await page("/products"); expectStatus(r, 200); expectText(await r.text(), "products-table"); });
    await check("demo customers", async () => { const r = await page("/customers"); expectStatus(r, 200); });
    await check("demo settings pages", async () => { for (const p of ["/settings/store", "/settings/notifications", "/settings/invoices", "/settings/shipping"]) { const r = await page(p); expectStatus(r, 200); } });
    await check("demo locks the account", async () => { const r = await page("/billing"); expectStatus(r, 200); expectText(await r.text(), "demo-locked"); });
    await check("demo marketing keep link", async () => {
      const home = await (await page("/")).text();
      const m = /href="(https:\/\/[^"]*\/start\?from=[^"]+)"/.exec(home);
      if (!m) throw new Error("no Keep this store link in the banner");
      const r = await get(m[1].replace(/&amp;/g, "&"));
      expectStatus(r, 200);
      expectText((await r.text()).replace(/<!-- -->/g, ""), "Your demo store comes with you");
    });
  }
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name} (${r.ms} ms)${r.ok ? "" : ": " + r.note}`);
}
console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
