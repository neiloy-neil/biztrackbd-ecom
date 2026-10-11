// Takes the preview pictures for the marketing site's template cards from the running demo stores (docs/38).
//   node tools/demo-previews.mjs [--base http://{host}.localhost:3000]
// Needs the storefront running and the demo stores built (pnpm --filter @biztrackbd/core exec tsx scripts/demo-stores.ts all).
// Writes apps/marketing/public/templates/<template>.webp (desktop, top of the home page) and <template>-phone.webp.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(join(root, "apps/admin/package.json"))("@playwright/test");
const sharp = createRequire(join(root, "packages/media/package.json"))("sharp");
const args = process.argv.slice(2);
const pattern = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://{host}.localhost:3000";
const out = join(root, "apps/marketing/public/templates");
mkdirSync(out, { recursive: true });

const DEMOS = [["kapor", "kapor"], ["gadgetstudio", "gadgetstudio"], ["mini-bunny", "minibunny"], ["axionwear", "axionwear"], ["bindu", "bindu"], ["berber", "berber"]];
const browser = await chromium.launch({ channel: "chrome" });
for (const [id, host] of DEMOS) {
  const url = pattern.replace("{host}", host);
  for (const [suffix, viewport, width] of [["", { width: 1440, height: 900 }, 960], ["-phone", { width: 390, height: 844 }, 390]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: suffix ? 2 : 1, isMobile: Boolean(suffix), hasTouch: Boolean(suffix) });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 120000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    // The dev tools badge and the cookie-style overlays are not part of the store.
    await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast] { display: none !important; }" });
    await page.waitForTimeout(800);
    const png = await page.screenshot({ type: "png" });
    const file = join(out, `${id}${suffix}.webp`);
    await sharp(png).resize({ width }).webp({ quality: 78 }).toFile(file);
    console.log(`${id}${suffix}.webp`);
    await ctx.close();
  }
}
await browser.close();
