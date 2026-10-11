// Mechanical cross-checks between the docs and the code. Prints lists; a person reads them.
//   1. environment variables used in code vs documented in docs/17 and .env.example
//   2. Prisma models vs the tables named in docs/08
//   3. routes in the apps vs routes named in the docs
//   4. cron/API routes in the code vs those the docs mention
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    if (["node_modules", ".next", ".turbo", "test-results", "dist", ".git", "checkup"].includes(n)) continue;
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};
const read = (p) => readFileSync(p, "utf8");
const files = [...walk(join(root, "apps")), ...walk(join(root, "packages"))];
const code = files.filter((f) => /\.(ts|tsx|mjs)$/.test(f) && !/[\\/](tests?|e2e|e2e-real)[\\/]|\.test\.|\.spec\./.test(f));
const docsDir = join(root, "docs");
const docs = readdirSync(docsDir).filter((f) => f.endsWith(".md"));
const docText = Object.fromEntries(docs.map((f) => [f, read(join(docsDir, f))]));
const allDocs = Object.values(docText).join("\n");

// 1. env vars
const used = new Map();
for (const f of code) for (const m of read(f).matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) (used.get(m[1]) ?? used.set(m[1], new Set()).get(m[1])).add(relative(root, f).replace(/\\/g, "/"));
const doc17 = docText["17-environment-variables-and-configuration.md"] ?? "";
const example = existsSync(join(root, ".env.example")) ? read(join(root, ".env.example")) : "";
const SYSTEM = new Set(["NODE_ENV", "NEXT_RUNTIME", "NEXT_PHASE", "CI", "PORT", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "PATH", "HOME", "USERPROFILE", "TEMP", "TMP", "TZ", "npm_lifecycle_event"]);
const undocumented = [...used.keys()].filter((k) => !SYSTEM.has(k) && !doc17.includes(k)).sort();
const notInExample = [...used.keys()].filter((k) => !SYSTEM.has(k) && !example.includes(k)).sort();
const documentedButUnused = [...new Set([...doc17.matchAll(/`([A-Z][A-Z0-9_]{3,})`/g)].map((m) => m[1]))].filter((k) => !used.has(k) && !SYSTEM.has(k) && k === k.toUpperCase() && /_/.test(k)).sort();
console.log("== 1. Environment variables");
console.log("used in code, missing from docs/17:", undocumented.join(", ") || "none");
console.log("used in code, missing from .env.example:", notInExample.join(", ") || "none");
console.log("named in docs/17 but not read by any code:", documentedButUnused.join(", ") || "none");

// 2. models
const schema = read(join(root, "packages/db/prisma/schema.prisma"));
const models = [...schema.matchAll(/^model (\w+) /gm)].map((m) => m[1]);
const doc08 = docText["08-database-schema-and-rls-spec.md"] ?? "";
console.log("\n== 2. Prisma models (" + models.length + ")");
console.log("not named anywhere in docs/08:", models.filter((m) => !new RegExp(`\\b${m}\\b`).test(doc08)).join(", ") || "none");
const docModels = [...new Set([...doc08.matchAll(/model (\w+) \{/g)].map((m) => m[1]))];
console.log("models defined in docs/08 but absent from schema.prisma:", docModels.filter((m) => !models.includes(m)).join(", ") || "none");

// 3. routes
const routes = (app) => files.filter((f) => f.includes(`apps${"\\"}${app}${"\\"}src`) || f.includes(`apps/${app}/src`)).filter((f) => /[\\/](page|route)\.tsx?$/.test(f)).map((f) => "/" + relative(join(root, "apps", app, "src", "app"), dirname(f)).replace(/\\/g, "/").replace(/\([^)]*\)\/?/g, "").replace(/\/$/, "")).map((r) => (r === "/." ? "/" : r)).sort();
console.log("\n== 3. Routes");
for (const app of ["marketing", "admin", "platform", "storefront"]) {
  const r = routes(app);
  console.log(`${app} (${r.length}):`, r.join(" "));
}

// 4. API and cron mentions
console.log("\n== 4. API/cron paths in docs vs code");
const apiPaths = [...new Set([...allDocs.matchAll(/`(\/(?:api|cron)\/[a-zA-Z0-9/_\-\[\]{}.:]+)`/g)].map((m) => m[1]))].sort();
const codeRoutes = new Set(["marketing", "admin", "platform", "storefront"].flatMap((a) => routes(a)));
console.log("documented API paths with no matching route:", apiPaths.filter((p) => ![...codeRoutes].some((r) => r === p || r.startsWith(p.replace(/\{[^}]+\}|\[[^\]]+\]/g, "").replace(/\/$/, "")))).join(" ") || "none");
