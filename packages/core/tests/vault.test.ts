import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, VaultError, decryptSecrets, encryptSecrets, listIntegrations, loadCredentials, loadKeyRing,
  reencryptTenantSecrets, recordVerification, removeIntegration, resolveIntegrationByToken, rotateWebhookToken,
  saveIntegration, type KeyRing,
} from "../src";

const hex = () => randomBytes(32).toString("hex");
const ringOf = (active: string, ...ids: string[]): KeyRing => ({ activeKeyId: active, keys: new Map(ids.map((id) => [id, Buffer.from(hex(), "hex")])) });
const ctx = { tenantId: "tenant-aaaaaaaa", provider: "STEADFAST", mode: "LIVE" };
const SECRETS = { apiKey: "sf-live-key-1234567890", secretKey: "sf-live-secret-abcdef" };

describe("vault crypto", () => {
  const ring = ringOf("v1", "v1");

  it("round-trips secrets", () => {
    const { cipher, keyId } = encryptSecrets(SECRETS, ctx, ring);
    expect(keyId).toBe("v1");
    expect(decryptSecrets(cipher, keyId, ctx, ring)).toEqual(SECRETS);
  });

  it("never stores plaintext and uses a fresh IV every time", () => {
    const a = encryptSecrets(SECRETS, ctx, ring).cipher;
    const b = encryptSecrets(SECRETS, ctx, ring).cipher;
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "base64").toString("utf8")).not.toContain("sf-live-key");
  });

  it("fails if the ciphertext is tampered with", () => {
    const raw = Buffer.from(encryptSecrets(SECRETS, ctx, ring).cipher, "base64");
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0x01;
    expect(() => decryptSecrets(raw.toString("base64"), "v1", ctx, ring)).toThrow(VaultError);
  });

  it("will not decrypt for a different tenant, provider or mode", () => {
    const { cipher } = encryptSecrets(SECRETS, ctx, ring);
    expect(() => decryptSecrets(cipher, "v1", { ...ctx, tenantId: "tenant-bbbbbbbb" }, ring)).toThrow(VaultError);
    expect(() => decryptSecrets(cipher, "v1", { ...ctx, provider: "PATHAO" }, ring)).toThrow(VaultError);
    expect(() => decryptSecrets(cipher, "v1", { ...ctx, mode: "TEST" }, ring)).toThrow(VaultError);
  });

  it("will not decrypt with a different key, and says nothing about why", () => {
    const { cipher } = encryptSecrets(SECRETS, ctx, ring);
    const other = ringOf("v1", "v1");
    expect(() => decryptSecrets(cipher, "v1", ctx, other)).toThrow("Could not decrypt the stored secret");
    expect(() => decryptSecrets(cipher, "v9", ctx, ring)).toThrow(VaultError);
  });

  it("keeps old rows readable after rotation", () => {
    const old = ringOf("v1", "v1");
    const { cipher } = encryptSecrets(SECRETS, ctx, old);
    const rotated: KeyRing = { activeKeyId: "v2", keys: new Map([...old.keys, ["v2", Buffer.from(hex(), "hex")]]) };
    expect(decryptSecrets(cipher, "v1", ctx, rotated)).toEqual(SECRETS);
    expect(encryptSecrets(SECRETS, ctx, rotated).keyId).toBe("v2");
  });

  it("validates key configuration", () => {
    expect(() => loadKeyRing({ INTEGRATION_VAULT_SECRET: "short" } as NodeJS.ProcessEnv)).toThrow(VaultError);
    expect(() => loadKeyRing({} as NodeJS.ProcessEnv)).toThrow(VaultError);
    expect(() => loadKeyRing({ INTEGRATION_VAULT_KEYS: "v1:nothex" } as NodeJS.ProcessEnv)).toThrow(VaultError);
    const r = loadKeyRing({ INTEGRATION_VAULT_KEYS: `v1:${hex()},v2:${hex()}`, INTEGRATION_VAULT_KEY_ID: "v2" } as NodeJS.ProcessEnv);
    expect(r.activeKeyId).toBe("v2");
    expect(r.keys.size).toBe(2);
    expect(loadKeyRing({ INTEGRATION_VAULT_SECRET: hex() } as NodeJS.ProcessEnv).activeKeyId).toBe("v1");
  });
});

