// Encrypts the GA4 API secrets and Google OAuth client secrets that stores saved before they were encrypted (StoreSettings columns).
//   pnpm --filter @biztrackbd/core exec tsx scripts/seal-store-secrets.ts            (dry run: counts only, changes nothing)
//   pnpm --filter @biztrackbd/core exec tsx scripts/seal-store-secrets.ts --apply    (does the update)
// Needs DIRECT_URL (owner role) and INTEGRATION_VAULT_SECRET / INTEGRATION_VAULT_KEY_ID in the root .env.local.
//
// SAFETY: it only writes after proving that the vault key in this environment is the one the database was sealed with. It opens an
// existing integration secret (TenantIntegration) with the local key; if none opens, it stops, because values sealed with a different
// key could not be read back by the live apps. Plain values stay readable either way, so skipping this script loses nothing.
import { resolve } from "node:path";
import pg from "pg";
import { decryptSecrets, loadKeyRing } from "../src/vault/crypto";
import { isSealed, sealField } from "../src/vault/field-secret";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* rely on the real environment */
}

const FIELDS = [
  { column: "ga4ApiSecret", field: "ga4ApiSecret" },
  { column: "googleOAuthClientSecret", field: "googleOAuthClientSecret" },
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("DIRECT_URL must be set");
  const ring = loadKeyRing();
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    // 1. Prove the key matches the database.
    const sample = await client.query(`SELECT "tenantId", provider, mode, "secretCipher", "secretKeyId" FROM "TenantIntegration" ORDER BY "createdAt" DESC LIMIT 5`);
    let keyMatches = false;
    for (const r of sample.rows) {
      try {
        decryptSecrets(r.secretCipher, r.secretKeyId, { tenantId: r.tenantId, provider: r.provider, mode: r.mode }, ring);
        keyMatches = true;
        break;
      } catch {
        /* try the next row */
      }
    }
    if (!keyMatches) {
      throw new Error(sample.rows.length === 0
        ? "No existing integration secret to check the vault key against. Refusing to seal anything."
        : "The vault key here cannot open the secrets already in this database, so it is not the live key. Refusing to seal anything.");
    }
    console.log("Vault key check: OK (it opens existing integration secrets).");

    // 2. Find plain values.
    let total = 0;
    for (const { column, field } of FIELDS) {
      const { rows } = await client.query(`SELECT "tenantId", "${column}" AS value FROM "StoreSettings" WHERE "${column}" IS NOT NULL AND "${column}" <> ''`);
      const plain = rows.filter((r) => !isSealed(r.value));
      console.log(`${column}: ${rows.length} saved, ${plain.length} still plain`);
      total += plain.length;
      if (!apply) continue;
      for (const r of plain) {
        await client.query(`UPDATE "StoreSettings" SET "${column}" = $1 WHERE "tenantId" = $2 AND "${column}" = $3`, [sealField(r.value, r.tenantId, field, ring), r.tenantId, r.value]);
      }
    }
    console.log(apply ? `Sealed ${total} value(s).` : `Dry run: ${total} value(s) would be sealed. Run again with --apply.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
