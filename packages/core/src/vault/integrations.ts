import { assertNotInDemo } from "../demo/guard";
import { randomBytes } from "node:crypto";
import { getBasePrisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { decryptSecrets, encryptSecrets, loadKeyRing, VaultError, type KeyRing } from "./crypto";
import { ModeSchema, PROVIDERS, ProviderSchema, type ProviderKey } from "./providers";

type Mode = "TEST" | "LIVE";

export interface IntegrationView {
  id: string;
  provider: ProviderKey;
  label: string;
  mode: Mode;
  status: string;
  config: Record<string, string>;
  /** Which secret fields are stored. The values themselves never leave the vault. */
  secretsSet: Record<string, boolean>;
  /** True when the stored secret cannot be decrypted (key lost or data damaged). The store must re-enter it. */
  unreadable: boolean;
  lastVerifiedAt: Date | null;
  lastError: string | null;
}

export interface SaveIntegrationInput {
  provider: string;
  mode: string;
  /** Plain, displayable settings (pixel id, sender name). */
  config?: Record<string, string>;
  /** Secrets to set. Fields left out or blank keep their stored value, so a form can be saved without re-typing keys. */
  secrets?: Record<string, string>;
}

function clean(values: Record<string, string> | undefined, allowed: readonly string[], what: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values ?? {})) {
    if (!allowed.includes(k)) throw new ValidationError(`Unknown ${what} field "${k}"`);
    if (typeof v !== "string") throw new ValidationError(`${k} must be text`);
    const t = v.trim();
    if (t === "") continue;
    if (t.length > 2000) throw new ValidationError(`${k} is too long`);
    out[k] = t;
  }
  return out;
}

function parseTarget(provider: string, mode: string) {
  const p = ProviderSchema.safeParse(provider);
  const m = ModeSchema.safeParse(mode);
  if (!p.success) throw new ValidationError("Unknown integration");
  if (!m.success) throw new ValidationError("Mode must be TEST or LIVE");
  return { provider: p.data, mode: m.data };
}

const asConfig = (v: unknown): Record<string, string> => (v && typeof v === "object" ? (v as Record<string, string>) : {});

interface IntegrationRow {
  id: string;
  tenantId: string;
  provider: string;
  mode: string;
  status: string;
  config: unknown;
  secretCipher: string;
  secretKeyId: string;
  lastVerifiedAt: Date | null;
  lastError: string | null;
}

function toView(row: IntegrationRow, ring: KeyRing): IntegrationView {
  const provider = row.provider as ProviderKey;
  const spec = PROVIDERS[provider];
  let stored: Record<string, string> = {};
  let unreadable = false;
  try {
    stored = decryptSecrets(row.secretCipher, row.secretKeyId, { tenantId: row.tenantId, provider, mode: row.mode }, ring);
  } catch {
    unreadable = true;
  }
  return {
    id: row.id,
    provider,
    label: spec.label,
    mode: row.mode as Mode,
    status: unreadable ? "NEEDS_ATTENTION" : row.status,
    config: asConfig(row.config),
    unreadable,
    lastVerifiedAt: row.lastVerifiedAt,
    lastError: row.lastError,
    secretsSet: Object.fromEntries(spec.secrets.map((f) => [f, Boolean(stored[f])])),
  };
}

/** Creates or updates one integration for a store. Secrets are encrypted before they touch the database. */
export async function saveIntegration(tenantId: string, input: SaveIntegrationInput, ring: KeyRing = loadKeyRing(), actor?: StaffActor): Promise<IntegrationView> {
  await assertNotInDemo(tenantId, "Changing integration keys");
  if (actor) assertCan(actor, "billing", "edit");
  const { provider, mode } = parseTarget(input.provider, input.mode);
  const spec = PROVIDERS[provider];
  const incomingSecrets = clean(input.secrets, spec.secrets, "secret");
  const incomingConfig = clean(input.config, spec.config, "setting");
  const ctx = { tenantId, provider, mode };

  const row = await withTenant(tenantId, async (tx) => {
    const existing = await tx.tenantIntegration.findFirst({ where: { provider, mode } });
    let secrets = incomingSecrets;
    if (existing) {
      let current: Record<string, string> = {};
      try {
        current = decryptSecrets(existing.secretCipher, existing.secretKeyId, ctx, ring);
      } catch (e) {
        if (!(e instanceof VaultError)) throw e;
        // Unreadable old secret: only a full re-entry can replace it.
      }
      secrets = { ...current, ...incomingSecrets };
    }
    const missing = spec.secrets.filter((f) => !secrets[f]);
    if (missing.length) throw new ValidationError(`Missing: ${missing.join(", ")}`, { fields: missing });

    const { cipher, keyId } = encryptSecrets(secrets, ctx, ring);
    const config = { ...(existing ? asConfig(existing.config) : {}), ...incomingConfig };
    // Field names only. The values, and anything that looks like a secret, never reach the log.
    if (actor) await audit(tx, tenantId, actor, existing ? "integration.updated" : "integration.connected", { provider, mode, keysChanged: Object.keys(incomingSecrets), settingsChanged: Object.keys(incomingConfig) });
    if (existing) {
      return tx.tenantIntegration.update({
        where: { id: existing.id },
        data: { config, secretCipher: cipher, secretKeyId: keyId, status: "CONNECTED", lastError: null },
      });
    }
    return tx.tenantIntegration.create({
      data: { tenantId, provider, mode, config, secretCipher: cipher, secretKeyId: keyId, integrationToken: randomBytes(24).toString("hex") },
    });
  });
  return toView(row, ring);
}

