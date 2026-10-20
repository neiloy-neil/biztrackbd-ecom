import { describe, it, expect, beforeEach } from "vitest";
import {
  signDeviceToken,
  verifyDeviceToken,
  resolveClientIp,
  hashClientIp,
  getDhakaDayBucket,
  checkPublicToolQuota,
  incrementPublicToolQuota,
  clearPublicQuotaMemoryCache,
  MAX_DEVICE_DAILY_CHECKS,
  MAX_IP_DAILY_CHECKS,
  MAX_BURST_CHECKS_PER_MIN,
  PUBLIC_TOOL_COURIER_FRAUD,
} from "../src/fraud/quota";

describe("RISK-003: Public Quota & Anti-Abuse Rate Limiter", () => {
  beforeEach(() => {
    clearPublicQuotaMemoryCache();
  });

  describe("HMAC Device Token Security", () => {
    it("generates and verifies valid cryptographic device tokens", () => {
      const deviceId = "b97f0a82-3511-4fa2-93cb-93b591b6e4e1";
      const token = signDeviceToken(deviceId);

      expect(token).toContain(deviceId);
      expect(token.split(".")).toHaveLength(2);

      const verification = verifyDeviceToken(token);
      expect(verification.valid).toBe(true);
      expect(verification.deviceId).toBe(deviceId);
      expect(verification.signedToken).toBe(token);
    });

    it("rejects tampered signatures and automatically issues a fresh signed identity", () => {
      const deviceId = "b97f0a82-3511-4fa2-93cb-93b591b6e4e1";
      const validToken = signDeviceToken(deviceId);
      const parts = validToken.split(".");
      const id = parts[0]!;
      const sig = parts[1]!;

      // Tamper signature
      const tamperedSig = sig.slice(0, -2) + "00";
      const tamperedToken = `${id}.${tamperedSig}`;

      const result = verifyDeviceToken(tamperedToken);
      expect(result.valid).toBe(false);
      expect(result.deviceId).not.toBe(deviceId);
      expect(result.signedToken).toBeDefined();

      // The newly issued token should itself be cryptographically valid
      const reVerify = verifyDeviceToken(result.signedToken);
      expect(reVerify.valid).toBe(true);
      expect(reVerify.deviceId).toBe(result.deviceId);
    });

    it("handles null, empty, or malformed cookie tokens safely", () => {
      const emptyCheck = verifyDeviceToken("");
      expect(emptyCheck.valid).toBe(false);
      expect(emptyCheck.deviceId).toBeDefined();

      const malformedCheck = verifyDeviceToken("just-a-random-string-without-dots");
      expect(malformedCheck.valid).toBe(false);
      expect(malformedCheck.deviceId).toBeDefined();
    });
  });

  describe("Client IP Resolution & Anonymization", () => {
    it("prioritizes reverse-proxy headers (CF-Connecting-IP > X-Real-IP > X-Forwarded-For)", () => {
      const cfHeaders = {
        get: (name: string) => {
          if (name === "cf-connecting-ip") return "203.0.113.195";
          if (name === "x-real-ip") return "198.51.100.1";
          return null;
        },
      };
      expect(resolveClientIp(cfHeaders)).toBe("203.0.113.195");

      const realIpHeaders = {
        get: (name: string) => (name === "x-real-ip" ? "198.51.100.1" : null),
      };
      expect(resolveClientIp(realIpHeaders)).toBe("198.51.100.1");

      const fwdHeaders = {
        get: (name: string) => (name === "x-forwarded-for" ? "103.230.106.12, 10.0.0.1" : null),
      };
      expect(resolveClientIp(fwdHeaders)).toBe("103.230.106.12");

      expect(resolveClientIp(null)).toBe("127.0.0.1");
    });

    it("anonymizes IP with cryptographic salt without storing raw plaintext", () => {
      const ip = "103.230.106.12";
      const hash1 = hashClientIp(ip);
      const hash2 = hashClientIp(ip);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{16}$/);
      expect(hash1).not.toContain(ip);

      const diffIpHash = hashClientIp("103.230.106.13");
      expect(diffIpHash).not.toBe(hash1);
    });
  });

  describe("Asia/Dhaka Day Bucket Calculation", () => {
    it("calculates Bangladesh Standard Time (UTC+6) day boundaries correctly", () => {
      // 2026-10-17 19:30 UTC is 2026-10-18 01:30 in Dhaka (+6)
      const dateUtcNight = new Date("2026-10-17T19:30:00Z");
      expect(getDhakaDayBucket(dateUtcNight)).toBe("2026-10-18");

      // 2026-10-17 17:00 UTC is 2026-10-17 23:00 in Dhaka (+6)
      const dateUtcDay = new Date("2026-10-17T17:00:00Z");
      expect(getDhakaDayBucket(dateUtcDay)).toBe("2026-10-17");
    });
  });

  describe("Durable Quota Enforcement", () => {
    const stamp = Date.now().toString(16);
    // Unique per run: the counts live in the database, so a fixed id fails on the second run against the same database.
    const testDevice = `test-device-${stamp}`;
    const testIpHash = stamp.padStart(16, "a").slice(-16);
    const testDay = "2026-10-17";

    it("allows up to 5 checks per day for a valid device", async () => {
      // Initial check: 5 remaining
      const q0 = await checkPublicToolQuota({
        deviceId: testDevice,
        ipHash: testIpHash,
        dayBucket: testDay,
      });
      expect(q0.allowed).toBe(true);
      expect(q0.remainingChecks).toBe(5);

      // Perform 5 increments
      for (let i = 1; i <= 5; i++) {
        const inc = await incrementPublicToolQuota({
          deviceId: testDevice,
          ipHash: testIpHash,
          dayBucket: testDay,
        });
        expect(inc.deviceCount).toBe(i);
        expect(inc.remainingChecks).toBe(5 - i);
      }

      // 6th check must be blocked
      const qBlocked = await checkPublicToolQuota({
        deviceId: testDevice,
        ipHash: testIpHash,
        dayBucket: testDay,
      });
      expect(qBlocked.allowed).toBe(false);
      expect(qBlocked.rateLimited).toBe(true);
      expect(qBlocked.reason).toBe("DEVICE_QUOTA_EXHAUSTED");
      expect(qBlocked.remainingChecks).toBe(0);
    });

    it("enforces IP safety ceiling when an attacker rotates device cookies", async () => {
      const sharedIpHash = "cgnat-shared-ip-hash-99";
      const baseTime = Date.now();

      // Simulate rotating device IDs to bypass cookie limit across multiple intervals
      for (let i = 1; i <= MAX_IP_DAILY_CHECKS; i++) {
        const rotatingDeviceId = `rotated-device-${i}`;
        await incrementPublicToolQuota({
          deviceId: rotatingDeviceId,
          ipHash: sharedIpHash,
          dayBucket: testDay,
          now: baseTime + i * 70_000,
        });
      }

      // Next request from a brand new device on the same IP must hit IP ceiling
      const brandNewDevice = "brand-new-device-after-ceiling";
      const qCeiling = await checkPublicToolQuota({
        deviceId: brandNewDevice,
        ipHash: sharedIpHash,
        dayBucket: testDay,
        now: baseTime + (MAX_IP_DAILY_CHECKS + 1) * 70_000,
      });

      expect(qCeiling.allowed).toBe(false);
      expect(qCeiling.rateLimited).toBe(true);
      expect(qCeiling.reason).toBe("IP_CEILING_EXCEEDED");
      expect(qCeiling.remainingChecks).toBe(0);
    });

    it("enforces burst throttling when requests exceed rate limit per minute", async () => {
      const burstDevice = "burst-device-uuid";
      const burstIpHash = "burst-ip-hash-55";
      const now = Date.now();

      // Send MAX_BURST_CHECKS_PER_MIN rapidly
      for (let i = 0; i < MAX_BURST_CHECKS_PER_MIN; i++) {
        await incrementPublicToolQuota({
          deviceId: burstDevice,
          ipHash: burstIpHash,
          dayBucket: testDay,
          now: now + i * 100,
        });
      }

      // Next check within same minute window is burst throttled
      const qBurst = await checkPublicToolQuota({
        deviceId: burstDevice,
        ipHash: burstIpHash,
        dayBucket: testDay,
        now: now + 5000,
      });

      expect(qBurst.allowed).toBe(false);
      expect(qBurst.rateLimited).toBe(true);
      expect(qBurst.reason).toBe("BURST_EXCEEDED");
    });

    it("resets quota on day boundary rollover", async () => {
      // Consume all 5 checks on day 1
      for (let i = 0; i < 5; i++) {
        await incrementPublicToolQuota({
          deviceId: "rollover-device",
          ipHash: "rollover-ip",
          dayBucket: "2026-10-17",
        });
      }

      const blockedDay1 = await checkPublicToolQuota({
        deviceId: "rollover-device",
        ipHash: "rollover-ip",
        dayBucket: "2026-10-17",
      });
      expect(blockedDay1.allowed).toBe(false);

      // On next day: quota is completely fresh (5 checks)
      const allowedDay2 = await checkPublicToolQuota({
        deviceId: "rollover-device",
        ipHash: "rollover-ip",
        dayBucket: "2026-10-18",
      });
      expect(allowedDay2.allowed).toBe(true);
      expect(allowedDay2.remainingChecks).toBe(5);
    });
  });
});
