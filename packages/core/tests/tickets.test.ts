import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  createTenantTicket,
  getPlatformTicketDetail,
  getTenantTicketDetail,
  listPlatformTickets,
  listTenantTickets,
  replyPlatformTicket,
  replyTenantTicket,
  signupStore,
  updateTicketStatus,
  type PlatformActor,
  type StaffActor,
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

describe("support tickets desk", () => {
  it("merchant opens a ticket, platform replies, internal notes stay private, and ticket can be solved", async () => {
    const boss = pa("OWNER");
    const support = pa("SUPPORT");
    const n = ++seq;

    const store = await signupStore({
      ownerName: "Rahim Chowdhury",
      email: `rahim${n}@example.test`,
      phone: `0191777${String(n).padStart(4, "0")}`,
      storeName: `Gadget Plus ${n}`,
      subdomain: `gadgetplus${n}x`,
      plan: "PRO",
    });

    const merchantActor: StaffActor = {
      userId: `u-merchant-${store.tenantId}`,
      email: `rahim${n}@example.test`,
      name: "Rahim Chowdhury",
      role: "STORE_OWNER",
    };

    // 1. Merchant creates a ticket
    const ticket = await createTenantTicket(store.tenantId, merchantActor, {
      subject: "Custom domain Rongdhonu not resolving",
      message: "I added DNS records 3 hours ago. Can you check?",
      priority: "HIGH",
    });

    expect(ticket.id).toBeTruthy();
    expect(ticket.code).toMatch(/^T-\d+/);

    // 2. Merchant lists tickets
    const merchantTickets = await listTenantTickets(store.tenantId, merchantActor);
    expect(merchantTickets.length).toBeGreaterThan(0);
    expect(merchantTickets[0]?.code).toBe(ticket.code);
    expect(merchantTickets[0]?.status).toBe("OPEN");

    // 3. Platform staff views tickets
    const platformList = await listPlatformTickets(support);
    const found = platformList.find((t) => t.id === ticket.id);
    expect(found).toBeDefined();
    expect(found?.priority).toBe("HIGH");

    // 4. Platform staff views detail (sees merchant message + system diagnostic)
    const detail = await getPlatformTicketDetail(support, ticket.id);
    expect(detail.messages.length).toBe(2);
    expect(detail.messages[0]?.body).toContain("added DNS records");
    expect(detail.messages[1]?.authorType).toBe("SYSTEM");
    expect(detail.messages[1]?.body).toContain("Store Context");

    // 5. Platform staff adds an internal note
    await replyPlatformTicket(support, {
      ticketId: ticket.id,
      body: "DNS is cached at Cloudflare; checking nameservers now.",
      isInternal: true,
    });

    // 6. Platform staff sends public reply to merchant
    await replyPlatformTicket(support, {
      ticketId: ticket.id,
      body: "Your CNAME is correct. The A record points to an old IP. Please edit to 76.76.21.21.",
      isInternal: false,
      newStatus: "WAITING_ON_TENANT",
    });

    // 7. Merchant checks ticket detail: INTERNAL NOTE MUST BE HIDDEN
    const merchantView = await getTenantTicketDetail(store.tenantId, merchantActor, ticket.id);
    expect(merchantView.status).toBe("WAITING_ON_TENANT");
    const bodies = merchantView.messages.map((m) => m.body);
    expect(bodies.some((b) => b.includes("checking nameservers"))).toBe(false); // Internal note hidden!
    expect(bodies.some((b) => b.includes("Your CNAME is correct"))).toBe(true); // Public reply visible!

    // 8. Merchant replies back: status flips to OPEN
    await replyTenantTicket(store.tenantId, merchantActor, {
      ticketId: ticket.id,
      message: "Fixed the A record, working now! Thank you.",
    });

    const updatedMerchantView = await getTenantTicketDetail(store.tenantId, merchantActor, ticket.id);
    expect(updatedMerchantView.status).toBe("OPEN");

    // 9. Platform staff marks ticket SOLVED
    await updateTicketStatus(support, ticket.id, "SOLVED");
    const solvedView = await getPlatformTicketDetail(support, ticket.id);
    expect(solvedView.status).toBe("SOLVED");
  });
});
