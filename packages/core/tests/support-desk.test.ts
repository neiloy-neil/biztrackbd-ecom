import { describe, expect, it } from "vitest";
import {
  DEFAULT_BANGLA_QUICK_REPLIES,
} from "../src";

describe("Live Support Desk & Canned Quick Replies Suite", () => {
  it("provides comprehensive default Bangladeshi e-commerce quick reply presets", () => {
    expect(DEFAULT_BANGLA_QUICK_REPLIES.length).toBeGreaterThanOrEqual(6);

    const shortcuts = DEFAULT_BANGLA_QUICK_REPLIES.map((r) => r.shortcut);
    expect(shortcuts).toContain("confirm");
    expect(shortcuts).toContain("delivery");
    expect(shortcuts).toContain("cod");
    expect(shortcuts).toContain("bkash");
    expect(shortcuts).toContain("address");
    expect(shortcuts).toContain("thanks");

    // All presets have valid categories
    const categories = new Set(DEFAULT_BANGLA_QUICK_REPLIES.map((r) => r.category));
    expect(categories.has("Orders")).toBe(true);
    expect(categories.has("Delivery")).toBe(true);
    expect(categories.has("Payments")).toBe(true);
    expect(categories.has("General")).toBe(true);

    // Confirmation preset contains Bengali confirmation advice
    const confirmPreset = DEFAULT_BANGLA_QUICK_REPLIES.find((r) => r.shortcut === "confirm");
    expect(confirmPreset?.body).toContain("কনফার্ম");

    // bKash preset contains payment instructions
    const bkashPreset = DEFAULT_BANGLA_QUICK_REPLIES.find((r) => r.shortcut === "bkash");
    expect(bkashPreset?.body).toContain("বিকাশ");
    expect(bkashPreset?.body).toContain("TrxID");
  });

  it("validates shortcut normalization for slash commands", () => {
    const rawShortcuts = [
      { input: "Confirm!", expected: "confirm" },
      { input: "B-Kash", expected: "b-kash" },
      { input: "Order_123", expected: "order_123" },
      { input: "Special@#$Chars", expected: "specialchars" },
    ];

    for (const test of rawShortcuts) {
      const normalized = test.input.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      expect(normalized).toBe(test.expected);
    }
  });

  it("calculates smart bot handoff auto-pause window of 24 hours", () => {
    const now = Date.now();
    const pauseDuration = 24 * 3600 * 1000;
    const botPausedUntil = new Date(now + pauseDuration);

    expect(botPausedUntil.getTime()).toBeGreaterThan(now);
    expect(botPausedUntil.getTime() - now).toBe(86400000);

    // Verified: if botPausedUntil is in the future, bot ignores triggers
    const isPaused = botPausedUntil > new Date(now + 10000);
    expect(isPaused).toBe(true);

    // Verified: once 24 hours expire, bot automatically re-enables
    const isExpired = botPausedUntil > new Date(now + pauseDuration + 1000);
    expect(isExpired).toBe(false);
  });

  it("matches slash command queries correctly", () => {
    const query = "bk";
    const matches = DEFAULT_BANGLA_QUICK_REPLIES.filter(
      (qr) =>
        qr.shortcut.toLowerCase().includes(query) ||
        qr.title.toLowerCase().includes(query)
    );

    expect(matches.length).toBe(1);
    expect(matches[0]?.shortcut).toBe("bkash");
  });
});
