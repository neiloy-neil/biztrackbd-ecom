import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Tenant secret encryption (docs/04, docs/17). AES-256-GCM.
 * - Each tenant+provider gets its own key, derived from a master key with HKDF, so one leaked
 *   derived key exposes one integration, not the platform.
 * - tenantId, provider and mode are bound in as authenticated data: a ciphertext copied to another
 *   tenant, provider or mode row fails to decrypt instead of silently working.
 * - Master keys live in a keyring so they can be rotated: new writes use the active key id, old
 *   rows keep decrypting with the key id stored beside them until re-encrypted.
 * Layout of the stored string: base64( iv[12] | authTag[16] | ciphertext ).
 */

export interface KeyRing {
  activeKeyId: string;
  keys: Map<string, Buffer>;
}

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultError";
  }
}

export interface SecretContext {
  tenantId: string;
  provider: string;
  mode: string;
}

const KEY_HEX = /^[0-9a-fA-F]{64}$/;

/**
 * INTEGRATION_VAULT_KEYS="v1:<64 hex>,v2:<64 hex>" with INTEGRATION_VAULT_KEY_ID naming the active one.
 * For simple setups INTEGRATION_VAULT_SECRET alone is accepted and registered under INTEGRATION_VAULT_KEY_ID (default v1).
 */
export function loadKeyRing(env: NodeJS.ProcessEnv = process.env): KeyRing {
  const keys = new Map<string, Buffer>();
  for (const part of (env.INTEGRATION_VAULT_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf(":");
    const id = part.slice(0, i);
    const hex = part.slice(i + 1);
    if (i < 1 || !KEY_HEX.test(hex)) throw new VaultError(`INTEGRATION_VAULT_KEYS entry "${id || part.slice(0, 4)}" must be <id>:<64 hex characters>`);
    keys.set(id, Buffer.from(hex, "hex"));
  }
  const activeKeyId = env.INTEGRATION_VAULT_KEY_ID || "v1";
  if (env.INTEGRATION_VAULT_SECRET) {
    if (!KEY_HEX.test(env.INTEGRATION_VAULT_SECRET)) throw new VaultError("INTEGRATION_VAULT_SECRET must be 64 hex characters (32 bytes)");
    if (!keys.has(activeKeyId)) keys.set(activeKeyId, Buffer.from(env.INTEGRATION_VAULT_SECRET, "hex"));
  }
  if (!keys.has(activeKeyId)) throw new VaultError(`No vault key configured for key id "${activeKeyId}"`);
  return { activeKeyId, keys };
}

function deriveKey(master: Buffer, ctx: SecretContext): Buffer {
  const salt = Buffer.from(ctx.tenantId, "utf8");
  const info = Buffer.from(`biztrackbd/integration/${ctx.provider}`, "utf8");
  return Buffer.from(hkdfSync("sha256", master, salt, info, 32));
}

const aad = (ctx: SecretContext) => Buffer.from(`${ctx.tenantId}|${ctx.provider}|${ctx.mode}`, "utf8");

export function encryptSecrets(secrets: Record<string, string>, ctx: SecretContext, ring: KeyRing = loadKeyRing()): { cipher: string; keyId: string } {
  const master = ring.keys.get(ring.activeKeyId)!;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", deriveKey(master, ctx), iv);
  c.setAAD(aad(ctx));
  const body = Buffer.concat([c.update(JSON.stringify(secrets), "utf8"), c.final()]);
  return { cipher: Buffer.concat([iv, c.getAuthTag(), body]).toString("base64"), keyId: ring.activeKeyId };
}

export function decryptSecrets(cipher: string, keyId: string, ctx: SecretContext, ring: KeyRing = loadKeyRing()): Record<string, string> {
  const master = ring.keys.get(keyId);
  if (!master) throw new VaultError(`Vault key "${keyId}" is not available, cannot decrypt`);
  const raw = Buffer.from(cipher, "base64");
  if (raw.length < 29) throw new VaultError("Stored secret is malformed");
  try {
    const d = createDecipheriv("aes-256-gcm", deriveKey(master, ctx), raw.subarray(0, 12));
    d.setAAD(aad(ctx));
    d.setAuthTag(raw.subarray(12, 28));
    const plain = Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
    return JSON.parse(plain) as Record<string, string>;
  } catch {
    // Deliberately uninformative: wrong key, wrong tenant, wrong mode and tampering all look the same.
    throw new VaultError("Could not decrypt the stored secret");
  }
}