/** Safe for the UI: no secret values, only which fields are set. */
export async function listIntegrations(tenantId: string, ring: KeyRing = loadKeyRing()): Promise<IntegrationView[]> {
  const rows = await withTenant(tenantId, (tx) => tx.tenantIntegration.findMany({ orderBy: [{ provider: "asc" }, { mode: "asc" }] }));
  return rows.map((r) => toView(r, ring));
}

/**
 * Server-side only. Used by the courier and payment adapters right before they call the provider.
 * Never return the result to a browser, log it, or put it in an error message.
 */
export async function loadCredentials(tenantId: string, provider: string, mode: string, ring: KeyRing = loadKeyRing()) {
  const t = parseTarget(provider, mode);
  const row = await withTenant(tenantId, (tx) => tx.tenantIntegration.findFirst({ where: { provider: t.provider, mode: t.mode } }));
  if (!row || row.status === "DISABLED") throw new NotFoundError("Integration");
  const secrets = decryptSecrets(row.secretCipher, row.secretKeyId, { tenantId, provider: t.provider, mode: t.mode }, ring);
  return { secrets, config: asConfig(row.config), integrationToken: row.integrationToken };
}

export async function removeIntegration(tenantId: string, provider: string, mode: string, actor?: StaffActor): Promise<void> {
  await assertNotInDemo(tenantId, "Changing integration keys");
  if (actor) assertCan(actor, "billing", "edit");
  const t = parseTarget(provider, mode);
  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.tenantIntegration.deleteMany({ where: { provider: t.provider, mode: t.mode } });
    if (count === 0) throw new NotFoundError("Integration");
    if (actor) await audit(tx, tenantId, actor, "integration.removed", { provider: t.provider, mode: t.mode });
  });
}

/** Records the outcome of a "test connection" call so the UI can show a green tick or the provider's message. */
export async function recordVerification(tenantId: string, provider: string, mode: string, result: { ok: true } | { ok: false; error: string }): Promise<void> {
  const t = parseTarget(provider, mode);
  await withTenant(tenantId, (tx) =>
    tx.tenantIntegration.updateMany({
      where: { provider: t.provider, mode: t.mode },
      data: result.ok
        ? { status: "CONNECTED", lastVerifiedAt: new Date(), lastError: null }
        : { status: "NEEDS_ATTENTION", lastError: result.error.slice(0, 300) },
    }),
  );
}

/** Issues a new webhook token, which invalidates the old webhook URL. For a leaked URL. */
export async function rotateWebhookToken(tenantId: string, provider: string, mode: string, actor?: StaffActor): Promise<string> {
  await assertNotInDemo(tenantId, "Changing integration keys");
  if (actor) assertCan(actor, "billing", "edit");
  const t = parseTarget(provider, mode);
  const token = randomBytes(24).toString("hex");
  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.tenantIntegration.updateMany({ where: { provider: t.provider, mode: t.mode }, data: { integrationToken: token } });
    if (count === 0) throw new NotFoundError("Integration");
    if (actor) await audit(tx, tenantId, actor, "integration.webhook_rotated", { provider: t.provider, mode: t.mode });
  });
  return token;
}

/** Webhook handlers know only the token in the URL. Resolves it to a store without exposing any other data. */
export async function resolveIntegrationByToken(token: string): Promise<{ tenantId: string; provider: ProviderKey; mode: Mode } | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const rows = await getBasePrisma().$queryRaw<{ tenantId: string; provider: string; mode: string }[]>`
    SELECT "tenantId", provider, mode::text AS mode FROM resolve_integration_by_token(${token})`;
  const r = rows[0];
  return r ? { tenantId: r.tenantId, provider: r.provider as ProviderKey, mode: r.mode as Mode } : null;
}

/** After adding a new vault key: re-encrypts every row of one store that still uses an older key. Returns how many changed. */
export async function reencryptTenantSecrets(tenantId: string, ring: KeyRing = loadKeyRing()): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.tenantIntegration.findMany({ where: { secretKeyId: { not: ring.activeKeyId } } });
    for (const r of rows) {
      const ctx = { tenantId, provider: r.provider, mode: r.mode };
      const { cipher, keyId } = encryptSecrets(decryptSecrets(r.secretCipher, r.secretKeyId, ctx, ring), ctx, ring);
      await tx.tenantIntegration.update({ where: { id: r.id }, data: { secretCipher: cipher, secretKeyId: keyId } });
    }
    return rows.length;
  });
}
