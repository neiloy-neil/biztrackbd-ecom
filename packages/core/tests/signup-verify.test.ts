import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailProof, emailProofValid, verificationRequired } from "../src";

describe("email proof for opening a store", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a fresh proof for the same email, ignoring case and spaces", () => {
    const p = createEmailProof("Owner@Example.com ");
    expect(emailProofValid(p, "owner@example.com")).toBe(true);
  });

  it("rejects another email, a missing proof, a changed proof and an old proof", () => {
    const p = createEmailProof("owner@example.com");
    expect(emailProofValid(p, "other@example.com")).toBe(false);
    expect(emailProofValid("", "owner@example.com")).toBe(false);
    const [body, sig] = p.split(".");
    expect(emailProofValid(`${body}.${sig!.slice(1)}x`, "owner@example.com")).toBe(false);
    expect(emailProofValid(p, "owner@example.com", Date.now() + 61 * 60_000)).toBe(false);
  });

  it("can only be switched off outside production", () => {
    vi.stubEnv("SIGNUP_VERIFY", "off");
    vi.stubEnv("NODE_ENV", "test");
    expect(verificationRequired()).toBe(false);
    expect(emailProofValid("", "a@b.co")).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(verificationRequired()).toBe(true);
  });
});
