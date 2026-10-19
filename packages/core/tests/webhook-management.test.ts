import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetMemoryWebhooks,
  generateWebhookSecret,
  validateWebhookUrl,
  getMerchantWebhookOverview,
  saveMerchantWebhookSubscription,
  deleteMerchantWebhookSubscription,
  toggleMerchantWebhookSubscription,
  rotateMerchantWebhookSecret,
  sendTestWebhookPing,
  emitMerchantWebhookEvent,
  WEBHOOK_EVENTS,
  type WebhookEventKey,
} from "../src/messaging/webhook";
import { __getMemoryNotificationJobs, __resetMemoryNotificationQueue } from "../src/messaging/queue";
import { ForbiddenError, ValidationError } from "../src/errors";
import type { StaffActor } from "../src/permissions";

describe("Merchant Webhook Management Suite", () => {
  const ownerActor: StaffActor = {
    userId: "user_owner_1",
    email: "owner@store.com",
    role: "STORE_OWNER",
  };

  const managerActor: StaffActor = {
    userId: "user_mgr_1",
    email: "mgr@store.com",
    role: "STORE_MANAGER",
  };

  const packerActor: StaffActor = {
    userId: "user_pack_1",
    email: "packer@store.com",
    role: "ORDER_PACKER",
  };

  beforeEach(() => {
    __resetMemoryWebhooks();
    __resetMemoryNotificationQueue();
  });

  describe("Webhook Secret & URL Validation", () => {
    it("generates a high-entropy secret with whsec_ prefix", () => {
      const sec1 = generateWebhookSecret();
      const sec2 = generateWebhookSecret();
      expect(sec1.startsWith("whsec_")).toBe(true);
      expect(sec1.length).toBeGreaterThanOrEqual(50);
      expect(sec1).not.toBe(sec2);
    });

    it("accepts valid http and https URLs", () => {
      expect(validateWebhookUrl("https://hooks.zapier.com/hooks/catch/123/abc")).toBe(
        "https://hooks.zapier.com/hooks/catch/123/abc"
      );
      expect(validateWebhookUrl("http://localhost:4000/webhook")).toBe(
        "http://localhost:4000/webhook"
      );
    });

    it("rejects invalid, empty, or non-http protocols", () => {
      expect(() => validateWebhookUrl("")).toThrow(ValidationError);
      expect(() => validateWebhookUrl("   ")).toThrow(ValidationError);
      expect(() => validateWebhookUrl("not-a-valid-url")).toThrow(ValidationError);
      expect(() => validateWebhookUrl("ftp://files.example.com/webhook")).toThrow(ValidationError);
      expect(() => validateWebhookUrl("javascript:alert(1)")).toThrow(ValidationError);
    });
  });

  describe("Access Control & Permission Enforcement", () => {
    it("allows STORE_OWNER and STORE_MANAGER to view and edit webhooks", async () => {
      const overview = await getMerchantWebhookOverview("tenant-1", managerActor);
      expect(overview.subscription).toBeNull();
      expect(overview.availableEvents.length).toBe(WEBHOOK_EVENTS.length);

      const saved = await saveMerchantWebhookSubscription("tenant-1", managerActor, {
        targetUrl: "https://example.com/webhook",
        events: ["order.created"],
        isActive: true,
      });
      expect(saved.targetUrl).toBe("https://example.com/webhook");
    });

    it("rejects ORDER_PACKER from viewing or saving webhooks", async () => {
      await expect(getMerchantWebhookOverview("tenant-1", packerActor)).rejects.toThrow(
        ForbiddenError
      );
      await expect(
        saveMerchantWebhookSubscription("tenant-1", packerActor, {
          targetUrl: "https://example.com/webhook",
          events: ["order.created"],
          isActive: true,
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Subscription Management & Rotation", () => {
    it("saves a valid webhook subscription and auto-generates secret", async () => {
      const saved = await saveMerchantWebhookSubscription("tenant-abc", ownerActor, {
        targetUrl: "https://api.crm.com/leads",
        events: ["lead.created", "booking.created"],
        isActive: true,
      });

      expect(saved.tenantId).toBe("tenant-abc");
      expect(saved.targetUrl).toBe("https://api.crm.com/leads");
      expect(saved.events).toEqual(["lead.created", "booking.created"]);
      expect(saved.secretToken.startsWith("whsec_")).toBe(true);
      expect(saved.isActive).toBe(true);

      const overview = await getMerchantWebhookOverview("tenant-abc", ownerActor);
      expect(overview.subscription?.targetUrl).toBe("https://api.crm.com/leads");
      expect(overview.subscription?.events).toContain("lead.created");
    });

    it("rejects saving without any subscribed events", async () => {
      await expect(
        saveMerchantWebhookSubscription("tenant-abc", ownerActor, {
          targetUrl: "https://api.crm.com/leads",
          events: [],
          isActive: true,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("rotates secret and preserves URL and event subscriptions", async () => {
      const initial = await saveMerchantWebhookSubscription("tenant-rot", ownerActor, {
        targetUrl: "https://hooks.slack.com/services/123",
        events: ["order.created"],
        isActive: true,
      });

      const oldSecret = initial.secretToken;
      const { secretToken: newSecret } = await rotateMerchantWebhookSecret("tenant-rot", ownerActor);

      expect(newSecret.startsWith("whsec_")).toBe(true);
      expect(newSecret).not.toBe(oldSecret);

      const overview = await getMerchantWebhookOverview("tenant-rot", ownerActor);
      expect(overview.subscription?.secretToken).toBe(newSecret);
      expect(overview.subscription?.targetUrl).toBe("https://hooks.slack.com/services/123");
    });
  });

  describe("Live Test Ping Dispatch", () => {
    it("fails with ValidationError if test ping is sent before configuring webhook", async () => {
      await expect(sendTestWebhookPing("tenant-empty", ownerActor)).rejects.toThrow(
        ValidationError
      );
    });

    it("dispatches test ping, records log in history, and computes stats", async () => {
      const originalFetch = globalThis.fetch;
      let sentHeaders: Record<string, string> = {};
      let sentBody = "";

      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        sentHeaders = (init?.headers as Record<string, string>) || {};
        sentBody = String(init?.body);
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      });

      try {
        await saveMerchantWebhookSubscription("tenant-ping", ownerActor, {
          targetUrl: "https://webhook.site/my-test-uuid",
          events: ["order.created"],
          isActive: true,
        });

        const pingRes = await sendTestWebhookPing("tenant-ping", ownerActor);
        expect(pingRes.ok).toBe(true);
        expect(pingRes.httpStatus).toBe(200);

        expect(sentHeaders["X-BizTrack-Signature"]).toContain("t=");
        expect(sentHeaders["X-BizTrack-Signature"]).toContain("v1=");
        expect(JSON.parse(sentBody).event).toBe("ping");

        const overview = await getMerchantWebhookOverview("tenant-ping", ownerActor);
        expect(overview.recentLogs.length).toBe(1);
        expect(overview.recentLogs[0]?.eventType).toBe("ping");
        expect(overview.recentLogs[0]?.isSuccess).toBe(true);
        expect(overview.stats.totalDeliveries).toBe(1);
        expect(overview.stats.successfulDeliveries).toBe(1);
        expect(overview.stats.failedDeliveries).toBe(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("Event Emission & Transactional Outbox Routing", () => {
    it("emits events to outbox only when subscribed and active", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      try {
        await saveMerchantWebhookSubscription("tenant-evt", ownerActor, {
          targetUrl: "https://example.com/receiver",
          events: ["order.created", "lead.created"],
          isActive: true,
        });

        // Subscribed event -> should enqueue and dispatch
        await emitMerchantWebhookEvent("tenant-evt", "order.created", {
          orderNumber: "BT-101",
          total: 1200,
        });

        const jobs = __getMemoryNotificationJobs();
        expect(jobs.length).toBe(1);
        expect(jobs[0]?.channel).toBe("WEBHOOK");
        expect(jobs[0]?.event).toBe("order.created");
        expect(jobs[0]?.recipient).toBe("https://example.com/receiver");

        // Non-subscribed event -> should be silently ignored
        await emitMerchantWebhookEvent("tenant-evt", "booking.created" as WebhookEventKey, {
          bookingId: "b-999",
        });

        expect(__getMemoryNotificationJobs().length).toBe(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("does not emit events if subscription is paused/inactive", async () => {
      await saveMerchantWebhookSubscription("tenant-paused", ownerActor, {
        targetUrl: "https://example.com/receiver",
        events: ["lead.created"],
        isActive: false,
      });

      await emitMerchantWebhookEvent("tenant-paused", "lead.created", {
        leadId: "lead-001",
      });

      expect(__getMemoryNotificationJobs().length).toBe(0);
    });
  });

  describe("Multi-Endpoint Webhook Architecture & Chat Adapters", () => {
    it("supports multiple endpoints per tenant with names, adapters, and independent toggles", async () => {
      const discordSub = await saveMerchantWebhookSubscription("tenant-multi", ownerActor, {
        name: "Discord Sales Alerts",
        targetUrl: "https://discord.com/api/webhooks/123/token-abc",
        adapter: "discord",
        events: ["order.created", "order.delivered"],
        isActive: true,
      });

      const telegramSub = await saveMerchantWebhookSubscription("tenant-multi", ownerActor, {
        name: "Telegram Warehouse Channel",
        targetUrl: "https://api.telegram.org/bot123456:ABC-DEF/sendMessage?chat_id=-100987654321",
        adapter: "telegram",
        events: ["order.created"],
        isActive: true,
      });
      expect(telegramSub.adapter).toBe("telegram");

      const slackSub = await saveMerchantWebhookSubscription("tenant-multi", ownerActor, {
        name: "Slack Ops Team",
        targetUrl: "https://hooks.slack.com/services/T00/B00/X00",
        adapter: "slack",
        events: ["lead.created"],
        isActive: true,
      });

      const overview = await getMerchantWebhookOverview("tenant-multi", ownerActor);
      expect(overview.subscriptions.length).toBe(3);
      expect(overview.subscriptions.map((s) => s.adapter)).toEqual(
        expect.arrayContaining(["discord", "telegram", "slack"])
      );
      expect(overview.subscriptions.map((s) => s.name)).toEqual(
        expect.arrayContaining(["Discord Sales Alerts", "Telegram Warehouse Channel", "Slack Ops Team"])
      );

      // Toggle Discord endpoint to paused
      const toggled = await toggleMerchantWebhookSubscription(
        "tenant-multi",
        ownerActor,
        discordSub.id,
        false
      );
      expect(toggled.isActive).toBe(false);

      const overviewAfterToggle = await getMerchantWebhookOverview("tenant-multi", ownerActor);
      const discordAfter = overviewAfterToggle.subscriptions.find((s) => s.id === discordSub.id);
      expect(discordAfter?.isActive).toBe(false);

      // Delete Slack endpoint
      const delRes = await deleteMerchantWebhookSubscription("tenant-multi", ownerActor, slackSub.id);
      expect(delRes.deleted).toBe(true);

      const overviewAfterDelete = await getMerchantWebhookOverview("tenant-multi", ownerActor);
      expect(overviewAfterDelete.subscriptions.length).toBe(2);
      expect(overviewAfterDelete.subscriptions.some((s) => s.id === slackSub.id)).toBe(false);
    });

    it("dispatches event to all matching active endpoints adapting format per platform", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      try {
        // 1. Discord endpoint for order.created
        await saveMerchantWebhookSubscription("tenant-fanout", ownerActor, {
          name: "Discord Channel",
          targetUrl: "https://discord.com/api/webhooks/999/disc-tok",
          adapter: "discord",
          events: ["order.created"],
          isActive: true,
        });

        // 2. Telegram endpoint for order.created
        await saveMerchantWebhookSubscription("tenant-fanout", ownerActor, {
          name: "Telegram Group",
          targetUrl: "https://api.telegram.org/bot123456:TOKEN/sendMessage?chat_id=-555",
          adapter: "telegram",
          events: ["order.created"],
          isActive: true,
        });

        // 3. Generic endpoint for lead.created only (should NOT receive order.created)
        await saveMerchantWebhookSubscription("tenant-fanout", ownerActor, {
          name: "Zapier Leads",
          targetUrl: "https://hooks.zapier.com/hooks/catch/111/222",
          adapter: "generic",
          events: ["lead.created"],
          isActive: true,
        });

        await emitMerchantWebhookEvent("tenant-fanout", "order.created", {
          orderNumber: "BT-8899",
          customerName: "Rahim Chowdhury",
          total: 3500,
        });

        const jobs = __getMemoryNotificationJobs();
        expect(jobs.length).toBe(2);

        const discordJob = jobs.find((j) => j.recipient.includes("discord.com"));
        const telegramJob = jobs.find((j) => j.recipient.includes("telegram.org"));

        expect(discordJob).toBeDefined();
        expect(discordJob?.recipient).toBe("https://discord.com/api/webhooks/999/disc-tok");
        const parsedDiscord = JSON.parse(discordJob!.body);
        expect(parsedDiscord.embeds).toBeDefined();
        expect(parsedDiscord.embeds[0].title).toContain("Order #BT-8899");

        expect(telegramJob).toBeDefined();
        expect(telegramJob?.recipient).toBe("https://api.telegram.org/bot123456:TOKEN/sendMessage");
        const parsedTelegram = JSON.parse(telegramJob!.body);
        expect(parsedTelegram.chat_id).toBe("-555");
        expect(parsedTelegram.text).toContain("New Order #BT-8899 Placed!");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("sends platform-adapted test pings with custom events", async () => {
      const originalFetch = globalThis.fetch;
      let sentUrl = "";
      let sentBody = "";

      globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
        sentUrl = String(url);
        sentBody = String(init?.body);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      try {
        const sub = await saveMerchantWebhookSubscription("tenant-testping", ownerActor, {
          name: "Slack Channel",
          targetUrl: "https://hooks.slack.com/services/T11/B22/K33",
          adapter: "slack",
          events: ["booking.created"],
          isActive: true,
        });

        const res = await sendTestWebhookPing("tenant-testping", ownerActor, {
          subscriptionId: sub.id,
          event: "booking.created",
        });

        expect(res.ok).toBe(true);
        expect(sentUrl).toBe("https://hooks.slack.com/services/T11/B22/K33");
        const parsedSlack = JSON.parse(sentBody);
        expect(parsedSlack.blocks).toBeDefined();
        expect(parsedSlack.blocks[0].text.text).toContain("Booking Scheduled");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
