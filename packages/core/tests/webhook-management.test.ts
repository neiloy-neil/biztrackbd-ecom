import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetMemoryWebhooks,
  generateWebhookSecret,
  validateWebhookUrl,
  getMerchantWebhookOverview,
  saveMerchantWebhookSubscription,
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
});
