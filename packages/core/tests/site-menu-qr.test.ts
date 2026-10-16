import { describe, expect, it } from "vitest";
import {
  buildMenuUrl,
  generateMenuQrSvg,
  generateMenuQrDataUrl,
  generateBatchTableQrs,
  parseCustomTableLabels,
  formatTableOrderMessage,
  UpsertCategorySchema,
  UpsertMenuItemSchema,
} from "../src";

describe("BizTrack Business Restaurant Menu & QR Service", () => {
  it("builds canonical menu URL without table parameter", () => {
    const url = buildMenuUrl({ baseOrigin: "https://dhakabistro.biztrack.me" });
    expect(url).toBe("https://dhakabistro.biztrack.me/menu");
  });

  it("builds canonical menu URL with table parameter", () => {
    const url = buildMenuUrl({
      baseOrigin: "https://dhakabistro.biztrack.me",
      table: "4",
    });
    expect(url).toBe("https://dhakabistro.biztrack.me/menu?table=4");
  });

  it("generates a clean SVG string for print production", async () => {
    const url = "https://dhakabistro.biztrack.me/menu?table=12";
    const svg = await generateMenuQrSvg(url);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("viewBox");
  });

  it("generates a PNG base64 Data URL for digital preview and download", async () => {
    const url = "https://dhakabistro.biztrack.me/menu";
    const dataUrl = await generateMenuQrDataUrl(url);
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(100);
  });

  it("validates menu category schema", () => {
    const valid = UpsertCategorySchema.parse({
      name: "Starters",
      nameBn: "স্টার্টার",
      description: "Delicious starters",
      isActive: true,
    });
    expect(valid.name).toBe("Starters");
    expect(valid.nameBn).toBe("স্টার্টার");

    expect(() =>
      UpsertCategorySchema.parse({
        name: "",
      })
    ).toThrow();
  });

  it("validates menu item schema with price and dietary tags", () => {
    const valid = UpsertMenuItemSchema.parse({
      categoryId: "cat_1",
      name: "Kacchi Biryani",
      nameBn: "কাচ্চি বিরিয়ানি",
      price: 450,
      compareAtPrice: 500,
      dietaryLabels: ["halal", "chef_special"],
    });
    expect(valid.name).toBe("Kacchi Biryani");
    expect(valid.price).toBe(450);
    expect(valid.dietaryLabels).toEqual(["halal", "chef_special"]);

    expect(() =>
      UpsertMenuItemSchema.parse({
        categoryId: "cat_1",
        name: "Bad Item",
        price: -50,
      })
    ).toThrow();
  });

  describe("Batch Table QR Generator & Label Parser", () => {
    it("parses comma-separated and newline-separated custom table labels", () => {
      const input = "Table 1, Table 2\nTable 3, VIP-1, Table 2,  ";
      const labels = parseCustomTableLabels(input);
      expect(labels).toEqual(["Table 1", "Table 2", "Table 3", "VIP-1"]);
    });

    it("returns empty array when input is empty or whitespace", () => {
      expect(parseCustomTableLabels("   ")).toEqual([]);
      expect(parseCustomTableLabels("")).toEqual([]);
    });

    it("generates sequential batch QRs for range mode", async () => {
      const items = await generateBatchTableQrs({
        baseOrigin: "https://dhakabistro.biztrack.me",
        mode: "range",
        rangeStart: 1,
        rangeEnd: 3,
      });

      expect(items).toHaveLength(3);
      expect(items[0]?.table).toBe("1");
      expect(items[0]?.url).toBe("https://dhakabistro.biztrack.me/menu?table=1");
      expect(items[0]?.svg).toContain("<svg");
      expect(items[0]?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);

      expect(items[2]?.table).toBe("3");
      expect(items[2]?.url).toBe("https://dhakabistro.biztrack.me/menu?table=3");
    });

    it("generates batch QRs for custom table labels", async () => {
      const items = await generateBatchTableQrs({
        baseOrigin: "https://dhakabistro.biztrack.me",
        mode: "custom",
        customTables: ["Roof-A", "Patio-2"],
      });

      expect(items).toHaveLength(2);
      expect(items[0]?.table).toBe("Roof-A");
      expect(items[0]?.url).toBe("https://dhakabistro.biztrack.me/menu?table=Roof-A");
      expect(items[1]?.table).toBe("Patio-2");
      expect(items[1]?.url).toBe("https://dhakabistro.biztrack.me/menu?table=Patio-2");
    });

    it("safely clamps range values to prevent excessive generation", async () => {
      const items = await generateBatchTableQrs({
        baseOrigin: "https://dhakabistro.biztrack.me",
        mode: "range",
        rangeStart: -5,
        rangeEnd: 2,
      });
      // Start is clamped to 1, end is 2
      expect(items).toHaveLength(2);
      expect(items[0]?.table).toBe("1");
      expect(items[1]?.table).toBe("2");
    });
  });

  describe("WhatsApp Table Order Formatter", () => {
    it("formats table order ticket with items, prices, and total", () => {
      const message = formatTableOrderMessage({
        storeName: "Sultan's Dine",
        table: "5",
        items: [
          { name: "Kacchi Platter", quantity: 2, price: 450 },
          { name: "Borhani", quantity: 3, price: 80 },
        ],
        total: 1140,
        note: "Extra salad please",
      });

      expect(message).toContain("Table Order — Table 5");
      expect(message).toContain("*Restaurant:* Sultan's Dine");
      expect(message).toContain("• 2x Kacchi Platter — ৳900");
      expect(message).toContain("• 3x Borhani — ৳240");
      expect(message).toContain("*Total Bill:* ৳1,140");
      expect(message).toContain("📝 *Note:* Extra salad please");
      expect(message).toContain("Sent via BizTrack Digital Menu");
    });

    it("formats takeaway order when no table number is present", () => {
      const message = formatTableOrderMessage({
        storeName: "Dhaka Bistro",
        items: [
          { name: "Chicken Burger", quantity: 1, price: 220 },
        ],
        total: 220,
      });

      expect(message).toContain("Takeaway / Dining Order");
      expect(message).not.toContain("Table Order — Table");
      expect(message).not.toContain("📝 *Note:*");
      expect(message).toContain("• 1x Chicken Burger — ৳220");
      expect(message).toContain("*Total Bill:* ৳220");
    });
  });
});
