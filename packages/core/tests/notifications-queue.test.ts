import { beforeEach, describe, expect, it } from "vitest";
import { setSmsSender } from "../src/customers/auth";
import { CourierError } from "../src/errors";
import {
  __getMemoryNotificationJobs,
  __resetMemoryNotificationQueue,
  calculateNextRetry,
  enqueueNotificationJob,
  isTransientError,
  processPendingNotificationJobs,
} from "../src/messaging/queue";

describe("Notifications Queue (NOTIFY-001)", () => {
  beforeEach(() => {
    __resetMemoryNotificationQueue();
    // Default mock sender that succeeds
    setSmsSender({
      send: async () => {},
    });
  });

  describe("Error Classification (isTransientError)", () => {
    it("classifies network timeouts and 5xx errors as transient", () => {
      expect(isTransientError(new Error("The SMS provider could not be reached"))).toBe(true);
      expect(isTransientError(new Error("Connection timeout after 10000ms"))).toBe(true);
      expect(isTransientError(new Error("Server answered with status 502"))).toBe(true);
      expect(isTransientError(new CourierError("Unknown provider blip", "SMS", true))).toBe(true);
      expect(isTransientError(new Error("The SMS provider refused the message: 409"))).toBe(true);
    });

    it("classifies balance exhaustion, invalid phone, and blocked content as permanent", () => {
      expect(isTransientError(new Error("The SMS provider refused the message: not enough balance: recharge the SMS account"))).toBe(false);
      expect(isTransientError(new Error("The SMS provider refused the message: no valid phone number"))).toBe(false);
      expect(isTransientError(new Error("The SMS provider refused the message: blocked content"))).toBe(false);
      expect(isTransientError(new Error("The SMS provider refused the message: invalid sender ID"))).toBe(false);
      expect(isTransientError(new Error("The SMS provider refused the message: 416"))).toBe(false);
      expect(isTransientError(new Error("The SMS provider refused the message: 417"))).toBe(false);
    });
  });

  describe("Exponential Backoff Calculation", () => {
    it("calculates 1m, 5m, and 15m intervals accurately", () => {
      const base = new Date("2026-10-17T12:00:00Z");

      const retry1 = calculateNextRetry(1, base);
      expect(retry1.getTime() - base.getTime()).toBe(1 * 60 * 1000); // 1 min

      const retry2 = calculateNextRetry(2, base);
      expect(retry2.getTime() - base.getTime()).toBe(5 * 60 * 1000); // 5 mins

      const retry3 = calculateNextRetry(3, base);
      expect(retry3.getTime() - base.getTime()).toBe(15 * 60 * 1000); // 15 mins

      // Beyond attempt 3 caps at 15 mins
      const retry4 = calculateNextRetry(4, base);
      expect(retry4.getTime() - base.getTime()).toBe(15 * 60 * 1000);
    });
  });

  describe("Enqueue & Immediate Dispatch Lifecycle", () => {
    it("successfully dispatches immediately and marks job as SENT", async () => {
      let sentTo: string | null = null;
      let sentBody: string | null = null;

      setSmsSender({
        send: async (_tenantId, to, text) => {
          sentTo = to;
          sentBody = text;
        },
      });

      const res = await enqueueNotificationJob({
        tenantId: "t_test_001",
        recipient: "01712345678",
        body: "Order BT-100 confirmed!",
        channel: "SMS",
        event: "ORDER_RECEIVED",
        metadata: { orderId: "ord_1" },
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe("SENT");
      expect(sentTo).toBe("01712345678");
      expect(sentBody).toBe("Order BT-100 confirmed!");

      const jobs = __getMemoryNotificationJobs();
      const job = jobs.find((j) => j.id === res.jobId);
      if (job) {
        expect(job.status).toBe("SENT");
        expect(job.attempts).toBe(1);
        expect(job.sentAt).not.toBeNull();
      }
    });

    it("handles transient failure by retaining PENDING status and scheduling next retry", async () => {
      setSmsSender({
        send: async () => {
          throw new Error("The SMS provider could not be reached: etimedout");
        },
      });

      const res = await enqueueNotificationJob({
        tenantId: "t_test_002",
        recipient: "01712345678",
        body: "Order BT-101 confirmed!",
        channel: "SMS",
        event: "ORDER_RECEIVED",
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe("PENDING");
      expect(res.error).toContain("could not be reached");

      const jobs = __getMemoryNotificationJobs();
      const job = jobs.find((j) => j.id === res.jobId);
      if (job) {
        expect(job.status).toBe("PENDING");
        expect(job.attempts).toBe(1);
        expect(job.nextRetryAt).not.toBeNull();
        expect(job.lastError).toContain("could not be reached");
      }
    });

    it("fails fast without retry when receiving permanent provider rejection", async () => {
      setSmsSender({
        send: async () => {
          throw new Error("The SMS provider refused the message: not enough balance: recharge the SMS account");
        },
      });

      const res = await enqueueNotificationJob({
        tenantId: "t_test_003",
        recipient: "01712345678",
        body: "Order BT-102 confirmed!",
        channel: "SMS",
        event: "ORDER_RECEIVED",
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe("FAILED");
      expect(res.error).toContain("not enough balance");

      const jobs = __getMemoryNotificationJobs();
      const job = jobs.find((j) => j.id === res.jobId);
      if (job) {
        expect(job.status).toBe("FAILED");
        expect(job.attempts).toBe(1);
        expect(job.nextRetryAt).toBeNull();
      }
    });

    it("supports queued-only mode without immediate dispatch", async () => {
      let sendCalled = false;
      setSmsSender({
        send: async () => {
          sendCalled = true;
        },
      });

      const res = await enqueueNotificationJob({
        tenantId: "t_test_004",
        recipient: "01712345678",
        body: "Queued background message",
        channel: "SMS",
        event: "ORDER_SHIPPED",
        immediateDispatch: false,
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe("PENDING");
      expect(sendCalled).toBe(false);
    });
  });

  describe("Worker Sweep & Retry Execution (processPendingNotificationJobs)", () => {
    it("sweeps and successfully dispatches due pending jobs", async () => {
      let callCount = 0;
      // Fail on first attempt during enqueue
      setSmsSender({
        send: async () => {
          callCount++;
          if (callCount === 1) throw new Error("timeout");
        },
      });

      const enq = await enqueueNotificationJob({
        tenantId: "t_test_005",
        recipient: "01712345678",
        body: "Order BT-103",
        event: "ORDER_RECEIVED",
      });

      expect(enq.status).toBe("PENDING");

      // Now run sweep with simulated future time (e.g. +2 minutes)
      const future = new Date(Date.now() + 2 * 60 * 1000);
      const sweep = await processPendingNotificationJobs({ now: future });

      expect(sweep.processed).toBe(1);
      expect(sweep.succeeded).toBe(1);

      const jobs = __getMemoryNotificationJobs();
      const job = jobs.find((j) => j.id === enq.jobId);
      if (job) {
        expect(job.status).toBe("SENT");
        expect(job.attempts).toBe(2);
      }
    });

    it("transitions to EXHAUSTED when reaching maximum attempts (3)", async () => {
      setSmsSender({
        send: async () => {
          throw new Error("timeout");
        },
      });

      // Attempt 1: Enqueue
      const enq = await enqueueNotificationJob({
        tenantId: "t_test_006",
        recipient: "01712345678",
        body: "Order BT-104",
        event: "ORDER_RECEIVED",
        maxAttempts: 3,
      });
      expect(enq.status).toBe("PENDING");

      // Attempt 2: Sweep at +2m
      const t2 = new Date(Date.now() + 2 * 60 * 1000);
      const sweep2 = await processPendingNotificationJobs({ now: t2 });
      expect(sweep2.processed).toBe(1);
      expect(sweep2.succeeded).toBe(0);

      // Attempt 3: Sweep at +10m
      const t3 = new Date(Date.now() + 10 * 60 * 1000);
      const sweep3 = await processPendingNotificationJobs({ now: t3 });
      expect(sweep3.processed).toBe(1);
      expect(sweep3.exhausted).toBe(1);

      const jobs = __getMemoryNotificationJobs();
      const job = jobs.find((j) => j.id === enq.jobId);
      if (job) {
        expect(job.status).toBe("EXHAUSTED");
        expect(job.attempts).toBe(3);
        expect(job.nextRetryAt).toBeNull();
      }
    });
  });
});
