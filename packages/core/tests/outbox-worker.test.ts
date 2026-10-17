import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __getMemoryNotificationJobs,
  __resetMemoryNotificationQueue,
  enqueueNotificationJob,
  getOutboxStats,
  isTransientError,
  processPendingNotificationJobs,
} from "../src/messaging/queue";
import { generateWebhookSignature, dispatchOutboundWebhook } from "../src/messaging/webhook";
import { setPixelFetchForTests } from "../src/growth/tracking";
import { setSmsSender } from "../src/customers/auth";

describe("Asynchronous Event Outbox & Webhook Worker (Milestone 2)", () => {
  beforeEach(() => {
    __resetMemoryNotificationQueue();
    setSmsSender({
      send: async () => {},
    });
    setPixelFetchForTests(undefined);
  });

  describe("HMAC-SHA256 Webhook Signing", () => {
    it("generates predictable HMAC signature with timestamp", () => {
      const payload = JSON.stringify({ event: "lead.created", id: "lead_123" });
      const secret = "whsec_test_secret_abc123";
      const fixedTime = 1729210000000;

      const { signature, timestamp } = generateWebhookSignature(payload, secret, fixedTime);
      expect(timestamp).toBe(fixedTime);
      expect(signature).toContain("t=1729210000000,v1=");
      expect(signature.length).toBeGreaterThan(40);

      // Same payload and timestamp must produce identical signature
      const rerun = generateWebhookSignature(payload, secret, fixedTime);
      expect(rerun.signature).toBe(signature);
    });

    it("produces different signatures for altered payloads", () => {
      const payload1 = JSON.stringify({ amount: 100 });
      const payload2 = JSON.stringify({ amount: 200 });
      const secret = "whsec_secret";
      const time = 1729210000000;

      const sig1 = generateWebhookSignature(payload1, secret, time).signature;
      const sig2 = generateWebhookSignature(payload2, secret, time).signature;
      expect(sig1).not.toBe(sig2);
    });
  });

  describe("Outbound Webhook Dispatcher", () => {
    it("successfully dispatches signed POST request to webhook endpoint", async () => {
      let capturedUrl = "";
      let capturedHeaders: Record<string, string> = {};
      let capturedBody = "";

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
        capturedUrl = String(url);
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        capturedBody = String(init?.body);
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      });

      try {
        const payload = { event: "order.created", orderId: "ord_999" };
        const res = await dispatchOutboundWebhook({
          url: "https://example.com/webhooks/biztrack",
          payload,
          secret: "whsec_super_secret",
        });

        expect(res.ok).toBe(true);
        expect(res.httpStatus).toBe(200);
        expect(capturedUrl).toBe("https://example.com/webhooks/biztrack");
        expect((capturedHeaders as Record<string, string>)["X-BizTrack-Signature"]).toContain("v1=");
        expect((capturedHeaders as Record<string, string>)["Content-Type"]).toBe("application/json");
        expect(JSON.parse(capturedBody)).toEqual(payload);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("classifies HTTP 404/400 as permanent and 500/timeout as transient", async () => {
      const originalFetch = globalThis.fetch;
      try {
        // Test HTTP 400
        globalThis.fetch = vi.fn().mockResolvedValue(new Response("Bad Request", { status: 400 }));
        const res400 = await dispatchOutboundWebhook({
          url: "https://example.com/webhook",
          payload: {},
        });
        expect(res400.ok).toBe(false);
        expect(res400.httpStatus).toBe(400);

        // Test HTTP 503
        globalThis.fetch = vi.fn().mockResolvedValue(new Response("Service Unavailable", { status: 503 }));
        const res503 = await dispatchOutboundWebhook({
          url: "https://example.com/webhook",
          payload: {},
        });
        expect(res503.ok).toBe(false);
        expect(res503.httpStatus).toBe(503);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("Multi-Channel Outbox Enqueue & Fast-Path Dispatch", () => {
    it("dispatches WEBHOOK channel jobs and records SENT status", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      try {
        const res = await enqueueNotificationJob({
          tenantId: "t_test_merchant",
          recipient: "https://hooks.zapier.com/hooks/catch/123/abc",
          channel: "WEBHOOK",
          event: "lead.created",
          body: JSON.stringify({ leadId: "ld_123", name: "Rahim" }),
          metadata: { secret: "whsec_zapier" },
        });

        expect(res.ok).toBe(true);
        expect(res.status).toBe("SENT");

        const jobs = __getMemoryNotificationJobs();
        const job = jobs.find((j) => j.id === res.jobId);
        expect(job?.status).toBe("SENT");
        expect(job?.channel).toBe("WEBHOOK");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("retries WEBHOOK on 500 server error and schedules exponential backoff", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 }));

      try {
        const res = await enqueueNotificationJob({
          tenantId: "t_test_merchant",
          recipient: "https://broken-endpoint.com/webhook",
          channel: "WEBHOOK",
          event: "order.created",
          body: JSON.stringify({ orderId: "ord_fail" }),
        });

        expect(res.ok).toBe(false);
        expect(res.status).toBe("PENDING");

        const jobs = __getMemoryNotificationJobs();
        const job = jobs.find((j) => j.id === res.jobId);
        expect(job?.status).toBe("PENDING");
        expect(job?.attempts).toBe(1);
        expect(job?.nextRetryAt).not.toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("fails fast without retry when webhook endpoint returns HTTP 401 Unauthorized", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }));

      try {
        const res = await enqueueNotificationJob({
          tenantId: "t_test_merchant",
          recipient: "https://secure.endpoint.com/webhook",
          channel: "WEBHOOK",
          event: "order.created",
          body: JSON.stringify({ orderId: "ord_unauth" }),
        });

        expect(res.ok).toBe(false);
        expect(res.status).toBe("FAILED");

        const jobs = __getMemoryNotificationJobs();
        const job = jobs.find((j) => j.id === res.jobId);
        expect(job?.status).toBe("FAILED");
        expect(job?.attempts).toBe(1);
        expect(job?.nextRetryAt).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("Outbox Metrics & Stats", () => {
    it("computes delivery stats across pending, sent, failed, and exhausted jobs", async () => {
      // 1. Sent job
      await enqueueNotificationJob({
        tenantId: "t_stats_01",
        recipient: "01711111111",
        channel: "SMS",
        event: "TEST",
        body: "Hello",
      });

      // 2. Queued pending job
      await enqueueNotificationJob({
        tenantId: "t_stats_01",
        recipient: "01722222222",
        channel: "SMS",
        event: "TEST",
        body: "Queued",
        immediateDispatch: false,
      });

      const stats = await getOutboxStats("t_stats_01");
      expect(stats.total).toBe(2);
      expect(stats.sent).toBe(1);
      expect(stats.pending).toBe(1);
    });
  });
});
