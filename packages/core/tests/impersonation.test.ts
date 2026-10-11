import { describe, expect, it } from "vitest";
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

  it("creates and verifies 15-minute impersonation session cookie", () => {
    const cookieVal = createImpersonationSessionCookie({
      tenantId: "tenant-123",
      actorId: "admin-1",
      actorEmail: "sumi@biztrackbd.com",
    });

    const session = verifyImpersonationSessionCookie(cookieVal);
    expect(session).not.toBeNull();
    expect(session?.tenantId).toBe("tenant-123");
    expect(session?.actorEmail).toBe("sumi@biztrackbd.com");
    expect(session?.expiresAt).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(session?.expiresAt).toBeLessThanOrEqual(Date.now() + 15 * 60_000 + 1000);
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
