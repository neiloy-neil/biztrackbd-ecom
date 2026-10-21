import { describe, expect, it } from "vitest";
import { loadKeyRing } from "../src/vault/crypto";
import { isSealed, openField, sealField } from "../src/vault/field-secret";

const ring = loadKeyRing({ INTEGRATION_VAULT_SECRET: "a".repeat(64), INTEGRATION_VAULT_KEY_ID: "v1" } as NodeJS.ProcessEnv);
const ring2 = loadKeyRing({ INTEGRATION_VAULT_SECRET: "b".repeat(64), INTEGRATION_VAULT_KEY_ID: "v1" } as NodeJS.ProcessEnv);

describe("sealed single-field secrets", () => {
  it("round-trips and never contains the plain text", () => {
    const sealed = sealField("my-ga4-secret", "tenant_1", "ga4ApiSecret", ring);
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain("my-ga4-secret");
    expect(openField(sealed, "tenant_1", "ga4ApiSecret", ring)).toBe("my-ga4-secret");
  });

  it("two seals of the same value differ (fresh nonce each time)", () => {
    expect(sealField("same", "tenant_1", "f", ring)).not.toBe(sealField("same", "tenant_1", "f", ring));
  });

  it("will not open for another store, another field, or another key", () => {
    const sealed = sealField("secret-value", "tenant_1", "ga4ApiSecret", ring);
    expect(openField(sealed, "tenant_2", "ga4ApiSecret", ring)).toBeNull();
    expect(openField(sealed, "tenant_1", "googleOAuthClientSecret", ring)).toBeNull();
    expect(openField(sealed, "tenant_1", "ga4ApiSecret", ring2)).toBeNull();
  });

  it("reads a legacy plain value as is, and treats empty or damaged input as nothing", () => {
    expect(openField("legacy-plain", "tenant_1", "f", ring)).toBe("legacy-plain");
    expect(isSealed("legacy-plain")).toBe(false);
    expect(openField(null, "tenant_1", "f", ring)).toBeNull();
    expect(openField("", "tenant_1", "f", ring)).toBeNull();
    expect(openField("enc:v1:not-base64-garbage", "tenant_1", "f", ring)).toBeNull();
    expect(openField("enc:broken", "tenant_1", "f", ring)).toBeNull();
  });
});
