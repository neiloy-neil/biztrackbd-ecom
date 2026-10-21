import { describe, expect, it } from "vitest";
import { normalizeUddoktaPayBaseUrl } from "../src/payments/uddoktapay";

describe("normalizeUddoktaPayBaseUrl", () => {
  it.each([
    ["https://biztrack.paymently.io", "https://biztrack.paymently.io"],
    ["biztrack.paymently.io", "https://biztrack.paymently.io"],
    ["  https://biztrack.paymently.io/  ", "https://biztrack.paymently.io"],
    ["https://biztrack.paymently.io/api", "https://biztrack.paymently.io"],
    ["biztrack.paymently.io/api/", "https://biztrack.paymently.io"],
    ["http://localhost:4000", "http://localhost:4000"],
  ])("turns %j into %j", (input, expected) => {
    expect(normalizeUddoktaPayBaseUrl(input)).toBe(expected);
  });

  it("rejects empty or non-address input", () => {
    expect(() => normalizeUddoktaPayBaseUrl("   ")).toThrow();
    expect(() => normalizeUddoktaPayBaseUrl("not a url")).toThrow();
  });
});
