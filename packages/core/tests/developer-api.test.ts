import { describe, expect, it, beforeEach } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  isValidTokenFormat,
  maskToken,
  checkRateLimit,
  rateLimitHeaders,
  resetRateLimiter,
  checkIdempotency,
  recordIdempotency,
  authenticateApiKey,
  hasScope,
  API_SCOPES,
  API_SCOPE_PRESETS,
} from "../src/index";

describe("Developer REST API & API Keys Engine", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  describe("Cryptographic Key Generation & Hashing", () => {
    it("generates production live keys with bzk_live_ prefix and 64-char hex entropy", () => {
      const key = generateApiKey("LIVE");
      expect(key.environment).toBe("LIVE");
      expect(key.token.startsWith("bzk_live_")).toBe(true);
      expect(key.token.length).toBe(9 + 64); // "bzk_live_" is 9 chars + 64 hex
      expect(key.keyPrefix.startsWith("bzk_live_")).toBe(true);
      expect(key.keyPrefix.includes("...")).toBe(true);
      expect(key.hashedToken).toBe(hashApiKey(key.token));
      expect(isValidTokenFormat(key.token)).toBe(true);
    });

    it("generates sandbox test keys with bzk_test_ prefix", () => {
      const key = generateApiKey("TEST");
      expect(key.environment).toBe("TEST");
      expect(key.token.startsWith("bzk_test_")).toBe(true);
      expect(key.token.length).toBe(9 + 64);
      expect(key.hashedToken).toBe(hashApiKey(key.token));
      expect(isValidTokenFormat(key.token)).toBe(true);
    });

    it("correctly identifies valid and malformed API keys", () => {
      expect(isValidTokenFormat("")).toBe(false);
      expect(isValidTokenFormat("invalid_token_123")).toBe(false);
      expect(isValidTokenFormat("bzk_live_short")).toBe(false);
      expect(isValidTokenFormat("bzk_custom_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")).toBe(false);

      const validLive = generateApiKey("LIVE").token;
      expect(isValidTokenFormat(validLive)).toBe(true);
      const validTest = generateApiKey("TEST").token;
      expect(isValidTokenFormat(validTest)).toBe(true);
    });

    it("masks tokens securely for logs and telemetry", () => {
      const live = generateApiKey("LIVE").token;
      const masked = maskToken(live);
      expect(masked.startsWith("bzk_live_")).toBe(true);
      expect(masked.includes("...")).toBe(true);
      expect(masked.length).toBeLessThan(live.length);

      expect(maskToken("")).toBe("[REDACTED]");
      expect(maskToken("Bearer something_else")).toBe("[REDACTED_BEARER]");
    });
  });

  describe("Sliding Window Rate Limiter (120 req/min)", () => {
    it("allows up to 120 requests per minute and sets rate limit headers", () => {
      const tenantKey = "tenant_test_100";

      // First request
      const first = checkRateLimit(tenantKey, 120);
      expect(first.allowed).toBe(true);
      expect(first.limit).toBe(120);
      expect(first.remaining).toBe(119);
      expect(first.reset).toBeGreaterThan(Math.floor(Date.now() / 1000));

      const headers = rateLimitHeaders(first);
      expect(headers["X-RateLimit-Limit"]).toBe("120");
      expect(headers["X-RateLimit-Remaining"]).toBe("119");
      expect(headers["X-RateLimit-Reset"]).toBeDefined();
    });

    it("blocks requests once the threshold is exceeded", () => {
      const tenantKey = "tenant_rate_limited";
      const limit = 5; // test with smaller limit

      for (let i = 0; i < limit; i++) {
        const res = checkRateLimit(tenantKey, limit);
        expect(res.allowed).toBe(true);
      }

      // 6th request must be blocked
      const blocked = checkRateLimit(tenantKey, limit);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });

  describe("Scopes & Role Presets", () => {
    it("provides the standard set of 7 granular scopes", () => {
      expect(API_SCOPES.length).toBe(7);
      const scopeIds = API_SCOPES.map((s) => s.id);
      expect(scopeIds).toContain("products:read");
      expect(scopeIds).toContain("products:write");
      expect(scopeIds).toContain("inventory:update");
      expect(scopeIds).toContain("orders:read");
      expect(scopeIds).toContain("orders:write");
      expect(scopeIds).toContain("customers:read");
      expect(scopeIds).toContain("webhooks:manage");
    });

    it("configures standard 1-click role presets", () => {
      expect(API_SCOPE_PRESETS.length).toBe(4);
      const full = API_SCOPE_PRESETS.find((p) => p.id === "full_access");
      expect(full?.scopes.length).toBe(7);

      const erp = API_SCOPE_PRESETS.find((p) => p.id === "erp_inventory_sync");
      expect(erp?.scopes).toContain("inventory:update");
      expect(erp?.scopes).toContain("products:read");

      const pos = API_SCOPE_PRESETS.find((p) => p.id === "order_placement_pos");
      expect(pos?.scopes).toContain("orders:write");
    });

    it("evaluates scope permissions with hasScope helper", () => {
      const scopes = ["products:read", "inventory:update"];
      expect(hasScope(scopes, "products:read")).toBe(true);
      expect(hasScope(scopes, "inventory:update")).toBe(true);
      expect(hasScope(scopes, "orders:write")).toBe(false);
    });
  });

  describe("API Authentication Guard", () => {
    it("rejects missing or malformed Authorization header", async () => {
      const mockPrisma = {} as any;

      const noHeader = await authenticateApiKey(mockPrisma, null);
      expect(noHeader.authenticated).toBe(false);
      if (!noHeader.authenticated) {
        expect(noHeader.statusCode).toBe(401);
        expect(noHeader.error.title).toBe("Missing Authorization Header");
      }

      const invalidScheme = await authenticateApiKey(mockPrisma, "Basic dXNlcjpwYXNz");
      expect(invalidScheme.authenticated).toBe(false);
      if (!invalidScheme.authenticated) {
        expect(invalidScheme.statusCode).toBe(401);
        expect(invalidScheme.error.title).toBe("Invalid Authorization Scheme");
      }

      const invalidPrefix = await authenticateApiKey(mockPrisma, "Bearer invalid_key_abc");
      expect(invalidPrefix.authenticated).toBe(false);
      if (!invalidPrefix.authenticated) {
        expect(invalidPrefix.statusCode).toBe(401);
        expect(invalidPrefix.error.title).toBe("Invalid API Key Prefix");
      }
    });

    it("authenticates a valid active key and returns tenant context", async () => {
      const generated = generateApiKey("LIVE");

      const mockCredential = {
        id: "key_cuid_123",
        tenantId: "tenant_cuid_456",
        keyPrefix: generated.keyPrefix,
        hashedToken: generated.hashedToken,
        environment: "LIVE",
        scopes: ["products:read", "orders:read"],
        isActive: true,
        expiresAt: null,
      };

      const mockPrisma = {
        apiKeyCredential: {
          findUnique: async ({ where }: any) => {
            if (where.hashedToken === generated.hashedToken) {
              return mockCredential;
            }
            return null;
          },
          update: async () => {},
        },
      } as any;

      const result = await authenticateApiKey(mockPrisma, `Bearer ${generated.token}`);
      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.context.tenantId).toBe("tenant_cuid_456");
        expect(result.context.apiKeyId).toBe("key_cuid_123");
        expect(result.context.environment).toBe("LIVE");
        expect(result.context.scopes).toContain("products:read");
      }
    });

    it("rejects revoked and expired API keys", async () => {
      const generated = generateApiKey("LIVE");

      const mockRevokedPrisma = {
        apiKeyCredential: {
          findUnique: async () => ({
            id: "key_revoked",
            tenantId: "tenant_1",
            isActive: false,
          }),
        },
      } as any;

      const revokedRes = await authenticateApiKey(mockRevokedPrisma, `Bearer ${generated.token}`);
      expect(revokedRes.authenticated).toBe(false);
      if (!revokedRes.authenticated) {
        expect(revokedRes.statusCode).toBe(403);
        expect(revokedRes.error.title).toBe("Revoked API Key");
      }

      const mockExpiredPrisma = {
        apiKeyCredential: {
          findUnique: async () => ({
            id: "key_expired",
            tenantId: "tenant_1",
            isActive: true,
            expiresAt: new Date(Date.now() - 10000), // expired 10s ago
          }),
        },
      } as any;

      const expiredRes = await authenticateApiKey(mockExpiredPrisma, `Bearer ${generated.token}`);
      expect(expiredRes.authenticated).toBe(false);
      if (!expiredRes.authenticated) {
        expect(expiredRes.statusCode).toBe(403);
        expect(expiredRes.error.title).toBe("Expired API Key");
      }
    });
  });

  describe("Idempotency Caching Engine", () => {
    it("stores and retrieves idempotent responses", async () => {
      let storedRecord: any = null;

      const mockPrisma = {
        apiIdempotencyRecord: {
          findUnique: async () => storedRecord,
          upsert: async ({ create }: any) => {
            storedRecord = { ...create, id: "rec_1" };
            return storedRecord;
          },
          delete: async () => {},
        },
      } as any;

      // Initial check (cache miss)
      const miss = await checkIdempotency(mockPrisma, "tenant_1", "idemp-key-123", "/api/v1/orders");
      expect(miss.cached).toBe(false);

      // Record response
      const payload = { id: "order_123", orderNumber: "ORD-1001", totalAmount: "1150.00" };
      await recordIdempotency(mockPrisma, "tenant_1", "idemp-key-123", "/api/v1/orders", 201, payload);

      // Second check (cache hit)
      const hit = await checkIdempotency(mockPrisma, "tenant_1", "idemp-key-123", "/api/v1/orders");
      expect(hit.cached).toBe(true);
      expect(hit.statusCode).toBe(201);
      expect((hit.body as any).orderNumber).toBe("ORD-1001");
    });
  });
});
