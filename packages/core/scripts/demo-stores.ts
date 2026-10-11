// Builds or rebuilds the template demo stores (docs/38). Run from the repository root:
//   pnpm --filter @biztrackbd/core exec tsx scripts/demo-stores.ts [kapor|gadgetstudio|mini-bunny|axionwear|bindu|berber|all] [--target local|supabase]
// Local needs the local database and writes pictures to .uploads. For Supabase it reads the restricted app login and the storage keys from
// .env.local and sets MEDIA_DRIVER=supabase. Safe to run again: each run starts from a clean slate and refuses to touch a store that is not a demo.
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
try { process.loadEnvFile(resolve(root, ".env.local")); } catch { /* use the environment */ }
const args = process.argv.slice(2);
const target = args.includes("--target") ? args[args.indexOf("--target") + 1] : "local";
if (target === "supabase") {
  if (!process.env.SUPABASE_APP_DB_URL) throw new Error("SUPABASE_APP_DB_URL is not set in .env.local");
  process.env.DATABASE_URL = process.env.SUPABASE_APP_DB_URL;
  process.env.MEDIA_DRIVER = "supabase";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "biztrack.bd";
} else {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "localhost:3000";
}
const which = args.find((a) => !a.startsWith("--") && a !== target) ?? "all";

const { resetDemoStore, DEMO_TEMPLATE_IDS } = await import("../src/index");
const media = await import("../../media/src/index");
const sharp = createRequire(resolve(root, "packages/media/package.json"))("sharp");
const driver = media.configuredDriver();

const deps = {
  rasterize: (svg: string) => sharp(Buffer.from(svg)).png().toBuffer() as Promise<Buffer>,
  save: async (tenantId: string, picture: Buffer) => ({ url: (await media.saveImage(tenantId, picture, driver)).url }),
  remove: (tenantId: string, url: string) => media.removeImage(tenantId, url, driver),
};
const ids = which === "all" ? DEMO_TEMPLATE_IDS : [which];
for (const id of ids) {
  const t0 = Date.now();
  const r = await resetDemoStore(id, deps);
  console.log(`${id}: ${r.products} products, ${r.pictures} pictures, ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${r.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`);
}
process.exit(0);
