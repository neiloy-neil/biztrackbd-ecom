import { describe, expect, it } from "vitest";
import {
  calculateSmsParts,
  sendBroadcastCampaign,
  type StaffActor,
  ValidationError,
  ForbiddenError,
} from "../src";

const ownerActor: StaffActor = {
  userId: "user-owner",
  email: "owner@example.com",
  name: "Owner",
  role: "STORE_OWNER",
};

const packerActor: StaffActor = {
  userId: "user-packer",
  email: "packer@example.com",
  name: "Packer",
  role: "ORDER_PACKER",
};

describe("Marketing Suite - SMS Calculation & Unicode", () => {
  it("accurately calculates parts for GSM ASCII messages", () => {
    const shortText = "Flash Sale! Enjoy 20% discount on all orders today.";
    const resShort = calculateSmsParts(shortText);
    expect(resShort.unicode).toBe(false);
    expect(resShort.parts).toBe(1);
    expect(resShort.chars).toBe(shortText.length);

    // Multi-part GSM test (> 160 characters)
    const longText = "A".repeat(165);
    const resLong = calculateSmsParts(longText);
    expect(resLong.unicode).toBe(false);
    expect(resLong.parts).toBe(2);
  });

  it("accurately detects Bangla Unicode and calculates 70-character parts", () => {
    const banglaShort = "ধামাকা অফার! সব কেনাকাটায় ২০% ছাড় পান।";
    const res = calculateSmsParts(banglaShort);
    expect(res.unicode).toBe(true);
    expect(res.parts).toBe(1);

    // Multi-part Unicode (> 70 characters)
    const banglaLong = "বাংলা ".repeat(25); // ~125 characters
    const resLong = calculateSmsParts(banglaLong);
    expect(resLong.unicode).toBe(true);
    expect(resLong.parts).toBeGreaterThanOrEqual(2);
  });
});

describe("Marketing Suite - Campaign Input Validations", () => {
  it("rejects campaign without valid title or message content", async () => {
    await expect(
      sendBroadcastCampaign("t1", ownerActor, {
        name: "A",
        channel: "SMS",
        targetSegment: "ALL",
        body: "Valid promotional text",
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      sendBroadcastCampaign("t1", ownerActor, {
        name: "Valid Campaign",
        channel: "SMS",
        targetSegment: "ALL",
        body: "Hi",
      })
    ).rejects.toThrow("Message body must be at least 5 characters");
  });

  it("requires subject line when channel is EMAIL", async () => {
    await expect(
      sendBroadcastCampaign("t1", ownerActor, {
        name: "Valid Email Blast",
        channel: "EMAIL",
        targetSegment: "ALL",
        body: "Valid promotional body text",
        subject: "   ",
      })
    ).rejects.toThrow("Email campaigns require a subject line");
  });

  it("forbids non-marketing roles from dispatching campaigns", async () => {
    await expect(
      sendBroadcastCampaign("t1", packerActor, {
        name: "Valid Title",
        channel: "SMS",
        targetSegment: "ALL",
        body: "Valid promotional body text",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("enforces marketing permissions on banner settings", async () => {
    const { getBannerSettings, saveBannerSettings } = await import("../src");
    await expect(getBannerSettings("t1", packerActor)).rejects.toThrow(ForbiddenError);
    await expect(saveBannerSettings("t1", packerActor, { flashSaleActive: true })).rejects.toThrow(ForbiddenError);
  });
});

describe("Marketing Suite - WhatsApp Broadcast Engine & Personalization", () => {
  it("interpolates dynamic template variables correctly", async () => {
    const { interpolateVariables } = await import("../src");
    const template = "Hi {{customerName}}! Welcome to {{storeName}}. Use code {{discountCode}} at {{cartUrl}}.";
    const result = interpolateVariables(template, {
      customerName: "Rahim",
      storeName: "Dhaka Mart",
      discountCode: "EID25",
      cartUrl: "https://dhakamart.com/checkout",
    });

    expect(result).toBe("Hi Rahim! Welcome to Dhaka Mart. Use code EID25 at https://dhakamart.com/checkout.");
  });

  it("handles missing variables gracefully without crashing", async () => {
    const { interpolateVariables } = await import("../src");
    const template = "Hello {{customerName}}, your coupon is {{discountCode}}.";
    const result = interpolateVariables(template, {
      customerName: "Karim",
    });

    expect(result).toBe("Hello Karim, your coupon is {{discountCode}}.");
  });

  it("calculates estimated time with anti-ban pacing for WhatsApp broadcasts", async () => {
    const { estimateAudience } = await import("../src");
    const res = await estimateAudience("cm00000000000000000000001", ownerActor, "WHATSAPP", "ALL", "Special offer!");
    expect(res).toHaveProperty("count");
    expect(res).toHaveProperty("estimatedSeconds");
    expect(res.estimatedSeconds).toBe(res.count * 6);
  });
});
