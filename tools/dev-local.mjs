// Starts the four apps against the LOCAL database with the development stand-in sign-in, writing each app's output to checkup/logs/<app>.log
// so the server side of a crawl can be read afterwards. Usage: node tools/dev-local.mjs   (Ctrl+C stops it)
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));
const logs = resolve(root, "checkup/logs");
mkdirSync(logs, { recursive: true });
const env = { ...process.env, DEV_AUTH: "1", CRON_SECRET: process.env.CRON_SECRET || "local-cron-secret-0123456789" };
const kids = [["storefront", 3000], ["admin", 3001], ["marketing", 3002], ["platform", 3003]].map(([name, port]) => {
  const out = createWriteStream(resolve(logs, `${name}.log`));
  const c = spawn("pnpm", ["exec", "next", "dev", "-p", String(port)], { cwd: resolve(root, "apps", name), env, shell: true });
  c.stdout.pipe(out);
  c.stderr.pipe(out);
  return c;
});
console.log("local apps starting; logs in checkup/logs/");
const stop = () => { for (const k of kids) k.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
