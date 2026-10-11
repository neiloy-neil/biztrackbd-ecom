import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  createAnnouncement,
  getActiveAnnouncementsForTenant,
  listAnnouncements,
  signupStore,
  type PlatformActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const pa = (role: "OWNER" | "SUPPORT" | "SUPPORT_LEAD" | "FINANCE"): PlatformActor => ({
  id: `pu-${role}`,
  email: `${role.toLowerCase()}@biztrackbd.test`,
  role,
});

beforeAll(async () => {
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  setPlatformPrisma(owner);
  await seedPlans(owner);
});

afterAll(async () => {
  await app?.$disconnect();
  await owner?.$disconnect();
});

describe("platform announcements", () => {
  it("creates an announcement with ALL audience and lists it with LIVE status", async () => {
    const boss = pa("OWNER");
    const a = await createAnnouncement(boss, {
      title: "System Maintenance Tonight",
      titleBn: "আজ রাতে সিস্টেম রক্ষণাবেক্ষণ",
      body: "Database backup will run from 2 AM to 3 AM Dhaka time.",
      audience: { type: "ALL" },
      channels: ["BANNER"],
    });

    expect(a.id).toBeTruthy();
    expect(a.title).toBe("System Maintenance Tonight");
    expect(a.status).toBe("LIVE");

    const all = await listAnnouncements(boss);
    const found = all.find((x) => x.id === a.id);
    expect(found).toBeDefined();
    expect(found?.titleBn).toBe("আজ রাতে সিস্টেম রক্ষণাবেক্ষণ");
  });

  it("support role cannot create announcements, only view them", async () => {
    const support = pa("SUPPORT");
    await expect(
      createAnnouncement(support, {
        title: "Unauthorized Announcement",
        body: "Should fail",
        audience: { type: "ALL" },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // But can view
    const list = await listAnnouncements(support);
    expect(Array.isArray(list)).toBe(true);
  });

  it("filters active announcements for a specific tenant by plan and audience", async () => {
    const boss = pa("OWNER");
    const n = ++seq;
    const storeStarter = await signupStore({
      ownerName: "Starter Owner",
      email: `starter${n}@example.test`,
      phone: `0191555${String(n).padStart(4, "0")}`,
      storeName: `Starter Shop ${n}`,
      subdomain: `starter${n}x`,
      plan: "STARTER",
    });

    // Create an announcement only for PRO plan
    await createAnnouncement(boss, {
      title: "Exclusive Pro Feature",
      body: "Check out advanced analytics.",
      audience: { type: "PLAN", value: "PRO" },
    });

    // Create an announcement specifically for this tenant
    const targetA = await createAnnouncement(boss, {
      title: "Welcome to BizTrack",
      body: "Your onboarding representative is Sumi.",
      audience: { type: "TENANT", value: storeStarter.tenantId },
    });

    // Query active announcements for Starter store
    const forTenant = await getActiveAnnouncementsForTenant(storeStarter.tenantId);
    expect(forTenant.some((x) => x.id === targetA.id)).toBe(true);
    // Should NOT receive the PRO-only announcement
    expect(forTenant.some((x) => x.title === "Exclusive Pro Feature")).toBe(false);
    // Should receive the ALL-stores maintenance announcement created earlier
    expect(forTenant.some((x) => x.title === "System Maintenance Tonight")).toBe(true);
  });
});
