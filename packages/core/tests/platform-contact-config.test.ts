import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@biztrackbd/db";
import { PLATFORM_CONTACT_DEFAULTS, getPlatformContactConfig, savePlatformContactConfig } from "../src";

/** A tiny in-memory stand-in for the two tables these functions touch. */
function fakeDb() {
  const rows = new Map<string, { key: string; value: string; updatedAt: Date; updatedBy: string | null }>();
  const audit: unknown[] = [];
  const db = {
    platformConfig: {
      findMany: async ({ where }: { where: { key: { in: string[] } } }) => [...rows.values()].filter((r) => where.key.in.includes(r.key)),
      upsert: async ({ where, create, update }: { where: { key: string }; create: { key: string; value: string; updatedBy: string }; update: { value: string; updatedBy: string } }) => {
        const prev = rows.get(where.key);
        rows.set(where.key, { key: where.key, value: prev ? update.value : create.value, updatedAt: new Date(), updatedBy: prev ? update.updatedBy : create.updatedBy });
      },
      deleteMany: async ({ where }: { where: { key: string } }) => { rows.delete(where.key); },
    },
    platformAuditLog: { create: async (a: unknown) => { audit.push(a); } },
  };
  return { db: db as unknown as PrismaClient, rows, audit };
}

const owner = { id: "u1", email: "owner@biztrack.bd", role: "OWNER" as const };
const support = { id: "u2", email: "agent@biztrack.bd", role: "SUPPORT" as const };

describe("platform contact settings", () => {
  it("shows the built-in defaults until something is saved", async () => {
    const { db } = fakeDb();
    const c = await getPlatformContactConfig({ db });
    expect(c).toMatchObject({ ...PLATFORM_CONTACT_DEFAULTS, source: "DEFAULT" });
  });

  it("saves each field in a normal form and reads it back", async () => {
    const { db } = fakeDb();
    await savePlatformContactConfig(owner as never, {
      email: " Hello@BizTrack.BD ",
      phone: "01712-345678",
      whatsapp: "+8801712345678",
      facebookUrl: "facebook.com/biztrackbd",
      instagramUrl: "https://instagram.com/biztrackbd",
    }, { db });
    const c = await getPlatformContactConfig({ db });
    expect(c).toMatchObject({
      email: "hello@biztrack.bd",
      phone: "+8801712345678",
      whatsapp: "+8801712345678",
      facebookUrl: "https://facebook.com/biztrackbd",
      instagramUrl: "https://instagram.com/biztrackbd",
      source: "DATABASE",
    });
  });

  it("an empty field goes back to the default, the others stay", async () => {
    const { db } = fakeDb();
    await savePlatformContactConfig(owner as never, { email: "a@b.bd", phone: "01712345678" }, { db });
    await savePlatformContactConfig(owner as never, { email: "" }, { db });
    const c = await getPlatformContactConfig({ db });
    expect(c.email).toBe(PLATFORM_CONTACT_DEFAULTS.email);
    expect(c.phone).toBe("+8801712345678");
  });

  it("rejects a bad email, a foreign phone, and a link to the wrong site", async () => {
    const { db } = fakeDb();
    await expect(savePlatformContactConfig(owner as never, { email: "not-an-email" }, { db })).rejects.toThrow(/valid email/i);
    await expect(savePlatformContactConfig(owner as never, { phone: "12345" }, { db })).rejects.toThrow(/mobile number/i);
    await expect(savePlatformContactConfig(owner as never, { facebookUrl: "https://evil.example/biztrackbd" }, { db })).rejects.toThrow(/facebook\.com/);
    await expect(savePlatformContactConfig(owner as never, { instagramUrl: "https://facebook.com/x" }, { db })).rejects.toThrow(/instagram\.com/);
  });

  it("only the platform owner or support lead can change it, and the change is logged", async () => {
    const { db, audit } = fakeDb();
    await expect(savePlatformContactConfig(support as never, { email: "a@b.bd" }, { db })).rejects.toThrow();
    expect(audit).toHaveLength(0);
    await savePlatformContactConfig(owner as never, { email: "a@b.bd" }, { db });
    expect(audit).toHaveLength(1);
  });
});
