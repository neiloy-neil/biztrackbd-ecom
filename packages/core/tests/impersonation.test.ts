import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createImpersonationSessionCookie,
  createImpersonationTicket,
  verifyImpersonationSessionCookie,
  verifyImpersonationTicket,
} from "../src/platform/impersonation";
import { ForbiddenError, ValidationError } from "../src/errors";
import type { PlatformActor } from "../src/platform/admin";

describe("Platform Impersonation & Security Safeguards", () => {
  const superAdmin: PlatformActor = {
    id: "admin-1",
    email: "sumi@biztrackbd.com",
    role: "OWNER",
  };

  const supportStaff: PlatformActor = {
    id: "support-1",
    email: "tarek@biztrackbd.com",
    role: "SUPPORT",
  };

  it("prohibits non-authorized staff from creating impersonation tickets", async () => {
    // support staff only has 'view' level for tenants, cannot 'edit'/impersonate
    await expect(
      createImpersonationTicket(supportStaff, "tenant-1", {
        tenant: { findUnique: async () => ({ id: "tenant-1", name: "Store" }) },
        platformAuditLog: { create: async () => ({}) },
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("generates a valid signed HMAC ticket with 60s TTL", async () => {
    const mockDb = {
      tenant: { findUnique: async () => ({ id: "tenant-123", name: "Rongdhonu Fashion" }) },
      platformAuditLog: { create: async () => ({}) },
    } as any;

    const ticket = await createImpersonationTicket(superAdmin, "tenant-123", mockDb);
    expect(typeof ticket).toBe("string");
    expect(ticket).toContain(".");

    const verified = verifyImpersonationTicket(ticket);
    expect(verified).not.toBeNull();
    expect(verified?.tenantId).toBe("tenant-123");
    expect(verified?.actorEmail).toBe("sumi@biztrackbd.com");
  });

  it("rejects tampered or malformed tickets", () => {
    expect(verifyImpersonationTicket("invalid-ticket")).toBeNull();
    expect(verifyImpersonationTicket("abc.def.ghi")).toBeNull();
  });

  it("creates and verifies 7-day impersonation session cookie", () => {
    const cookieVal = createImpersonationSessionCookie({
      tenantId: "tenant-123",
      actorId: "admin-1",
      actorEmail: "sumi@biztrackbd.com",
    });

    const session = verifyImpersonationSessionCookie(cookieVal);
    expect(session).not.toBeNull();
    expect(session?.tenantId).toBe("tenant-123");
    expect(session?.actorEmail).toBe("sumi@biztrackbd.com");
    expect(session?.expiresAt).toBeGreaterThan(Date.now() + 6 * 86400 * 1000);
    expect(session?.expiresAt).toBeLessThanOrEqual(Date.now() + 7 * 86400 * 1000 + 1000);
  });

  it("rejects tampered session cookie", () => {
    const cookieVal = createImpersonationSessionCookie({
      tenantId: "tenant-123",
      actorId: "admin-1",
      actorEmail: "sumi@biztrackbd.com",
    });
    const [json, sig] = cookieVal.split(".");
    expect(verifyImpersonationSessionCookie(`${json}.tamperedSig`)).toBeNull();
  });
});

describe("Impersonation secret handling", () => {
  const payload = { tenantId: "tenant-123", actorId: "admin-1", actorEmail: "sumi@biztrackbd.com" };
  const secretA = "a".repeat(40);
  const secretB = "b".repeat(40);

  afterEach(() => vi.unstubAllEnvs());

  it("refuses to sign or verify in production without a secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("IMPERSONATION_SECRET", "");
    vi.stubEnv("COOKIE_SECRET", "");
    expect(() => createImpersonationSessionCookie(payload)).toThrow(/IMPERSONATION_SECRET/);
    expect(() => verifyImpersonationSessionCookie("a.b")).toThrow(/IMPERSONATION_SECRET/);
    expect(() => verifyImpersonationTicket("a.b")).toThrow(/IMPERSONATION_SECRET/);
  });

  it("refuses a production secret shorter than 32 characters", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("IMPERSONATION_SECRET", "too-short");
    vi.stubEnv("COOKIE_SECRET", "");
    expect(() => createImpersonationSessionCookie(payload)).toThrow(/32/);
  });

  it("falls back to COOKIE_SECRET in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("IMPERSONATION_SECRET", "");
    vi.stubEnv("COOKIE_SECRET", secretA);
    expect(verifyImpersonationSessionCookie(createImpersonationSessionCookie(payload))?.tenantId).toBe("tenant-123");
  });

  it("does not verify a cookie signed under a different secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("IMPERSONATION_SECRET", secretA);
    const cookie = createImpersonationSessionCookie(payload);
    expect(verifyImpersonationSessionCookie(cookie)).not.toBeNull();
    vi.stubEnv("IMPERSONATION_SECRET", secretB);
    expect(verifyImpersonationSessionCookie(cookie)).toBeNull();
  });
});
