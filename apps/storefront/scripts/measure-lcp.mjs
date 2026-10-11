// Measures Largest Contentful Paint on a phone-sized, throttled "4G" connection against a PRODUCTION build.
//   pnpm build && pnpm exec next start -p 3000   (in another terminal), then:  node scripts/measure-lcp.mjs
// Cold cache, fresh browser context per run, median of RUNS. Uses the installed Chrome via Playwright.
import { chromium } from "@playwright/test";

const BASE = process.env.STORE_URL ?? "http://rongdhonu.localhost:3000";
const RUNS = Number(process.env.RUNS ?? 7);
// Lighthouse's mobile profile ("slow 4G"): 1.6 Mbps down, 750 Kbps up, 150 ms round trip, 4x CPU slowdown.
const PROFILE = { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, offline: false };
const FAST = { latency: 70, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8, offline: false };
const PAGES = ["/", "/products/cotton-panjabi-off-white", "/c/panjabi", "/checkout"];

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function once(browser, path, net) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, baseURL: BASE });
  await ctx.addCookies([{ name: "bt_lang", value: "en", url: BASE }]);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", net);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  let bytes = 0;
  page.on("response", async (r) => { try { bytes += (await r.body()).length; } catch { /* redirects have no body */ } });
  await page.goto(path, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls, nav: performance.getEntriesByType("navigation")[0] }));
  await ctx.close();
  return { lcp: Math.round(m.lcp), cls: Number(m.cls.toFixed(3)), ttfb: Math.round(m.nav.responseStart), kb: Math.round(bytes / 1024) };
}

const browser = await chromium.launch({ channel: "chrome" });
let failed = false;
for (const [label, net] of [["slow 4G (Lighthouse mobile)", PROFILE], ["fast 4G", FAST]]) {
  console.log(`\n${label}, ${RUNS} runs, 4x CPU slowdown`);
  for (const path of PAGES) {
    const rs = [];
    for (let i = 0; i < RUNS; i++) rs.push(await once(browser, path, net));
    const lcp = median(rs.map((r) => r.lcp));
    const ok = lcp < 2200;
    if (label.startsWith("slow") && path !== "/checkout" && !ok) failed = true;
    console.log(`  ${path.padEnd(38)} LCP ${String(lcp).padStart(5)} ms ${ok ? "ok  " : "SLOW"}  TTFB ${String(median(rs.map((r) => r.ttfb))).padStart(4)} ms  CLS ${median(rs.map((r) => r.cls))}  ${median(rs.map((r) => r.kb))} KB`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
