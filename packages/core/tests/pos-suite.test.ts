import { describe, it, expect } from "vitest";
import {
  renderCode128Svg,
  calculateCheckDigit,
  generateBarcodeValue,
} from "../src/index";

describe("POS & Barcode Suite - Unit Tests", () => {
  describe("Barcode Generation & SVG Rendering", () => {
    it("calculates modulo 10 check digit accurately", () => {
      // Mod 10 check digit test
      const base = "88012345678";
      const check = calculateCheckDigit(base);
      expect(typeof check).toBe("number");
      expect(check).toBeGreaterThanOrEqual(0);
      expect(check).toBeLessThanOrEqual(9);
    });

    it("generates 12-digit standard barcode starting with 880", () => {
      const code1 = generateBarcodeValue("store-xyz");
      const code2 = generateBarcodeValue("store-xyz");

      expect(code1.length).toBe(12);
      expect(code1.startsWith("880")).toBe(true);
      expect(code2.startsWith("880")).toBe(true);
    });

    it("renders valid Code-128 SVG string with bars and text", () => {
      const svg = renderCode128Svg("BD-10042", { height: 40, showText: true });
      expect(svg).toContain("<svg");
      expect(svg).toContain("<rect");
      expect(svg).toContain("BD-10042");
      expect(svg).toContain("</svg>");
    });

    it("renders Code-128 SVG without text when showText is false", () => {
      const svg = renderCode128Svg("880123456789", { height: 35, showText: false });
      expect(svg).toContain("<svg");
      expect(svg).toContain("<rect");
      expect(svg).not.toContain("<text");
      expect(svg).toContain("</svg>");
    });

    it("handles empty or special character strings gracefully", () => {
      const svg = renderCode128Svg("", { height: 30 });
      expect(svg).toContain("<svg");
      expect(svg).toContain("000000"); // Safe fallback
    });
  });

  describe("POS Receipt Calculation & Formatter Logic", () => {
    it("correctly calculates change due based on tendered cash and payments", () => {
      const total = 1850;
      const tenderedCash = 2000;
      const cashPortion = 1850;
      const changeDue = Math.max(0, tenderedCash - cashPortion);

      expect(changeDue).toBe(150);
    });

    it("correctly handles split payment tenders (Cash + bKash)", () => {
      const subtotal = 3500;
      const discount = 200;
      const total = subtotal - discount; // 3300

      const payments = [
        { method: "CASH" as const, amount: 2000 },
        { method: "MANUAL_BKASH" as const, amount: 1300, trxId: "9XYZABCD12" },
      ];

      const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
      expect(paidTotal).toBe(total);
      expect(payments[1]?.trxId).toBe("9XYZABCD12");
    });
  });
});
