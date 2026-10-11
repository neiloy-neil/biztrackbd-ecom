// Artifact-size budget. After `pnpm build`, sums every file the production server traced (the .nft.json files Next writes) per app and
// fails when an app is over its budget. A path that traces the whole repository (the problem fixed in the 11 October 2026 checkup)
// shows up here as hundreds of megabytes. Default budget: 150 MB per app (Vercel's limit for one function is 250 MB unzipped).
//   node tools/check-build-size.mjs [budgetMB]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const budget = Number(process.argv[2] ?? 150) * 1024 * 1024;
const apps = ["admin", "storefront", "platform", "marketing"];
const nft = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== "cache" && n !== "dev") nft(p, out); }
    else if (n.endsWith(".nft.json")) out.push(p);
  }
  return out;
};
let failed = false;
for (const app of apps) {
  const next = join(root, "apps", app, ".next");
  if (!existsSync(join(next, "BUILD_ID"))) { console.log(`${app.padEnd(11)} no production build found (run pnpm build)`); failed = true; continue; }
  const seen = new Set();
  let bytes = 0;
  for (const f of nft(next)) {
    const base = dirname(f);
    for (const rel of JSON.parse(readFileSync(f, "utf8")).files ?? []) {
      const abs = resolve(base, rel);
      if (seen.has(abs)) continue;
      seen.add(abs);
      try { const st = statSync(abs); if (st.isFile()) bytes += st.size; } catch { /* a traced file that no longer exists */ }
    }
  }
  const mb = bytes / 1024 / 1024;
  const over = bytes > budget;
  failed ||= over;
  console.log(`${app.padEnd(11)} ${mb.toFixed(0).padStart(5)} MB traced from ${seen.size} files  ${over ? "OVER BUDGET" : "ok"}`);
}
console.log(`budget ${(budget / 1024 / 1024).toFixed(0)} MB per app`);
process.exit(failed ? 1 : 0);
