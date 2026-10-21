import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  addTenantQuotaAdjustment,
  createTenantTicket,
  getPlatformTicketDetail,
  getTenantTicketDetail,
  invitePlatformUser,
  createSubscriptionPromo,
  replyPlatformTicket,
  replyTenantTicket,
  signupStore,
  submitPlatformInquiry,
  type PlatformActor,
  type StaffActor,
} from "../src";
import { SUBMIT_LOCK_MS, shouldBlockSubmit } from "../../ui/src/double-submit";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const platformOwner: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };
const platformSupport: PlatformActor = { id: "pu-SUPPORT", email: "support@biztrackbd.test", role: "SUPPORT" };

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

async function newStore() {
  const n = ++seq;
  const store = await signupStore({
    ownerName: "Rahim Chowdhury",
    email: `rahim${n}@example.test`,
    phone: `0191888${String(n).padStart(4, "0")}`,
    storeName: `Guard Store ${n}`,
    subdomain: `guardstore${n}x`,
    plan: "PRO",
  });
  const actor: StaffActor = { userId: `u-${store.tenantId}`, email: `rahim${n}@example.test`, name: "Rahim", role: "STORE_OWNER" };
  return { store, actor };
}

describe("a second click must not create a second record", () => {
  it("a store's support ticket and reply are created once, even if sent twice", async () => {
    const { store, actor } = await newStore();
    const input = { subject: "Domain not working", message: "I added the DNS records this morning." };

    const first = await createTenantTicket(store.tenantId, actor, input);
    const second = await createTenantTicket(store.tenantId, actor, input);
    expect(second.id).toBe(first.id);
    expect(await owner.supportTicket.count({ where: { tenantId: store.tenantId } })).toBe(1);

    await replyTenantTicket(store.tenantId, actor, { ticketId: first.id, message: "Any update?" });
    await replyTenantTicket(store.tenantId, actor, { ticketId: first.id, message: "Any update?" });
    const detail = await getTenantTicketDetail(store.tenantId, actor, first.id);
    expect(detail.messages.filter((m) => m.body === "Any update?")).toHaveLength(1);

    // A different message right after is a real reply, not a duplicate.
    await replyTenantTicket(store.tenantId, actor, { ticketId: first.id, message: "Thanks, fixed." });
    const after = await getTenantTicketDetail(store.tenantId, actor, first.id);
    expect(after.messages.filter((m) => m.authorType === "TENANT")).toHaveLength(3);
  });

  it("a support agent's reply is saved once", async () => {
    const { store, actor } = await newStore();
    const ticket = await createTenantTicket(store.tenantId, actor, { subject: "Billing question", message: "Why was I charged twice?" });

    const reply = { ticketId: ticket.id, body: "Checking this now.", isInternal: false };
    const a = await replyPlatformTicket(platformSupport, reply);
    const b = await replyPlatformTicket(platformSupport, reply);
    expect(b.id).toBe(a.id);

    const detail = await getPlatformTicketDetail(platformSupport, ticket.id);
    expect(detail.messages.filter((m) => m.body === "Checking this now.")).toHaveLength(1);
  });

  it("the same inquiry sent twice becomes one lead", async () => {
    const msg = { name: "Tania Akter", phone: "01912345678", email: "tania@example.test", topic: "setup", message: "How do I connect Pathao to my store?" };
    const a = await submitPlatformInquiry({ ...msg, consentGiven: true });
    const b = await submitPlatformInquiry({ ...msg, consentGiven: true });
    expect(b.id).toBe(a.id);
    expect(await owner.platformInquiry.count({ where: { phone: "01912345678" } })).toBe(1);

    const other = await submitPlatformInquiry({ ...msg, message: "A different question about bKash payments.", consentGiven: true });
    expect(other.id).not.toBe(a.id);
  });

  it("a quota adjustment is applied once per click, and a different one still works", async () => {
    const { store } = await newStore();
    const adj = { type: "SMS_CREDITS" as const, amount: 500, reason: "Goodwill credit after outage" };

    const a = await addTenantQuotaAdjustment(platformOwner, store.tenantId, adj);
    const b = await addTenantQuotaAdjustment(platformOwner, store.tenantId, adj);
    expect(b.id).toBe(a.id);
    expect(await owner.tenantQuotaAdjustment.count({ where: { tenantId: store.tenantId } })).toBe(1);

    await addTenantQuotaAdjustment(platformOwner, store.tenantId, { ...adj, amount: 100 });
    expect(await owner.tenantQuotaAdjustment.count({ where: { tenantId: store.tenantId } })).toBe(2);
  });

  it("a repeated staff invite or promo code is refused, never doubled", async () => {
    await invitePlatformUser(platformOwner, { email: "new.agent@biztrackbd.test", name: "New Agent", role: "SUPPORT" });
    await expect(invitePlatformUser(platformOwner, { email: "new.agent@biztrackbd.test", name: "New Agent", role: "SUPPORT" })).rejects.toThrow(/already exists/i);
    expect(await owner.platformUser.count({ where: { email: "new.agent@biztrackbd.test" } })).toBe(1);

    const promo = { code: "EID50", discountType: "PERCENTAGE" as const, discountValue: 50, applicableTiers: ["ALL"], billingInterval: "ANY" as const, maxUses: null, validUntil: null };
    await createSubscriptionPromo(platformOwner, promo);
    await expect(createSubscriptionPromo(platformOwner, promo)).rejects.toThrow(/already exists/i);
    expect(await owner.subscriptionPromo.count({ where: { code: "EID50" } })).toBe(1);
  });
});

describe("the page-level double-submit lock", () => {
  it("blocks a second submit of the same form inside the window, and lets a later one through", () => {
    const t0 = 1_000_000;
    expect(shouldBlockSubmit(undefined, t0)).toBe(false);
    expect(shouldBlockSubmit(t0, t0 + 200)).toBe(true);
    expect(shouldBlockSubmit(t0, t0 + SUBMIT_LOCK_MS - 1)).toBe(true);
    expect(shouldBlockSubmit(t0, t0 + SUBMIT_LOCK_MS)).toBe(false);
  });
});
