import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  ContactRateLimitError, DomainError, adjustStock, closeContact, createOrder, listContactMessages, listStockAlerts, markContactRead, notifyRestocked, removeStockAlerts, replyToContact,
  requestStockAlert, setEventPublisher, setSmsSender, submitContactMessage, sweepStockAlerts, transitionOrder, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
let sent: string[] = [];

const phone = () => `0191${String(5000000 + ++seq).slice(-7)}`;
async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 10 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678" } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), support: mk("TELEMARKETER", "Sumaiya"), content: mk("CONTENT_EDITOR", "Tamim") };
}
const fails = async (p: Promise<unknown>, code: string, text?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (text) expect((e as DomainError).message).toMatch(text);
};
const soldOut = async (f: TenantFixture, p = 0) => {
  const id = f.products[p]!.variants[0]!.id;
  await owner.productVariant.update({ where: { id }, data: { stockQuantity: 0 } });
  return id;
};

beforeAll(async () => {
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
beforeEach(() => {
  sent = [];
  setEventPublisher(async () => {});
  setSmsSender({ async send(_t, to, text) { sent.push(`${to}: ${text}`); } });
});
afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("back in stock alerts", () => {
  it("a shopper waits on a sold-out item once, is told once when it is back, and not again", async () => {
    const S = await store("alert");
    const v = await soldOut(S.f);
    const ph = phone();
    expect(await requestStockAlert(S.f.tenantId, { variantId: v, phone: ph, name: " Tania " })).toEqual({ alreadyWaiting: false });
    expect(await requestStockAlert(S.f.tenantId, { variantId: v, phone: ph })).toEqual({ alreadyWaiting: true });
    expect((await listStockAlerts(S.f.tenantId, S.owner)).rows).toMatchObject([{ variantId: v, waiting: 1, stock: 0 }]);
    // still sold out: nothing is sent
    expect(await notifyRestocked(S.f.tenantId)).toMatchObject({ sent: 0 });
    await adjustStock(S.f.tenantId, S.owner, v, { delta: 4, reason: "RECEIVED" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain(ph);
    expect(sent[0]).toMatch(/back in stock|আবার স্টকে/);
    expect(sent[0]).toContain(`/products/`);
    expect((await listStockAlerts(S.f.tenantId, S.owner)).rows).toEqual([]);
    // it sells out and comes back again: the finished request is not sent a second time
    await adjustStock(S.f.tenantId, S.owner, v, { delta: -4, reason: "DAMAGED" });
    await adjustStock(S.f.tenantId, S.owner, v, { delta: 2, reason: "RECEIVED" });
    expect(sent).toHaveLength(1);
    // but the shopper can ask again
    await adjustStock(S.f.tenantId, S.owner, v, { delta: -2, reason: "DAMAGED" });
    await requestStockAlert(S.f.tenantId, { variantId: v, phone: ph });
    await adjustStock(S.f.tenantId, S.owner, v, { delta: 3, reason: "RECEIVED" });
    expect(sent).toHaveLength(2);
  });

  it("an in-stock item cannot be waited for, and a bad number or an item from another store is refused", async () => {
    const S = await store("alertbad");
    const T = await store("alertbad2");
    await fails(requestStockAlert(S.f.tenantId, { variantId: S.f.products[0]!.variants[0]!.id, phone: phone() }), "VALIDATION_ERROR", /in stock now/);
    const v = await soldOut(S.f);
    await fails(requestStockAlert(S.f.tenantId, { variantId: v, phone: "12345" }), "VALIDATION_ERROR", /valid mobile/);
    await fails(requestStockAlert(T.f.tenantId, { variantId: v, phone: phone() }), "VALIDATION_ERROR");
    expect((await listStockAlerts(T.f.tenantId, T.owner)).rows).toEqual([]);
  });

  it("limits how many items one number can wait for", async () => {
    const S = await store("alertcap");
    const ph = phone();
    for (let i = 0; i < 10; i++) {
      const v = await owner.productVariant.create({ data: { tenantId: S.f.tenantId, productId: S.f.products[0]!.id, title: `S${i}`, sku: `A${seq}-${i}`, price: 100, stockQuantity: 0, options: {} } });
      await requestStockAlert(S.f.tenantId, { variantId: v.id, phone: ph });
    }
    const extra = await owner.productVariant.create({ data: { tenantId: S.f.tenantId, productId: S.f.products[0]!.id, title: "S99", sku: `A${seq}-99`, price: 100, stockQuantity: 0, options: {} } });
    await fails(requestStockAlert(S.f.tenantId, { variantId: extra.id, phone: ph }), "VALIDATION_ERROR", /already waiting/);
  });

  it("skips someone who opted out, keeps waiting when the plan has no SMS left, and tells the longest-waiting first when units are few", async () => {
    const S = await store("alertskip");
    const v = await soldOut(S.f);
    const out = phone();
    await requestStockAlert(S.f.tenantId, { variantId: v, phone: out });
    await owner.smsOptOut.create({ data: { tenantId: S.f.tenantId, phone: out, reason: "USER_STOP_REQUEST" } });
    const many = Array.from({ length: 8 }, () => phone());
    for (const p of many) { await requestStockAlert(S.f.tenantId, { variantId: v, phone: p }); await new Promise((r) => setTimeout(r, 5)); }
    await owner.productVariant.update({ where: { id: v }, data: { stockQuantity: 1 } });
    const r = await notifyRestocked(S.f.tenantId);
    // one unit: at most 5 are told (the minimum), the opted-out one costs nothing, the rest keep waiting
    expect(r.skipped).toBe(1);
    expect(r.sent).toBe(5);
    expect(r.waiting).toBeGreaterThan(0);
    expect(sent.map((s) => s.split(":")[0])).toEqual(many.slice(0, 5));
    expect(sent.join()).not.toContain(out);
    expect((await owner.stockAlert.findFirstOrThrow({ where: { variantId: v, phone: out } })).skipReason).toBe("opted out");
  });

  it("a cancelled order that puts stock back tells the waiting shopper, and the scheduled sweep catches what nothing else did", async () => {
    const S = await store("alertorder");
    const v = S.f.products[0]!.variants[0]!.id;
    await owner.productVariant.update({ where: { id: v }, data: { stockQuantity: 2 } });
    const o = await createOrder(S.f.tenantId, {
      idempotencyKey: `al-${Date.now()}-${++seq}`, customer: { name: "Buyer", phone: phone() },
      shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: v, quantity: 2 }],
    });
    const waiter = phone();
    await requestStockAlert(S.f.tenantId, { variantId: v, phone: waiter });
    await transitionOrder(S.f.tenantId, o.orderId, "CANCELLED", { type: "MERCHANT", id: "u", name: "x" }, "customer asked");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain(waiter);
    // stock put back by hand in the database: nothing hooked in, the sweep finds it
    const w2 = phone();
    await owner.productVariant.update({ where: { id: v }, data: { stockQuantity: 0 } });
    await requestStockAlert(S.f.tenantId, { variantId: v, phone: w2 });
    await owner.productVariant.update({ where: { id: v }, data: { stockQuantity: 5 } });
    const sweep = await sweepStockAlerts();
    expect(sweep.sent).toBeGreaterThanOrEqual(1);
    expect(sent.some((s) => s.startsWith(w2))).toBe(true);
    expect((await sweepStockAlerts()).sent).toBe(0);
  });

  it("the owner can see who is waiting and clear a request; people who cannot edit products cannot", async () => {
    const S = await store("alertlist");
    const v = await soldOut(S.f);
    await requestStockAlert(S.f.tenantId, { variantId: v, phone: phone() });
    await requestStockAlert(S.f.tenantId, { variantId: v, phone: phone() });
    expect((await listStockAlerts(S.f.tenantId, S.support)).rows[0]!.waiting).toBe(2);
    await fails(removeStockAlerts(S.f.tenantId, S.support, v), "FORBIDDEN");
    expect(await removeStockAlerts(S.f.tenantId, S.owner, v)).toBe(2);
    expect((await listStockAlerts(S.f.tenantId, S.owner)).rows).toEqual([]);
  });

  it("is sealed per store by the database", async () => {
    const A = await store("alertwall");
    const B = await store("alertwall2");
    const v = await soldOut(A.f);
    await requestStockAlert(A.f.tenantId, { variantId: v, phone: phone() });
    const { withTenant } = await import("@biztrackbd/db");
    expect(await withTenant(B.f.tenantId, (tx) => tx.stockAlert.count())).toBe(0);
    await expect(withTenant(B.f.tenantId, (tx) => tx.stockAlert.create({ data: { tenantId: B.f.tenantId, variantId: v, phone: phone() } }))).rejects.toBeTruthy();
  });
});

describe("the store contact inbox", () => {
  const msg = (over: Record<string, unknown> = {}) => ({ name: "Tania Akter", phone: phone(), message: "Do you have this panjabi in size XL?", ...over });

  it("takes a message, shows it to the owner as new, marks it read, and answers it by SMS", async () => {
    const S = await store("inbox");
    const m = msg();
    await submitContactMessage(S.f.tenantId, m);
    let list = await listContactMessages(S.f.tenantId, S.support);
    expect(list.counts).toEqual({ open: 1, replied: 0, closed: 0 });
    expect(list.unread).toBe(1);
    expect(list.rows[0]).toMatchObject({ name: "Tania Akter", status: "NEW" });
    const id = list.rows[0]!.id;
    await markContactRead(S.f.tenantId, S.owner, id);
    expect((await listContactMessages(S.f.tenantId, S.owner)).unread).toBe(0);
    const r = await replyToContact(S.f.tenantId, S.owner, id, "  Yes, XL is in stock.  ");
    expect(r.parts).toBe(1);
    expect(sent).toEqual([`${m.phone}: Yes, XL is in stock.`]);
    list = await listContactMessages(S.f.tenantId, S.owner, "replied");
    expect(list.rows[0]).toMatchObject({ status: "REPLIED", replyText: "Yes, XL is in stock.", repliedBy: "Nusrat" });
    await fails(replyToContact(S.f.tenantId, S.owner, id, "Again"), "VALIDATION_ERROR", /already answered/);
    expect(sent).toHaveLength(1);
  });

  it("checks the form: name, a real mobile number, an optional email, a message of sensible length", async () => {
    const S = await store("inboxform");
    await fails(submitContactMessage(S.f.tenantId, msg({ name: "T" })), "VALIDATION_ERROR");
    await fails(submitContactMessage(S.f.tenantId, msg({ phone: "123" })), "VALIDATION_ERROR", /valid mobile/);
    await fails(submitContactMessage(S.f.tenantId, msg({ email: "nope" })), "VALIDATION_ERROR");
    await fails(submitContactMessage(S.f.tenantId, msg({ message: "hi" })), "VALIDATION_ERROR");
    await fails(submitContactMessage(S.f.tenantId, msg({ message: "x".repeat(1001) })), "VALIDATION_ERROR");
    expect((await listContactMessages(S.f.tenantId, S.owner)).counts.open).toBe(0);
  });

  it("limits floods by number and by connection, and a double tap is one message", async () => {
    const S = await store("inboxflood");
    const ph = phone();
    const first = await submitContactMessage(S.f.tenantId, msg({ phone: ph, message: "First question here" }));
    const dup = await submitContactMessage(S.f.tenantId, msg({ phone: ph, message: "First question here" }));
    expect(dup.id).toBe(first.id);
    await submitContactMessage(S.f.tenantId, msg({ phone: ph, message: "Second question here" }));
    await submitContactMessage(S.f.tenantId, msg({ phone: ph, message: "Third question here" }));
    await expect(submitContactMessage(S.f.tenantId, msg({ phone: ph, message: "Fourth question here" }))).rejects.toBeInstanceOf(ContactRateLimitError);
    for (let i = 0; i < 6; i++) await submitContactMessage(S.f.tenantId, msg({ message: `A different question number ${i}`, clientHash: "conn-1" }));
    await expect(submitContactMessage(S.f.tenantId, msg({ message: "One more question please", clientHash: "conn-1" }))).rejects.toBeInstanceOf(ContactRateLimitError);
    await submitContactMessage(S.f.tenantId, msg({ message: "From another connection", clientHash: "conn-2" }));
  });

  it("can be closed without a reply, refuses to SMS someone who opted out, and a failing gateway says so", async () => {
    const S = await store("inboxclose");
    const a = msg();
    const b = msg();
    const c = msg();
    await submitContactMessage(S.f.tenantId, a);
    await submitContactMessage(S.f.tenantId, b);
    await submitContactMessage(S.f.tenantId, c);
    const rows = (await listContactMessages(S.f.tenantId, S.owner)).rows;
    const idOf = (p: string) => rows.find((r) => r.phone === p)!.id;
    await closeContact(S.f.tenantId, S.owner, idOf(a.phone));
    expect((await listContactMessages(S.f.tenantId, S.owner, "closed")).rows).toHaveLength(1);
    await owner.smsOptOut.create({ data: { tenantId: S.f.tenantId, phone: b.phone, reason: "USER_STOP_REQUEST" } });
    await fails(replyToContact(S.f.tenantId, S.owner, idOf(b.phone), "Hello there"), "VALIDATION_ERROR", /not to get SMS/);
    setSmsSender({ async send() { throw new Error("gateway down"); } });
    await fails(replyToContact(S.f.tenantId, S.owner, idOf(c.phone), "Hello there"), "VALIDATION_ERROR", /could not be sent/);
    expect((await listContactMessages(S.f.tenantId, S.owner)).rows.map((r) => r.status)).not.toContain("REPLIED");
  });

  it("is for people who handle customers, and each store sees only its own", async () => {
    const A = await store("inboxa");
    const B = await store("inboxb");
    await submitContactMessage(A.f.tenantId, msg());
    await fails(listContactMessages(A.f.tenantId, A.content), "FORBIDDEN");
    await fails(replyToContact(A.f.tenantId, A.content, "x", "Hello there"), "FORBIDDEN");
    expect((await listContactMessages(B.f.tenantId, B.owner)).counts.open).toBe(0);
    const id = (await listContactMessages(A.f.tenantId, A.owner)).rows[0]!.id;
    await fails(replyToContact(B.f.tenantId, B.owner, id, "Hello there"), "NOT_FOUND");
  });
});
