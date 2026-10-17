import { execSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "apps/marketing/src/app");
const outFile = join(root, "apps/marketing/src/lib/sitemap-dates.json");

function findPageFiles(dir, fileList = []) {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findPageFiles(fullPath, fileList);
    } else if (item === "page.tsx") {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const pages = findPageFiles(appDir);
const manifest = {};
const FALLBACK_DATE = new Date("2026-10-17T00:00:00.000Z").toISOString();

for (const filePath of pages) {
  const rel = relative(appDir, filePath).replace(/\\/g, "/");
  // Convert rel path to route path:
  // "page.tsx" -> "/"
  // "business/page.tsx" -> "/business"
  // "compare/shopify/page.tsx" -> "/compare/shopify"
  let routePath = "/" + rel.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "");
  if (routePath.length > 1 && routePath.endsWith("/")) {
    routePath = routePath.slice(0, -1);
  }

  // Skip dynamic routes like /demo/[template] from static sitemap list if handled separately
  if (routePath.includes("[")) continue;

  try {
    const gitDate = execSync(`git log -1 --format=%cI -- "${filePath}"`, {
      cwd: root,
      encoding: "utf-8",
    }).trim();

    manifest[routePath] = gitDate || FALLBACK_DATE;
  } catch {
    manifest[routePath] = FALLBACK_DATE;
  }
}

// Add static routes like /robots.txt or /sitemap.xml
manifest["/robots.txt"] = manifest["/"] || FALLBACK_DATE;
manifest["/sitemap.xml"] = manifest["/"] || FALLBACK_DATE;

writeFileSync(outFile, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
console.log(`[sitemap-dates] Generated authentic git lastmod dates for ${Object.keys(manifest).length} routes in apps/marketing/src/lib/sitemap-dates.json`);
