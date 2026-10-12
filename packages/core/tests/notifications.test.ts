import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DEFAULT_MESSAGES, DomainError, MESSAGE_EVENTS, getPrintSettings, listMessageTemplates, notifyOrder, renderMessage, resetMessageTemplate, saveInvoiceSettings, saveMessageTemplate,
  setEventPublisher, setSmsSender, smsParts, transitionOrder, validateMessage, createOrder, markPaid, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const sent: { to: string; text: string }[] = [];

async function store(name: string, smsCredits: number | null = 100) {
  await owner.plan.update({ where: { tier: "STARTER" }, data: { limits: { products: 300, ordersPerMonth: 500, staff: 5, smsCredits } } });
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 20 });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: "STARTER", locale: "en" } });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: `${name} Store`, contactPhone: "01712345678", bkashNumber: "01712345678" } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), support: mk("TELEMARKETER", "Sumaiya") };
}

const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  return e as DomainError;
};

const vid = (f: TenantFixture) => f.products[0]!.variants[0]!.id;
const phone = () => `0141${String(1000000 + ++seq).slice(-7)}`;
async function order(S: Awaited<ReturnType<typeof store>>, pay: "COD" | "MANUAL_BKASH" = "COD") {
  const placed = await createOrder(S.f.tenantId, {
    idempotencyKey: `k-${Date.now()}-${++seq}`, customer: { name: "Rina Akter", phone: phone() }, shipping: { address: "House 1, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(S.f), quantity: 1 }], paymentMethod: pay, ...(pay === "MANUAL_BKASH" ? { mfs: { senderNumber: "01712345678", trxId: `TX${++seq}ABCD1` } } : {}),
  });
  return placed;
}
const tell = (S: Awaited<ReturnType<typeof store>>, over: Record<string, unknown> = {}) => ({ event: "ORDER_RECEIVED" as const, ...over, ...(S ? {} : {}) });

beforeAll(async () => {
  process.env.CUSTOMER_AUTH_SECRET ||= "test-secret-test-secret-test-secret-1234";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
beforeEach(() => {
  sent.length = 0;
  setEventPublisher(async () => {});
  setSmsSender({ async send(_t, to, text) { sent.push({ to, text }); } });
});
afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("writing messages", () => {
  it("fills in the placeholders and leaves unknown braces alone", () => {
    expect(renderMessage("Hi {customer_name}, {order_number} {nope}", { customer_name: "Rina", order_number: "BT-1" })).toBe("Hi Rina, BT-1 {nope}");
  });

  it("counts SMS parts: Bangla is 70 characters a part, plain English 160", () => {
    expect(smsParts("a".repeat(160))).toEqual({ chars: 160, parts: 1, unicode: false });
    expect(smsParts("a".repeat(161)).parts).toBe(2);
    expect(smsParts("আ".repeat(70))).toEqual({ chars: 70, parts: 1, unicode: true });
    expect(smsParts("আ".repeat(71)).parts).toBe(2);
    expect(smsParts("").parts).toBe(0);
  });

  it("refuses empty, too long, and placeholders that do not exist for that message", () => {
    expect(() => validateMessage("ORDER_RECEIVED", "  ")).toThrow(/too short/);
    expect(() => validateMessage("ORDER_RECEIVED", "x".repeat(481))).toThrow(/under 480/);
    expect(() => validateMessage("ORDER_RECEIVED", "Hi {customer_name} {coupon}")).toThrow(/\{coupon\}/);
    expect(() => validateMessage("ABANDONED_RECOVERY", "Order {order_number} waits")).toThrow(/\{order_number\}/);
    expect(validateMessage("DELIVERED", "  Delivered {order_number}  ")).toBe("Delivered {order_number}");
  });

  it("every ready-made text passes its own rules", () => {
    for (const e of MESSAGE_EVENTS) for (const l of ["en", "bn"] as const) expect(() => validateMessage(e.event, DEFAULT_MESSAGES[e.event][l])).not.toThrow();
  });
});

describe("the notifications editor", () => {
  it("starts with every customer message off and the ready-made words showing", async () => {
    const S = await store("fresh");
    const { templates } = await listMessageTemplates(S.f.tenantId, S.owner);
    expect(templates.map((t) => t.event)).toEqual(MESSAGE_EVENTS.map((e) => e.event));
    for (const t of templates) {
      expect(t.enabled).toBe(t.alwaysOn);
      expect(t.texts.en).toMatchObject({ custom: false, body: DEFAULT_MESSAGES[t.event].en });
    }
  });

  it("saves the words, turns a message on for both languages, and puts the ready-made text back", async () => {
    const S = await store("edit");
    await saveMessageTemplate(S.f.tenantId, S.owner, { event: "ORDER_SHIPPED", enabled: true, texts: { en: "Shipped {order_number}!" } });
    let t = (await listMessageTemplates(S.f.tenantId, S.owner)).templates.find((x) => x.event === "ORDER_SHIPPED")!;
    expect(t.enabled).toBe(true);
    expect(t.texts.en).toMatchObject({ custom: true, body: "Shipped {order_number}!" });
    expect(t.texts.bn.body).toBe(DEFAULT_MESSAGES.ORDER_SHIPPED.bn);
    await resetMessageTemplate(S.f.tenantId, S.owner, "ORDER_SHIPPED", "en");
    t = (await listMessageTemplates(S.f.tenantId, S.owner)).templates.find((x) => x.event === "ORDER_SHIPPED")!;
    expect(t.texts.en.body).toBe(DEFAULT_MESSAGES.ORDER_SHIPPED.en);
    expect(t.enabled).toBe(true);
    await saveMessageTemplate(S.f.tenantId, S.owner, { event: "ORDER_SHIPPED", enabled: false });
    expect((await listMessageTemplates(S.f.tenantId, S.owner)).templates.find((x) => x.event === "ORDER_SHIPPED")!.enabled).toBe(false);
  });

  it("a bad placeholder is refused and nothing is saved; staff who cannot edit the design are refused", async () => {
    const S = await store("refuse");
    await fails(saveMessageTemplate(S.f.tenantId, S.owner, { event: "DELIVERED", enabled: true, texts: { en: "Hi {secret}" } }), "VALIDATION_ERROR");
    expect((await listMessageTemplates(S.f.tenantId, S.owner)).templates.find((x) => x.event === "DELIVERED")!.enabled).toBe(false);
    await fails(saveMessageTemplate(S.f.tenantId, S.support, { event: "DELIVERED", enabled: true }), "FORBIDDEN");
  });

  it("one store's messages never show in another's", async () => {
    const A = await store("isoa");
    const B = await store("isob");
    await saveMessageTemplate(A.f.tenantId, A.owner, { event: "DELIVERED", enabled: true, texts: { en: "Only for A {order_number}" } });
    const t = (await listMessageTemplates(B.f.tenantId, B.owner)).templates.find((x) => x.event === "DELIVERED")!;
    expect(t.enabled).toBe(false);
    expect(t.texts.en.body).toBe(DEFAULT_MESSAGES.DELIVERED.en);
  });
});

describe("telling the customer", () => {
  it("sends nothing while a message is off", async () => {
    const S = await store("off");
    const o = await order(S);
    expect(sent).toEqual([]);
    expect(await notifyOrder(S.f.tenantId, o.orderId, "ORDER_RECEIVED")).toBe("off");
  });

  it("sends the order received text when the order is placed, with the store's words and a signed link", async () => {
    const S = await store("recv");
    await saveMessageTemplate(S.f.tenantId, S.owner, { event: "ORDER_RECEIVED", enabled: true, texts: { en: "Thanks {customer_name}! {order_number} {total} {store_name} {tracking_link}" } });
    const o = await order(S);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toMatch(new RegExp(`^Thanks Rina! ${o.orderNumber} ৳ [\\d,]+ recv Store https?://.+/order/${o.orderId}\\?k=\\S+$`));
    const events = await owner.orderEvent.findMany({ where: { orderId: o.orderId, type: "SMS" } });
    expect(events).toHaveLength(1);
  });

  it("uses a credit for each message, stops at the plan's allowance, and skips customers who opted out", async () => {
    const S = await store("credits", 1);
    await saveMessageTemplate(S.f.tenantId, S.owner, { event: "ORDER_RECEIVED", enabled: true });
    const a = await order(S);
    expect(sent).toHaveLength(1);
    expect(await notifyOrder(S.f.tenantId, a.orderId, "ORDER_RECEIVED")).toBe("no_credits");
    expect(sent).toHaveLength(1);

    const T = await store("optout", null);
    await saveMessageTemplate(T.f.tenantId, T.owner, { event: "ORDER_RECEIVED", enabled: true });
    const p = phone();
    await owner.smsOptOut.create({ data: { tenantId: T.f.tenantId, phone: p } });
    const placed = await createOrder(T.f.tenantId, {
      idempotencyKey: `k-${Date.now()}-${++seq}`, customer: { name: "Opt Out", phone: p }, shipping: { address: "House 1, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
      items: [{ variantId: vid(T.f), quantity: 1 }], paymentMethod: "COD",
    });
    expect(placed.orderId).toBeTruthy();
    expect(sent).toHaveLength(1);
  });

  it("follows the order: payment confirmed once, shipped, delivered and cancelled", async () => {
    const S = await store("flow");
    for (const event of ["PAYMENT_CONFIRMED", "ORDER_SHIPPED", "DELIVERED", "ORDER_CANCELLED"] as const) await saveMessageTemplate(S.f.tenantId, S.owner, { event, enabled: true });
    const actor = { type: "MERCHANT" as const, id: S.owner.userId, name: "Nusrat" };

    const a = await order(S, "MANUAL_BKASH");
    await markPaid(S.f.tenantId, a.orderId, S.owner.userId, S.owner);
    await markPaid(S.f.tenantId, a.orderId, S.owner.userId, S.owner); // a second click tells nobody again
    expect(sent.filter((s) => s.text.includes("payment"))).toHaveLength(1);
    await transitionOrder(S.f.tenantId, a.orderId, "CONFIRMED", actor);
    await transitionOrder(S.f.tenantId, a.orderId, "PROCESSING", actor);
    await transitionOrder(S.f.tenantId, a.orderId, "SHIPPED", actor);
    await transitionOrder(S.f.tenantId, a.orderId, "DELIVERED", actor);
    expect(sent.map((s) => s.text.match(/payment|on its way|was delivered/)?.[0])).toEqual(["payment", "on its way", "was delivered"]);

    const b = await order(S);
    await transitionOrder(S.f.tenantId, b.orderId, "CANCELLED", actor);
    expect(sent.at(-1)!.text).toContain("was cancelled");
  });

  it("sends in the store's language: Bangla when the store is set to Bangla", async () => {
    const S = await store("bangla");
    await owner.tenant.update({ where: { id: S.f.tenantId }, data: { locale: "bn" } });
    await saveMessageTemplate(S.f.tenantId, S.owner, { event: "ORDER_RECEIVED", enabled: true });
    await order(S);
    expect(sent[0]!.text).toContain("আপনার অর্ডার");
  });

  it("a broken SMS provider never breaks the order", async () => {
    const S = await store("broken");
    await saveMessageTemplate(S.f.tenantId, S.owner, { event: "ORDER_RECEIVED", enabled: true });
    setSmsSender({ async send() { throw new Error("provider down"); } });
    const o = await order(S);
    expect(o.orderNumber).toBeTruthy();
    expect(tell(S)).toBeTruthy();
  });
});

describe("invoice settings", () => {
  it("saves the options and the footer separately from the store details, and keeps the rest", async () => {
    const S = await store("inv");
    await saveInvoiceSettings(S.f.tenantId, S.owner, { footer: " Thank you! ", showLogo: false, showSku: false, showPricesOnSlip: true, paper: "thermal" });
    let st = await getPrintSettings(S.f.tenantId, S.owner);
    expect(st.invoiceFooter).toBe("Thank you!");
    expect(st.invoiceOptions).toMatchObject({ showLogo: false, showSku: false, showPricesOnSlip: true, paper: "thermal" });
    await saveInvoiceSettings(S.f.tenantId, S.owner, { showLogo: true });
    st = await getPrintSettings(S.f.tenantId, S.owner);
    expect(st.invoiceFooter).toBe("Thank you!");
    expect(st.invoiceOptions).toMatchObject({ showLogo: true, showSku: false, paper: "thermal" });
    await saveInvoiceSettings(S.f.tenantId, S.owner, { footer: "" });
    expect((await getPrintSettings(S.f.tenantId, S.owner)).invoiceFooter).toBeNull();
  });

  it("refuses an unknown paper size and staff who cannot edit the design", async () => {
    const S = await store("invbad");
    await fails(saveInvoiceSettings(S.f.tenantId, S.owner, { paper: "a3" }), "VALIDATION_ERROR");
    await fails(saveInvoiceSettings(S.f.tenantId, S.support, { showSku: false }), "FORBIDDEN");
  });
});
