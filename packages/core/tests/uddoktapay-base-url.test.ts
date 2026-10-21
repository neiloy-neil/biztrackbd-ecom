import { describe, expect, it } from "vitest";
import { normalizeUddoktaPayBaseUrl, uddoktaPayUrls } from "../src/payments/uddoktapay";

describe("normalizeUddoktaPayBaseUrl", () => {
  it.each([
    ["https://biztrack.paymently.io", "https://biztrack.paymently.io"],
    ["biztrack.paymently.io", "https://biztrack.paymently.io"],
    ["  https://biztrack.paymently.io/  ", "https://biztrack.paymently.io"],
    ["https://biztrack.paymently.io/api", "https://biztrack.paymently.io"],
    ["biztrack.paymently.io/api/", "https://biztrack.paymently.io"],
    ["http://localhost:4000", "http://localhost:4000"],
    ["https://pay.uddoktapay.com/api/checkout-v2", "https://pay.uddoktapay.com"],
    ["https://pay.uddoktapay.com/api/checkout-v2/", "https://pay.uddoktapay.com"],
    ["https://x.example.com/api/verify-payment", "https://x.example.com"],
    ["https://x.example.com/apiary", "https://x.example.com/apiary"],
  ])("turns %j into %j", (input, expected) => {
    expect(normalizeUddoktaPayBaseUrl(input)).toBe(expected);
  });

  it("rejects empty or non-address input", () => {
    expect(() => normalizeUddoktaPayBaseUrl("   ")).toThrow();
    expect(() => normalizeUddoktaPayBaseUrl("not a url")).toThrow();
  });
});

describe("uddoktaPayUrls", () => {
  it("builds the plan payment addresses on the admin origin", () => {
    expect(uddoktaPayUrls("plan", "https://admin.biztrack.bd")).toEqual({
      webhook: "https://admin.biztrack.bd/api/webhooks/uddoktapay",
      returnUrl: "https://admin.biztrack.bd/api/billing/uddoktapay/callback",
    });
  });

  it("builds a store's addresses on the store's own origin, ignoring a trailing slash", () => {
    expect(uddoktaPayUrls("store", "https://rongdhonu.biztrack.bd/")).toEqual({
      webhook: "https://rongdhonu.biztrack.bd/api/payments/uddoktapay/webhook",
      returnUrl: "https://rongdhonu.biztrack.bd/api/payments/uddoktapay/callback",
    });
    expect(uddoktaPayUrls("store", "https://shop.example.com").webhook).toBe("https://shop.example.com/api/payments/uddoktapay/webhook");
  });
});