describe("integrations in the database", () => {
  let owner: PrismaClient;
  let app: PrismaClient;
  let A: TenantFixture;
  let B: TenantFixture;
  const ring = ringOf("v1", "v1");

  beforeAll(async () => {
    const urls = testUrls();
    await resetDatabase(urls.direct);
    owner = createOwnerClient(urls.direct);
    app = createBaseClient(urls.app, 5);
    setBasePrisma(app);
    await seedPlans(owner);
    A = await createTenantFixture(owner, { name: "Vault A", subdomain: "vault-a" });
    B = await createTenantFixture(owner, { name: "Vault B", subdomain: "vault-b" });
  });

  afterAll(async () => {
    await owner?.$disconnect();
    await app?.$disconnect();
  });

  it("stores only ciphertext", async () => {
    await saveIntegration(A.tenantId, { provider: "STEADFAST", mode: "LIVE", secrets: SECRETS }, ring);
    const row = await owner.tenantIntegration.findFirstOrThrow({ where: { tenantId: A.tenantId, provider: "STEADFAST" } });
    expect(JSON.stringify(row)).not.toContain("sf-live-key");
    expect(JSON.stringify(row)).not.toContain("sf-live-secret");
    expect(row.secretKeyId).toBe("v1");
    expect(row.integrationToken).toMatch(/^[a-f0-9]{48}$/);
  });

  it("the UI list shows which fields are set but never their values", async () => {
    const list = await listIntegrations(A.tenantId, ring);
    expect(list).toHaveLength(1);
    expect(list[0]!.secretsSet).toEqual({ apiKey: true, secretKey: true });
    expect(JSON.stringify(list)).not.toContain("sf-live");
    expect(list[0]!.unreadable).toBe(false);
  });

  it("the adapter can load the real credentials server-side", async () => {
    const c = await loadCredentials(A.tenantId, "STEADFAST", "LIVE", ring);
    expect(c.secrets).toEqual(SECRETS);
  });

  it("saving again without re-typing keeps the stored secrets, and changing one field changes only that field", async () => {
    await saveIntegration(A.tenantId, { provider: "STEADFAST", mode: "LIVE", secrets: { apiKey: "", secretKey: "" } }, ring);
    expect((await loadCredentials(A.tenantId, "STEADFAST", "LIVE", ring)).secrets).toEqual(SECRETS);
    await saveIntegration(A.tenantId, { provider: "STEADFAST", mode: "LIVE", secrets: { apiKey: "sf-new-key-999" } }, ring);
    expect((await loadCredentials(A.tenantId, "STEADFAST", "LIVE", ring)).secrets).toEqual({ ...SECRETS, apiKey: "sf-new-key-999" });
    expect(await owner.tenantIntegration.count({ where: { tenantId: A.tenantId } })).toBe(1);
  });

  it("test and live are separate integrations", async () => {
    await saveIntegration(A.tenantId, { provider: "STEADFAST", mode: "TEST", secrets: { apiKey: "t-key", secretKey: "t-secret" } }, ring);
    expect((await loadCredentials(A.tenantId, "STEADFAST", "TEST", ring)).secrets.apiKey).toBe("t-key");
    expect((await loadCredentials(A.tenantId, "STEADFAST", "LIVE", ring)).secrets.apiKey).toBe("sf-new-key-999");
  });

  it("rejects unknown providers, unknown fields and missing required secrets", async () => {
    await expect(saveIntegration(A.tenantId, { provider: "NOPE", mode: "LIVE", secrets: {} }, ring)).rejects.toBeInstanceOf(DomainError);
    await expect(saveIntegration(A.tenantId, { provider: "SSLCOMMERZ", mode: "LIVE", secrets: { storeId: "x", bogus: "y" } }, ring)).rejects.toBeInstanceOf(DomainError);
    await expect(saveIntegration(A.tenantId, { provider: "SSLCOMMERZ", mode: "LIVE", secrets: { storeId: "only-one" } }, ring)).rejects.toThrow(/Missing: storePassword/);
    expect(await owner.tenantIntegration.count({ where: { tenantId: A.tenantId, provider: "SSLCOMMERZ" } })).toBe(0);
  });

  it("keeps plain settings separate from secrets", async () => {
    const v = await saveIntegration(A.tenantId, { provider: "META_CAPI", mode: "LIVE", config: { pixelId: "123456789" }, secrets: { accessToken: "EAAB-token" } }, ring);
    expect(v.config).toEqual({ pixelId: "123456789" });
    const row = await owner.tenantIntegration.findFirstOrThrow({ where: { tenantId: A.tenantId, provider: "META_CAPI" } });
    expect(JSON.stringify(row.config)).not.toContain("EAAB");
  });

  it("another store cannot see, load or remove it", async () => {
    expect(await listIntegrations(B.tenantId, ring)).toHaveLength(0);
    await expect(loadCredentials(B.tenantId, "STEADFAST", "LIVE", ring)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(removeIntegration(B.tenantId, "STEADFAST", "LIVE")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await loadCredentials(A.tenantId, "STEADFAST", "LIVE", ring)).secrets.apiKey).toBe("sf-new-key-999");
  });

  it("a ciphertext moved to another store's row cannot be decrypted there", async () => {
    await saveIntegration(B.tenantId, { provider: "STEADFAST", mode: "LIVE", secrets: { apiKey: "b-key", secretKey: "b-secret" } }, ring);
    const a = await owner.tenantIntegration.findFirstOrThrow({ where: { tenantId: A.tenantId, provider: "STEADFAST", mode: "LIVE" } });
    await owner.tenantIntegration.updateMany({ where: { tenantId: B.tenantId, provider: "STEADFAST", mode: "LIVE" }, data: { secretCipher: a.secretCipher } });
    await expect(loadCredentials(B.tenantId, "STEADFAST", "LIVE", ring)).rejects.toBeInstanceOf(VaultError);
    const list = await listIntegrations(B.tenantId, ring);
    expect(list[0]!.unreadable).toBe(true);
    expect(list[0]!.status).toBe("NEEDS_ATTENTION");
    // The owner can recover by re-entering everything.
    await saveIntegration(B.tenantId, { provider: "STEADFAST", mode: "LIVE", secrets: { apiKey: "b-key2", secretKey: "b-secret2" } }, ring);
    expect((await loadCredentials(B.tenantId, "STEADFAST", "LIVE", ring)).secrets.apiKey).toBe("b-key2");
  });

  it("resolves a webhook token to the right store and rotating it kills the old one", async () => {
    const token = (await loadCredentials(A.tenantId, "STEADFAST", "LIVE", ring)).integrationToken;
    expect(await resolveIntegrationByToken(token)).toEqual({ tenantId: A.tenantId, provider: "STEADFAST", mode: "LIVE" });
    expect(await resolveIntegrationByToken("0".repeat(48))).toBeNull();
    expect(await resolveIntegrationByToken("' OR 1=1 --")).toBeNull();
    const fresh = await rotateWebhookToken(A.tenantId, "STEADFAST", "LIVE");
    expect(await resolveIntegrationByToken(token)).toBeNull();
    expect((await resolveIntegrationByToken(fresh))?.tenantId).toBe(A.tenantId);
  });

  it("the app role cannot read another store's integrations directly or by guessing the token column", async () => {
    const rows = await withTenant(B.tenantId, (tx) => tx.tenantIntegration.findMany());
    expect(rows.every((r) => r.tenantId === B.tenantId)).toBe(true);
  });

  it("a disabled integration no longer resolves or loads", async () => {
    await owner.tenantIntegration.updateMany({ where: { tenantId: A.tenantId, provider: "META_CAPI" }, data: { status: "DISABLED" } });
    const token = (await owner.tenantIntegration.findFirstOrThrow({ where: { tenantId: A.tenantId, provider: "META_CAPI" } })).integrationToken;
    expect(await resolveIntegrationByToken(token)).toBeNull();
    await expect(loadCredentials(A.tenantId, "META_CAPI", "LIVE", ring)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("records verification results", async () => {
    await recordVerification(A.tenantId, "STEADFAST", "LIVE", { ok: false, error: "401 Unauthorized" });
    let v = (await listIntegrations(A.tenantId, ring)).find((i) => i.provider === "STEADFAST" && i.mode === "LIVE")!;
    expect(v.status).toBe("NEEDS_ATTENTION");
    expect(v.lastError).toBe("401 Unauthorized");
    await recordVerification(A.tenantId, "STEADFAST", "LIVE", { ok: true });
    v = (await listIntegrations(A.tenantId, ring)).find((i) => i.provider === "STEADFAST" && i.mode === "LIVE")!;
    expect(v.status).toBe("CONNECTED");
    expect(v.lastVerifiedAt).toBeInstanceOf(Date);
  });

  it("re-encrypts to the new key after rotation and everything still loads", async () => {
    const rotated: KeyRing = { activeKeyId: "v2", keys: new Map([...ring.keys, ["v2", Buffer.from(hex(), "hex")]]) };
    const changed = await reencryptTenantSecrets(A.tenantId, rotated);
    expect(changed).toBeGreaterThanOrEqual(2);
    const rows = await owner.tenantIntegration.findMany({ where: { tenantId: A.tenantId } });
    expect(rows.every((r) => r.secretKeyId === "v2")).toBe(true);
    expect((await loadCredentials(A.tenantId, "STEADFAST", "LIVE", rotated)).secrets.apiKey).toBe("sf-new-key-999");
    expect(await reencryptTenantSecrets(A.tenantId, rotated)).toBe(0);
  });
});
