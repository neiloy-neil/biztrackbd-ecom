// Loads deploy-env/<app>.env (made by tools/make-vercel-env.mjs) into the matching Vercel project through the Vercel CLI's API command.
//   node tools/vercel-load-env.mjs            shows what would be set (names only, never values)
//   node tools/vercel-load-env.mjs --yes [--apps admin,platform]   sets them (Production only; secrets as "sensitive", which Vercel never shows again)
// Needs `vercel login` to the account that owns the projects biztrack-marketing, -admin, -platform, -storefront. Safe to run again: it replaces values.
// Skips empty values (TODO lines) and the placeholder test wallet numbers, so a test value never reaches production.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const yes = process.argv.includes("--yes");
const PLACEHOLDERS = new Set(["01800000000", "01900000000"]);
const SECRET = /(SECRET|TOKEN|PASSWORD|SALT|API_KEY|SERVICE_ROLE|DATABASE_URL|_KEY_HEX)/;
const PUBLIC_OK = /^NEXT_PUBLIC_/;

const parse = (file) => {
  const out = [];
  for (const line of readFileSync(file, "utf8").replace(/\r/g, "").split("\n")) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)="(.*?)"(?:\s+#.*)?$/);
    if (m) out.push([m[1], m[2]]);
  }
  return out;
};
const vercel = (args, input) => spawnSync("vercel", args, { encoding: "utf8", input, shell: process.platform === "win32" });
const dir = mkdtempSync(join(tmpdir(), "vercel-env-"));

const only = process.argv.includes("--apps") ? process.argv[process.argv.indexOf("--apps") + 1].split(",") : ["marketing", "admin", "platform", "storefront"];
let problems = 0;
for (const app of only) {
  const file = join(root, "deploy-env", `${app}.env`);
  if (!existsSync(file)) { console.log(`${app}: no file (run node tools/make-vercel-env.mjs first)`); problems++; continue; }
  const rows = parse(file);
  const skipped = [], plan = [];
  for (const [key, value] of rows) {
    if (!value) { skipped.push(`${key} (empty)`); continue; }
    if (PLACEHOLDERS.has(value)) { skipped.push(`${key} (test placeholder)`); continue; }
    plan.push({ key, value, type: SECRET.test(key) && !PUBLIC_OK.test(key) ? "sensitive" : "encrypted", target: ["production"] });
  }
  console.log(`${app}: ${plan.length} to set${skipped.length ? `; skipped: ${skipped.join(", ")}` : ""}`);
  if (!yes) continue;
  let ok = 0;
  for (const item of plan) {
    // One variable per call: this API command rejects an array body.
    const f = join(dir, "one.json");
    writeFileSync(f, JSON.stringify(item));
    const r = vercel(["api", `/v10/projects/biztrack-${app}/env?upsert=true`, "-X", "POST", "--input", f, "--raw"]);
    const text = (r.stdout || "") + (r.stderr || "").replace(/<claude-code-hint[^>]*>/g, "");
    let j = null;
    try { j = JSON.parse(text.slice(text.indexOf("{"))); } catch { /* not JSON */ }
    const bad = r.status !== 0 || j?.error || (j?.failed ?? []).length;
    if (bad) { problems++; console.log(`  FAILED ${item.key}: ${j?.error?.message ?? (j?.failed ?? [])[0]?.error?.message ?? text.trim().slice(0, 160)}`); } else ok++;
  }
  console.log(`  set ${ok} of ${plan.length} in biztrack-${app}`);
}
console.log(yes ? (problems ? `\nfinished with ${problems} problem(s)` : "\ndone") : "\nnothing changed (add --yes)");
process.exit(problems ? 1 : 0);
