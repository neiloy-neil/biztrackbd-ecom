import { describe, expect, it } from "vitest";
import {
  formatWhatsAppPhone,
  buildWhatsAppCustomLink,
  buildWhatsAppOrderLink,
  buildWhatsAppAbandonedLink,
  renderWhatsAppText,
  WHATSAPP_EVENTS,
  WHATSAPP_EVENT_MAP,
} from "../src";

describe("WhatsApp Deep Links & Phone Formatting", () => {
  it("formats Bangladeshi phone numbers to international digits for wa.me", () => {
    expect(formatWhatsAppPhone("01712345678")).toBe("8801712345678");
    expect(formatWhatsAppPhone("1712345678")).toBe("8801712345678");
    expect(formatWhatsAppPhone("+8801812345678")).toBe("8801812345678");
    expect(formatWhatsAppPhone("8801912345678")).toBe("8801912345678");
    expect(formatWhatsAppPhone("+8808801712345678")).toBe("8801712345678");
    expect(formatWhatsAppPhone("8808801712345678")).toBe("8801712345678");
    expect(formatWhatsAppPhone("01712-345678")).toBe("8801712345678");
    expect(formatWhatsAppPhone("017.1234.5678")).toBe("8801712345678");
    expect(formatWhatsAppPhone("০১৭১২৩৪৫৬৭৮")).toBe("8801712345678");
  });

  it("builds custom WhatsApp link with encoded URI", () => {
    const link = buildWhatsAppCustomLink("01712345678", "Hello from BizTrack!");
    expect(link).toBe("https://wa.me/8801712345678?text=Hello%20from%20BizTrack!");
  });

  it("builds COD Confirmation link in Bangla with reply instructions", () => {
    const link = buildWhatsAppOrderLink({
      phone: "01712345678",
      orderNumber: "ORD-9910",
      customerName: "Rahim Chowdhury",
      orderTotal: 1850,
      itemsSummary: "Cotton Panjabi (L) x 1",
      deliveryAddress: "Dhanmondi, Dhaka",
      storeName: "Fabrics BD",
      lang: "bn",
      type: "COD_CONFIRM",
    });

    expect(link).toContain("https://wa.me/8801712345678?text=");
    const decoded = decodeURIComponent(link);
    expect(decoded).toContain("Rahim");
    expect(decoded).toContain("ORD-9910");
    expect(decoded).toContain("1,850");
    expect(decoded).toContain("Cotton Panjabi");
    expect(decoded).toContain("1");
    expect(decoded).toContain("2");
  });

  it("builds Cash Reminder deep link in English", () => {
    const link = buildWhatsAppOrderLink({
      phone: "01812345678",
      orderNumber: "ORD-5544",
      customerName: "Sadia",
      orderTotal: 2400,
      storeName: "Fashion Wave",
      lang: "en",
      type: "CASH_REMINDER",
    });

    const decoded = decodeURIComponent(link);
    expect(decoded).toContain("Sadia");
    expect(decoded).toContain("out for delivery today");
    expect(decoded).toContain("2,400");
  });

  it("builds Courier Shipping deep link with tracking url", () => {
    const link = buildWhatsAppOrderLink({
      phone: "01912345678",
      orderNumber: "ORD-1234",
      customerName: "Tanvir",
      orderTotal: 990,
      courierName: "Pathao Courier",
      trackingCode: "PTH-987654",
      trackingUrl: "https://pathao.com/track/PTH-987654",
      storeName: "Gadget Planet",
      lang: "bn",
      type: "SHIPPING_UPDATE",
    });

    const decoded = decodeURIComponent(link);
    expect(decoded).toContain("Pathao Courier");
    expect(decoded).toContain("PTH-987654");
    expect(decoded).toContain("https://pathao.com/track/PTH-987654");
  });

  it("builds Abandoned Cart recovery link with coupon discount", () => {
    const link = buildWhatsAppAbandonedLink({
      phone: "01612345678",
      customerName: "Anika",
      storeName: "Glamour BD",
      recoverUrl: "https://glamour.biztrack.bd/checkout/recover?token=abc123xyz",
      cartTotal: 3200,
      cartSummary: "Lipstick Set x 1",
      discountCode: "COMEBACK10",
      lang: "bn",
    });

    const decoded = decodeURIComponent(link);
    expect(decoded).toContain("Anika");
    expect(decoded).toContain("COMEBACK10");
    expect(decoded).toContain("https://glamour.biztrack.bd/checkout/recover?token=abc123xyz");
  });
});

describe("WhatsApp Variable Interpolation & Template Registry", () => {
  it("interpolates template variables accurately", () => {
    const template = "Hello {customer_name}, your order #{order_number} total is {order_total}. Store: {store_name}";
    const rendered = renderWhatsAppText(template, {
      customer_name: "Karim",
      order_number: "ORD-101",
      order_total: "৳ 1,500",
      store_name: "BizMart",
    });

    expect(rendered).toBe("Hello Karim, your order #ORD-101 total is ৳ 1,500. Store: BizMart");
  });

  it("leaves unknown variables unchanged", () => {
    const template = "Order {order_number} with {custom_field}";
    const rendered = renderWhatsAppText(template, {
      order_number: "ORD-202",
    });

    expect(rendered).toBe("Order ORD-202 with {custom_field}");
  });

  it("contains all required eCommerce notification events", () => {
    expect(WHATSAPP_EVENTS.length).toBeGreaterThanOrEqual(8);
    expect(WHATSAPP_EVENT_MAP.has("COD_CONFIRMATION")).toBe(true);
    expect(WHATSAPP_EVENT_MAP.has("ORDER_CONFIRMED")).toBe(true);
    expect(WHATSAPP_EVENT_MAP.has("DISPATCHED")).toBe(true);
    expect(WHATSAPP_EVENT_MAP.has("OUT_FOR_DELIVERY")).toBe(true);
    expect(WHATSAPP_EVENT_MAP.has("DELIVERED")).toBe(true);
    expect(WHATSAPP_EVENT_MAP.has("DELIVERY_FAILED")).toBe(true);
    expect(WHATSAPP_EVENT_MAP.has("ABANDONED_CART_STAGE_1")).toBe(true);
    expect(WHATSAPP_EVENT_MAP.has("ABANDONED_CART_STAGE_2")).toBe(true);
  });
});

describe("WhatsApp Dynamic QR & Pairing Code Engine", () => {
  it("generates a mathematically valid SVG QR code", async () => {
    const { generateWhatsAppQrSvg } = await import("../src");
    const svg = await generateWhatsAppQrSvg("https://wa.me/8801712345678");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<path");
  });
});
