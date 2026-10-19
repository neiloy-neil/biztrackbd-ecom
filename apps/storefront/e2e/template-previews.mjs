// Takes the gallery pictures of a template: a desktop picture and a phone picture of a workshop store's home page, stores them in the public
// "template-previews" bucket of Supabase Storage, and reports their addresses to the platform app.
//   node e2e/template-previews.mjs <templateId> <storeUrl>
// Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (storage), PLATFORM_URL and TEMPLATE_PREVIEW_SECRET (the report),
//   NEXT_PUBLIC_ROOT_DOMAIN (the store address must be one of ours). Run by .github/workflows/template-previews.yml.
import { chromium } from "@playwright/test";

const [templateId, storeUrl] = process.argv.slice(2);
const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};
const BUCKET = "template-previews";
const SHOTS = [
  { key: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false },
  { key: "mobile", viewport: { width: 390, height: 844 }, isMobile: true },
];

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(templateId ?? "")) throw new Error("usage: template-previews.mjs <templateId> <storeUrl>");
const root = env("NEXT_PUBLIC_ROOT_DOMAIN").replace(/:\d+$/, "");
const target = new URL(storeUrl ?? "");
// Only a store on our own domain: the address comes from a workflow input, so it is checked here too.
if (!["http:", "https:"].includes(target.protocol) || !(target.hostname === root || target.hostname.endsWith(`.${root}`))) {
  throw new Error(`${target.hostname} is not a store on ${root}`);
}

const base = env("SUPABASE_URL").replace(/\/+$/, "");
const key = env("SUPABASE_SERVICE_ROLE_KEY");
const auth = { apikey: key, authorization: `Bearer ${key}` };

async function ensureBucket() {
  const res = await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 2 * 1024 * 1024, allowed_mime_types: ["image/jpeg"] }),
  });
  if (res.ok || res.status === 409) return;
  if ((await res.text()).toLowerCase().includes("already exists")) return;
  throw new Error(`could not create the bucket (${res.status})`);
}

async function upload(name, data) {
  const path = `${templateId}/${name}-${Date.now()}.jpg`;
  const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...auth, "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
    body: data,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

const browser = await chromium.launch();
const urls = {};
try {
  await ensureBucket();
  for (const s of SHOTS) {
    const ctx = await browser.newContext({ viewport: s.viewport, isMobile: s.isMobile, hasTouch: s.isMobile, deviceScaleFactor: 1, locale: "en-BD" });
    // English, and no popups waiting on a first visit.
    await ctx.addCookies([{ name: "bt_lang", value: "en", url: target.origin }]);
    const page = await ctx.newPage();
    const res = await page.goto(target.href, { waitUntil: "networkidle", timeout: 60_000 });
    if (!res || !res.ok()) throw new Error(`${target.href} answered ${res?.status() ?? "nothing"}`);
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
    // Scroll-reveal sections stay hidden until seen: scroll through once so the top of the page is fully drawn.
    await page.evaluate(async () => { for (let y = 0; y < 1200; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(800);
    const shot = await page.screenshot({ type: "jpeg", quality: 82, fullPage: false });
    urls[s.key] = await upload(s.key, shot);
    await ctx.close();
  }
} finally {
  await browser.close();
}

const report = await fetch(`${env("PLATFORM_URL").replace(/\/+$/, "")}/api/templates/previews`, {
  method: "POST",
  headers: { authorization: `Bearer ${env("TEMPLATE_PREVIEW_SECRET")}`, "content-type": "application/json" },
  body: JSON.stringify({ templateId, ...urls }),
  signal: AbortSignal.timeout(30_000),
});
if (!report.ok) throw new Error(`the platform refused the pictures (${report.status}): ${await report.text()}`);
console.log(`previews saved for ${templateId}`, urls);
