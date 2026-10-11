// Sets the GitHub Actions secrets the deploy workflow needs, from the root .env.local, without ever printing a value.
//   node tools/github-secrets.mjs <owner/repo>          lists which secrets it would set and which are missing
//   node tools/github-secrets.mjs <owner/repo> --yes    sets them (needs `gh auth login` and rights on the repository)
// BACKUP_ENCRYPTION_KEY_HEX must be made by you and kept in a second place too (a backup cannot be opened without it); this tool never makes one.
// Values come from .env.local and .env.production.local (made by tools/make-vercel-env.mjs) keys (or the environment). The Vercel values are not in .env.local: put them there first
// (VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID_ADMIN, VERCEL_PROJECT_ID_STOREFRONT, VERCEL_PROJECT_ID_MARKETING, VERCEL_PROJECT_ID_PLATFORM)
// or add them by hand in the repository settings.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try { process.loadEnvFile(join(root, ".env.local")); } catch { /* use the environment */ }
try { process.loadEnvFile(join(root, ".env.production.local")); } catch { /* generated secrets, if any */ }
const [repo, ...flags] = process.argv.slice(2);
const yes = flags.includes("--yes");
if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) { console.error("usage: node tools/github-secrets.mjs <owner/repo> [--yes]"); process.exit(1); }

// GitHub secret name -> where its value comes from.
const SECRETS = {
  SUPABASE_DB_URL: "SUPABASE_DB_URL",
  BACKUP_ENCRYPTION_KEY_HEX: "BACKUP_ENCRYPTION_KEY_HEX",
  SUPABASE_URL: "SUPABASE_URL",
  SUPABASE_SERVICE_ROLE_KEY: "SUPABASE_SERVICE_ROLE_KEY",
  VERCEL_TOKEN: "VERCEL_TOKEN",
  VERCEL_ORG_ID: "VERCEL_ORG_ID",
  VERCEL_PROJECT_ID_ADMIN: "VERCEL_PROJECT_ID_ADMIN",
  VERCEL_PROJECT_ID_STOREFRONT: "VERCEL_PROJECT_ID_STOREFRONT",
  VERCEL_PROJECT_ID_MARKETING: "VERCEL_PROJECT_ID_MARKETING",
  VERCEL_PROJECT_ID_PLATFORM: "VERCEL_PROJECT_ID_PLATFORM",
};

let missing = 0;
for (const [name, from] of Object.entries(SECRETS)) {
  const value = process.env[from];
  if (!value) { console.log(`missing   ${name}  (set ${from} in .env.local, or add it in the repository settings)`); missing++; continue; }
  if (!yes) { console.log(`would set ${name}  (${value.length} characters)`); continue; }
  const r = spawnSync("gh", ["secret", "set", name, "--repo", repo], { input: value, encoding: "utf8" });
  console.log(r.status === 0 ? `set       ${name}` : `FAILED    ${name}: ${(r.stderr || "").trim().split("\n")[0]}`);
}
console.log(yes ? `\ndone, ${missing} missing` : `\nnothing changed (add --yes to set them); ${missing} missing`);
