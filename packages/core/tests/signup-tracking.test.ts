import { describe, expect, it } from "vitest";
import { SignupInput } from "../src/platform/signup";

const base = {
  ownerName: "Rahim Uddin",
  email: "rahim@example.com",
  phone: "01712345678",
  storeName: "Rahim Fashion",
  subdomain: "rahim-fashion",
};

describe("signup tracking fields never block a signup", () => {
  it("keeps a long Meta click cookie whole (fbc can run past 150 characters)", () => {
    const fbc = `fb.1.1793329441167.${"IwY2xjawN".padEnd(190, "x")}`;
    expect(fbc.length).toBeGreaterThan(150);
    const out = SignupInput.parse({ ...base, fbc });
    expect(out.fbc).toBe(fbc);
  });

  it("cuts an absurdly long value to size instead of rejecting the signup", () => {
    const out = SignupInput.parse({
      ...base,
      fbc: "f".repeat(2000),
      utmCampaign: "c".repeat(500),
      utmSource: "s".repeat(500),
      referrer: "r".repeat(5000),
      userAgent: "u".repeat(5000),
    });
    expect(out.fbc).toHaveLength(500);
    expect(out.utmCampaign).toHaveLength(100);
    expect(out.utmSource).toHaveLength(100);
    expect(out.referrer).toHaveLength(400);
    expect(out.userAgent).toHaveLength(400);
  });

  it("accepts missing and null tracking values", () => {
    const out = SignupInput.parse({ ...base, fbc: null, fbp: undefined });
    expect(out.fbc).toBeNull();
    expect(out.fbp).toBeUndefined();
  });

  it("still rejects a real signup mistake", () => {
    expect(SignupInput.safeParse({ ...base, ownerName: "R" }).success).toBe(false);
    expect(SignupInput.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
  });
});
