import { describe, expect, it } from "vitest";
import {
  detectWebhookAdapter,
  getSampleEventData,
  formatDiscordWebhookPayload,
  formatSlackWebhookPayload,
  formatTelegramWebhookPayload,
  adaptWebhookPayload,
} from "../src/messaging/chat-adapters";

describe("Chat Alert Adapters Suite", () => {
  describe("detectWebhookAdapter", () => {
    it("detects Discord webhook URLs", () => {
      expect(detectWebhookAdapter("https://discord.com/api/webhooks/12345/abcdef")).toBe("discord");
      expect(detectWebhookAdapter("https://discordapp.com/api/webhooks/98765/xyz")).toBe("discord");
    });

    it("detects Slack incoming webhook URLs", () => {
      expect(detectWebhookAdapter("https://hooks.slack.com/services/T000/B000/XXXX")).toBe("slack");
    });

    it("detects Telegram bot webhook URLs", () => {
      expect(detectWebhookAdapter("https://api.telegram.org/bot123456:ABC-DEF/sendMessage?chat_id=-100123456")).toBe("telegram");
    });

    it("respects explicit hash overrides", () => {
      expect(detectWebhookAdapter("https://custom-proxy.internal/webhook#adapter=discord")).toBe("discord");
      expect(detectWebhookAdapter("https://custom-proxy.internal/webhook#adapter=slack")).toBe("slack");
      expect(detectWebhookAdapter("https://custom-proxy.internal/webhook#adapter=telegram")).toBe("telegram");
      expect(detectWebhookAdapter("https://discord.com/api/webhooks/123#adapter=generic")).toBe("generic");
    });

    it("defaults to generic for standard webhooks", () => {
      expect(detectWebhookAdapter("https://hooks.zapier.com/hooks/catch/1234/abcd/")).toBe("generic");
      expect(detectWebhookAdapter("https://hook.eu1.make.com/xyz123")).toBe("generic");
      expect(detectWebhookAdapter("https://example.com/api/webhook")).toBe("generic");
    });
  });

  describe("getSampleEventData", () => {
    it("returns authentic structured sample data for all events", () => {
      const orderCreated = getSampleEventData("order.created");
      expect(orderCreated.orderNumber).toBe("BT-10482");
      expect(orderCreated.total).toBe(2500);

      const orderDelivered = getSampleEventData("order.delivered");
      expect(orderDelivered.trackingCode).toBeDefined();

      const leadCreated = getSampleEventData("lead.created");
      expect(leadCreated.leadType).toBe("Table Reservation");

      const bookingCreated = getSampleEventData("booking.created");
      expect(bookingCreated.serviceTitle).toBeDefined();

      const ping = getSampleEventData("ping");
      expect(ping.status).toBe("healthy");
    });
  });

  describe("formatDiscordWebhookPayload", () => {
    it("creates Discord embed for order.created with color 0x2ecc71", () => {
      const sample = getSampleEventData("order.created");
      const res = formatDiscordWebhookPayload("order.created", sample, "http://localhost:3001");

      expect(res.content).toContain("BT-10482");
      expect(res.embeds).toHaveLength(1);
      const embed = res.embeds[0] as any;
      expect(embed.color).toBe(0x2ecc71);
      expect(embed.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Customer" }),
          expect.objectContaining({ name: "Phone" }),
          expect.objectContaining({ name: "Payment" }),
        ])
      );
    });

    it("creates Discord embed for lead.created with color 0x9b59b6", () => {
      const sample = getSampleEventData("lead.created");
      const res = formatDiscordWebhookPayload("lead.created", sample);
      expect(res.content).toContain("Table Reservation");
      const embed = res.embeds[0] as any;
      expect(embed.color).toBe(0x9b59b6);
    });

    it("creates Discord embed for test ping with color 0x5865f2", () => {
      const sample = getSampleEventData("ping");
      const res = formatDiscordWebhookPayload("ping", sample);
      const embed = res.embeds[0] as any;
      expect(embed.color).toBe(0x5865f2);
      expect(embed.title).toContain("Test Ping Succeeded");
    });
  });

  describe("formatSlackWebhookPayload", () => {
    it("creates Slack Block Kit payload with header, section, and context blocks", () => {
      const sample = getSampleEventData("order.created");
      const res = formatSlackWebhookPayload("order.created", sample);

      expect(res.text).toContain("BT-10482");
      expect(res.blocks).toBeInstanceOf(Array);
      expect(res.blocks[0]).toMatchObject({ type: "header" });
      expect(res.blocks.some((b: any) => b.type === "context")).toBe(true);
    });
  });

  describe("formatTelegramWebhookPayload", () => {
    it("extracts chat_id from query string and formats Markdown", () => {
      const sample = getSampleEventData("order.created");
      const res = formatTelegramWebhookPayload(
        "https://api.telegram.org/bot1234:ABC/sendMessage?chat_id=-100987654321",
        "order.created",
        sample
      );

      expect(res.body.chat_id).toBe("-100987654321");
      expect(res.body.parse_mode).toBe("Markdown");
      expect(res.body.text).toContain("*New Order #BT-10482 Placed!*");
      expect(res.body.text).toContain("Sadia Islam");
      expect(res.body.text).toContain("৳2,500");
    });
  });

  describe("adaptWebhookPayload", () => {
    it("adapts payload for Discord and strips hash from URL", () => {
      const raw = { orderNumber: "BT-999", total: 1000 };
      const res = adaptWebhookPayload(
        "https://discord.com/api/webhooks/123/abc#adapter=discord",
        "order.created",
        raw
      );

      expect(res.url).toBe("https://discord.com/api/webhooks/123/abc");
      expect(res.body).toHaveProperty("embeds");
      expect(res.headers).toEqual({ "Content-Type": "application/json" });
    });

    it("preserves raw JSON envelope for generic webhooks", () => {
      const raw = { event: "order.created", data: { id: "1" } };
      const res = adaptWebhookPayload(
        "https://hooks.zapier.com/hooks/catch/123/456/",
        "order.created",
        raw
      );

      expect(res.url).toBe("https://hooks.zapier.com/hooks/catch/123/456/");
      expect(res.body).toBe(raw);
    });
  });
});
