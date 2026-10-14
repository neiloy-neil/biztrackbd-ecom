import { describe, expect, it } from "vitest";
import { SaveProductInput } from "../src";

describe("Variable Products Validation", () => {
  it("parses valid multi-option variants with isActive flag", () => {
    const raw = {
      title: "Premium Panjabi",
      basePrice: 1200,
      variants: [
        {
          title: "M / White / Cotton",
          price: 1200,
          stockQuantity: 10,
          isActive: true,
          options: { Size: "M", Color: "White", Material: "Cotton" },
        },
        {
          title: "L / White / Cotton",
          price: 1250,
          stockQuantity: 0,
          isActive: false,
          options: { Size: "L", Color: "White", Material: "Cotton" },
        },
      ],
    };

    const parsed = SaveProductInput.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.variants).toHaveLength(2);
    expect(parsed.data.variants[0]?.isActive).toBe(true);
    expect(parsed.data.variants[1]?.isActive).toBe(false);
    expect(parsed.data.variants[0]?.options).toEqual({ Size: "M", Color: "White", Material: "Cotton" });
  });

  it("defaults isActive to true when omitted", () => {
    const raw = {
      title: "Simple T-Shirt",
      basePrice: 500,
      variants: [
        {
          title: "Default",
          price: 500,
          stockQuantity: 5,
        },
      ],
    };

    const parsed = SaveProductInput.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.variants[0]?.isActive).toBe(true);
  });
});
