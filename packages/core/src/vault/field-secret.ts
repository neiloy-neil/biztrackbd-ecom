import { decryptSecrets, encryptSecrets, loadKeyRing, type KeyRing } from "./crypto";

/**
 * A single secret kept in an ordinary column (for example a store's GA4 API secret), encrypted with the same vault keys as the
 * integrations. The stored text is `enc:<keyId>:<cipher>`; it is bound to the store and the field, so a copy placed in another store's
 * row or another column fails to open. Text without the `enc:` prefix is a legacy plain value from before this existed: it still reads,
 * and is sealed the next time it is saved.
 */
const PREFIX = "enc:";

export const isSealed = (stored: string | null | undefined): boolean => typeof stored === "string" && stored.startsWith(PREFIX);

const ctx = (tenantId: string, field: string) => ({ tenantId, provider: `field:${field}`, mode: "LIVE" });

export function sealField(plain: string, tenantId: string, field: string, ring: KeyRing = loadKeyRing()): string {
  const { cipher, keyId } = encryptSecrets({ v: plain }, ctx(tenantId, field), ring);
  return `${PREFIX}${keyId}:${cipher}`;
}

/** The secret, or null if nothing is stored or it cannot be opened (key missing or data damaged). Never throws. */
export function openField(stored: string | null | undefined, tenantId: string, field: string, ring?: KeyRing): string | null {
  if (!stored) return null;
  if (!isSealed(stored)) return stored;
  try {
    const rest = stored.slice(PREFIX.length);
    const i = rest.indexOf(":");
    if (i < 1) return null;
    return decryptSecrets(rest.slice(i + 1), rest.slice(0, i), ctx(tenantId, field), ring ?? loadKeyRing()).v ?? null;
  } catch {
    return null;
  }
}
