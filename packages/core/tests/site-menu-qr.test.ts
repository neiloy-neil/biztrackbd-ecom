import { describe, expect, it } from "vitest";
import {
  buildMenuUrl,
  generateMenuQrSvg,
  generateMenuQrDataUrl,
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
});
