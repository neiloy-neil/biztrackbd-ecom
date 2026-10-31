import { describe, expect, it } from "vitest";
import { normalizeUddoktaPayBaseUrl, platformOriginFor, setUddoktaPayFetchForTests, uddoktaPayPlanUrls, uddoktaPayUrls, verifyUddoktaPayPayment } from "../src/payments/uddoktapay";

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
  it("builds the plan payment addresses: webhook on the platform app, return page on admin", () => {
    expect(uddoktaPayPlanUrls("https://admin.biztrack.bd/", "https://platform.biztrack.bd")).toEqual({
      webhook: "https://platform.biztrack.bd/api/webhooks/uddoktapay",
      returnUrl: "https://admin.biztrack.bd/api/billing/uddoktapay/callback",
    });
  });

  it("finds the platform origin from the root domain", () => {
    expect(platformOriginFor("biztrack.bd")).toBe("https://platform.biztrack.bd");
    expect(platformOriginFor("localhost:3000")).toBe("http://localhost:3003");
    expect(platformOriginFor(undefined)).toBe("http://localhost:3003");
  });

  it("builds a store's addresses on the store's own origin, ignoring a trailing slash", () => {
    expect(uddoktaPayUrls("store", "https://rongdhonu.biztrack.bd/")).toEqual({
      webhook: "https://rongdhonu.biztrack.bd/api/payments/uddoktapay/webhook",
      returnUrl: "https://rongdhonu.biztrack.bd/api/payments/uddoktapay/callback",
    });
    expect(uddoktaPayUrls("store", "https://shop.example.com").webhook).toBe("https://shop.example.com/api/payments/uddoktapay/webhook");
  });

  it("classifies response as ERROR when status is false or message indicates invalid payment id", async () => {
    setUddoktaPayFetchForTests(async () => {
      return new Response(JSON.stringify({ status: false, message: "Invalid Payment ID" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const res = await verifyUddoktaPayPayment({
      apiKey: "test-key",
      baseUrl: "https://pay.example.com",
      invoiceId: "invalid_id",
    });

    expect(res.status).toBe("ERROR");
    expect(res.message).toBe("Invalid Payment ID");
    setUddoktaPayFetchForTests(undefined);
  });
});
