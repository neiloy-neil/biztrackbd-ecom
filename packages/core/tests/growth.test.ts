import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, abandonedTabCounts, captureCheckout, cleanText, createOrder, createQuickOrder, displayName, getAbandonedMetrics, getReviewSummary, getTrackingOverview, listAbandoned, listPublicReviews,
  listReviews, logCallOutcome, purchaseEventId, recordBrowserPurchase, recoveryText, replyToReview, resolveRecovery, reviewTabCounts, reviewableItems, savePixelId, saveIntegration,
  sendRecoveryMessages, sendServerPurchase, sendTestEvent, setEventPublisher, setPixelFetchForTests, setReviewPublished, setReviewsAutoPublish, setSmsSender, submitReview, sweepRecoveryMessages,
  trackBrowserEvent, transitionOrder, saveTrackingConfig, sendGa4ServerEvent, type SmsSender, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const MIN = 60_000;

const phone = () => `0131${String(1000000 + ++seq).slice(-7)}`;
const key = () => `grw-${Date.now()}-${++seq}`;

async function store(name: string, opts: { locale?: string; smsCredits?: number } = {}) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 50 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678" } });
  if (opts.locale) await owner.tenant.update({ where: { id: f.tenantId }, data: { locale: opts.locale } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), manager: mk("STORE_MANAGER", "Kamrul"), packer: mk("ORDER_PACKER", "Rubel"), tele: mk("TELEMARKETER", "Sumaiya"), content: mk("CONTENT_EDITOR", "Cora") };
}
type Store = Awaited<ReturnType<typeof store>>;
const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;
const fails = async (p: Promise<unknown>, code: string, msg?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (msg) expect((e as DomainError).message).toMatch(msg);
};
const place = (f: TenantFixture, ph: string, over: Record<string, unknown> = {}) =>
  createOrder(f.tenantId, {
    idempotencyKey: key(), customer: { name: "Tania Akter", phone: ph }, shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(f), quantity: 1 }], ...over,
  });
const merchant = (s: Store) => ({ type: "MERCHANT" as const, id: s.owner.userId, name: "Nusrat" });
async function delivered(s: Store, ph = phone(), productIdx = 0) {
  const o = await place(s.f, ph, { items: [{ variantId: vid(s.f, productIdx), quantity: 1 }] });
  for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const) await transitionOrder(s.f.tenantId, o.orderId, to, merchant(s));
  const order = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
  return { ...o, customerId: order.customerId!, phone: ph, productId: s.f.products[productIdx]!.id };
}
const cart = (f: TenantFixture, qty = 1) => [{ variantId: vid(f), quantity: qty }];
const open = (tenantId: string) => owner.abandonedCheckout.findMany({ where: { tenantId } });
/** Moves a captured checkout back in time, as if the customer left it that long ago. */
const age = (id: string, minutes: number) => owner.$executeRaw`UPDATE "AbandonedCheckout" SET "lastEventAt" = timezone('utc', now()) - make_interval(mins => ${minutes}) WHERE id = ${id}`;

class Outbox implements SmsSender {
  sent: { tenantId: string; to: string; text: string }[] = [];
  fail = false;
  async send(tenantId: string, to: string, text: string) {
    if (this.fail) throw new Error("provider down");
    this.sent.push({ tenantId, to, text });
  }
}
const sms = new Outbox();

beforeAll(async () => {
  process.env.INTEGRATION_VAULT_SECRET = randomBytes(32).toString("hex");
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "bt.test";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
beforeEach(() => {
  setEventPublisher(async () => {});
  sms.sent = [];
  sms.fail = false;
  setSmsSender(sms);
});
afterAll(async () => {
  setPixelFetchForTests(undefined);
  await app.$disconnect();
  await owner.$disconnect();
});

describe("capturing an abandoned checkout", () => {
  it("keeps the cart the moment a valid number is typed, with prices from the database", async () => {
    const s = await store("cap1");
    const ph = phone();
    expect(await captureCheckout(s.f.tenantId, { phone: `+88${ph}`, name: "Tania Akter", district: "Dhaka", items: cart(s.f, 2), price: 1 })).toEqual({ captured: true });
    const rows = await open(s.f.tenantId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phone: ph, customerName: "Tania Akter", district: "Dhaka", status: "CAPTURED" });
    expect(Number(rows[0]!.cartTotal)).toBe(2300); // 2 x 1150, whatever the browser claimed
    expect(rows[0]!.recoveryToken).toMatch(/^[a-f0-9]{48}$/);
    expect(rows[0]!.recoveryUrl).toBe(`/checkout?recover=${rows[0]!.recoveryToken}`);
  });

  it("a customer who comes back and changes the cart updates the same row", async () => {
    const s = await store("cap2");
    const ph = phone();
    await captureCheckout(s.f.tenantId, { phone: ph, items: cart(s.f, 1) });
    const first = (await open(s.f.tenantId))[0]!;
    await captureCheckout(s.f.tenantId, { phone: ph, name: "Tania", items: [{ variantId: vid(s.f), quantity: 3 }, { variantId: vid(s.f, 1), quantity: 1 }] });
    const rows = await open(s.f.tenantId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(first.id);
    expect(rows[0]!.recoveryToken).toBe(first.recoveryToken);
    expect(Number(rows[0]!.cartTotal)).toBe(3 * 1150 + 850);
    expect(rows[0]!.customerName).toBe("Tania");
  });

  it("ten requests at once still make one row", async () => {
    const s = await store("cap3");
    const ph = phone();
    await Promise.all(Array.from({ length: 10 }, () => captureCheckout(s.f.tenantId, { phone: ph, items: cart(s.f) })));
    expect(await open(s.f.tenantId)).toHaveLength(1);
  });

  it("ignores what it should: bad numbers, empty or unknown carts, inactive products, blocked numbers, a number that just ordered", async () => {
    const s = await store("cap4");
    expect((await captureCheckout(s.f.tenantId, { phone: "12345", items: cart(s.f) })).captured).toBe(false);
    expect((await captureCheckout(s.f.tenantId, { phone: phone(), items: [] })).captured).toBe(false);
    expect((await captureCheckout(s.f.tenantId, { phone: phone(), items: [{ variantId: "nope", quantity: 1 }] })).captured).toBe(false);
    expect((await captureCheckout(s.f.tenantId, { phone: phone(), items: [{ variantId: vid(s.f), quantity: 0 }] })).captured).toBe(false);
    expect((await captureCheckout(s.f.tenantId, null)).captured).toBe(false);
    await owner.product.update({ where: { id: s.f.products[2]!.id }, data: { status: "DRAFT" } });
    expect((await captureCheckout(s.f.tenantId, { phone: phone(), items: [{ variantId: vid(s.f, 2), quantity: 1 }] })).captured).toBe(false);
    const bad = phone();
    await owner.blockedContact.create({ data: { tenantId: s.f.tenantId, phone: bad, reason: "refused parcels" } });
    expect((await captureCheckout(s.f.tenantId, { phone: bad, items: cart(s.f) })).captured).toBe(false);
    const buyer = phone();
    await place(s.f, buyer);
    expect((await captureCheckout(s.f.tenantId, { phone: buyer, items: cart(s.f) })).captured).toBe(false);
    expect(await open(s.f.tenantId)).toHaveLength(0);
  });

  it("is per store: another store's variant is not a cart here, and rows are not shared", async () => {
    const a = await store("capA");
    const b = await store("capB");
    expect((await captureCheckout(a.f.tenantId, { phone: phone(), items: [{ variantId: vid(b.f), quantity: 1 }] })).captured).toBe(false);
    await captureCheckout(a.f.tenantId, { phone: phone(), items: cart(a.f) });
    expect(await listAbandoned(b.f.tenantId, b.owner, "all")).toHaveLength(0);
    expect(await listAbandoned(a.f.tenantId, a.owner, "all")).toHaveLength(1);
  });

  it("the link restores the cart, only while the checkout is open and the token is exact", async () => {
    const s = await store("rec1");
    const ph = phone();
    await captureCheckout(s.f.tenantId, { phone: ph, name: "Tania", items: cart(s.f, 2) });
    const row = (await open(s.f.tenantId))[0]!;
    expect(await resolveRecovery(s.f.tenantId, row.recoveryToken!)).toEqual({ items: [{ variantId: vid(s.f), quantity: 2 }], name: "Tania", phoneLocal: ph.slice(1) });
    expect(await resolveRecovery(s.f.tenantId, "0".repeat(48))).toBeNull();
    expect(await resolveRecovery(s.f.tenantId, "short")).toBeNull();
    const other = await store("rec2");
    expect(await resolveRecovery(other.f.tenantId, row.recoveryToken!)).toBeNull(); // another store's link means nothing here
    await place(s.f, ph);
    expect(await resolveRecovery(s.f.tenantId, row.recoveryToken!)).toBeNull(); // ordered: closed
  });

  it("placing an order, from the storefront or the quick desk, recovers the checkout", async () => {
    const s = await store("rec3");
    const a = phone(), b = phone();
    await captureCheckout(s.f.tenantId, { phone: a, items: cart(s.f) });
    await captureCheckout(s.f.tenantId, { phone: b, items: cart(s.f) });
    const o1 = await place(s.f, a);
    const q = await createQuickOrder(s.f.tenantId, s.owner, {
      idempotencyKey: key(), customer: { name: "Kamal Hossain", phone: b }, shipping: { address: "House 9, Road 3", upazila: "Mirpur", district: "Dhaka", division: "Dhaka" },
      items: cart(s.f), paymentMethod: "COD", source: "PHONE",
    });
    const rows = await open(s.f.tenantId);
    expect(rows.find((r) => r.phone === a)).toMatchObject({ status: "RECOVERED", recoveredOrderId: o1.orderId, outcome: "ORDER_CREATED" });
    expect(rows.find((r) => r.phone === b)).toMatchObject({ status: "RECOVERED", recoveredOrderId: q.orderId });
    // Closed, so the same number can start a new one later.
    await owner.order.updateMany({ where: { customerPhone: a }, data: { createdAt: new Date(Date.now() - 2 * 60 * MIN) } });
    expect((await captureCheckout(s.f.tenantId, { phone: a, items: cart(s.f) })).captured).toBe(true);
    expect(await open(s.f.tenantId)).toHaveLength(3);
  });
});

describe("the call list", () => {
  it("sorts by value, filters by stage, counts, and measures the week", async () => {
    const s = await store("call1");
    const [p1, p2, p3, p4] = [phone(), phone(), phone(), phone()];
    await captureCheckout(s.f.tenantId, { phone: p1, name: "Small", items: cart(s.f, 1) });
    await captureCheckout(s.f.tenantId, { phone: p2, name: "Big", items: cart(s.f, 3) });
    await captureCheckout(s.f.tenantId, { phone: p3, name: "Called", items: cart(s.f, 2) });
    await captureCheckout(s.f.tenantId, { phone: p4, name: "Done", items: cart(s.f, 1) });
    const rows = await listAbandoned(s.f.tenantId, s.tele, "to_call");
    expect(rows.map((r) => r.name)).toEqual(["Big", "Called", "Done", "Small"]); // by value, then newest first
    const called = rows.find((r) => r.name === "Called")!;
    await logCallOutcome(s.f.tenantId, s.tele, called.id, "NO_ANSWER", "phone off");
    const dead = rows.find((r) => r.name === "Small")!;
    await logCallOutcome(s.f.tenantId, s.tele, dead.id, "NOT_INTERESTED");
    const done = await place(s.f, p4, { items: cart(s.f, 1) });
    expect(await abandonedTabCounts(s.f.tenantId, s.tele)).toEqual({ to_call: 1, called: 1, recovered: 1, lost: 1, all: 4 });
    expect((await listAbandoned(s.f.tenantId, s.tele, "called"))[0]).toMatchObject({ name: "Called", status: "CALL_SCHEDULED", outcome: "NO_ANSWER", callAttempts: 1 });
    const m = await getAbandonedMetrics(s.f.tenantId, s.manager);
    expect(m.dropped7d).toBe(4);
    expect(m.recoveryRatePercent).toBe(25);
    expect(m.recoveredRevenue).toBe(done.totalAmount);
    expect(m.valueLeftBehind).toBe((3 + 2 + 1) * 1150); // everything not recovered, including the one marked not interested
    void p1;
  });

  it("logs outcomes in order, keeps a readable history, and refuses closed rows", async () => {
    const s = await store("call2");
    await captureCheckout(s.f.tenantId, { phone: phone(), items: cart(s.f) });
    const id = (await open(s.f.tenantId))[0]!.id;
    await logCallOutcome(s.f.tenantId, s.tele, id, "NO_ANSWER");
    await logCallOutcome(s.f.tenantId, s.tele, id, "WILL_ORDER", "will order after salary, Friday");
    const row = (await listAbandoned(s.f.tenantId, s.tele, "called"))[0]!;
    expect(row).toMatchObject({ status: "CALL_CONNECTED", outcome: "WILL_ORDER", callAttempts: 2 });
    expect(row.notes).toContain("will order after salary");
    expect(row.notes!.split("\n")).toHaveLength(2);
    await logCallOutcome(s.f.tenantId, s.tele, id, "NOT_INTERESTED");
    await fails(logCallOutcome(s.f.tenantId, s.tele, id, "NO_ANSWER"), "VALIDATION_ERROR", /already closed/);
    await fails(logCallOutcome(s.f.tenantId, s.tele, id, "ORDER_CREATED" as never), "VALIDATION_ERROR");
    await fails(logCallOutcome(s.f.tenantId, s.tele, "nope", "NO_ANSWER"), "NOT_FOUND");
    expect((await owner.auditLog.count({ where: { tenantId: s.f.tenantId, action: "abandoned.call_logged" } }))).toBe(3);
  });

  it("is for people who work customers: telemarketers call, packers only look, content editors see nothing", async () => {
    const s = await store("call3");
    await captureCheckout(s.f.tenantId, { phone: phone(), items: cart(s.f) });
    const id = (await open(s.f.tenantId))[0]!.id;
    expect(await listAbandoned(s.f.tenantId, s.packer, "all")).toHaveLength(1);
    await fails(logCallOutcome(s.f.tenantId, s.packer, id, "NO_ANSWER"), "FORBIDDEN");
    await fails(listAbandoned(s.f.tenantId, s.content, "all"), "FORBIDDEN");
    await logCallOutcome(s.f.tenantId, s.tele, id, "NO_ANSWER");
  });

  it("the cross-store view is closed: another store's row id is not found", async () => {
    const a = await store("callA");
    const b = await store("callB");
    await captureCheckout(a.f.tenantId, { phone: phone(), items: cart(a.f) });
    const id = (await open(a.f.tenantId))[0]!.id;
    await fails(logCallOutcome(b.f.tenantId, b.owner, id, "NO_ANSWER"), "NOT_FOUND");
  });
});

describe("the 30-minute recovery SMS", () => {
  async function waiting(s: Store, minutes: number, extra: Record<string, unknown> = {}) {
    const ph = phone();
    await captureCheckout(s.f.tenantId, { phone: ph, name: "Tania Akter", items: cart(s.f, 2), ...extra });
    const row = (await open(s.f.tenantId)).find((r) => r.phone === ph)!;
    await age(row.id, minutes);
    return { ph, row };
  }
  const now = () => new Date();

  it("waits 30 minutes, then sends one SMS with the store's link and the cart value", async () => {
    const s = await store("sms1", { locale: "en-US" });
    const young = await waiting(s, 20);
    expect(await sendRecoveryMessages(s.f.tenantId, { sender: sms })).toMatchObject({ sent: 0, checked: 0 });
    expect(sms.sent).toHaveLength(0);
    await age(young.row.id, 31);
    const r = await sendRecoveryMessages(s.f.tenantId, { sender: sms });
    expect(r).toEqual({ checked: 1, sent: 1, skipped: 0, failed: 0 });
    expect(sms.sent).toHaveLength(1);
    const m = sms.sent[0]!;
    expect(m.to).toBe(young.ph);
    expect(m.text).toContain("Tania");
    expect(m.text).toContain("৳2300");
    expect(m.text).toContain(`https://${s.f.subdomain}.bt.test/checkout?recover=${young.row.recoveryToken}`);
    expect(await owner.abandonedCheckout.findUniqueOrThrow({ where: { id: young.row.id } })).toMatchObject({ smsStatus: "SENT" });
    // A second run and a third change nothing.
    await sendRecoveryMessages(s.f.tenantId, { sender: sms });
    expect(sms.sent).toHaveLength(1);
  });

  it("two sweeps at once send one message", async () => {
    const s = await store("sms2");
    await waiting(s, 45);
    const slow = new Outbox();
    const send = slow.send.bind(slow);
    slow.send = async (t, to, text) => { await new Promise((r) => setTimeout(r, 120)); return send(t, to, text); };
    await Promise.all([sendRecoveryMessages(s.f.tenantId, { sender: slow }), sendRecoveryMessages(s.f.tenantId, { sender: slow }), sendRecoveryMessages(s.f.tenantId, { sender: slow })]);
    expect(slow.sent).toHaveLength(1);
  });

  it("does not text anyone who ordered meanwhile, opted out, or was already texted today", async () => {
    const s = await store("sms3");
    const ordered = await waiting(s, 40);
    await place(s.f, ordered.ph);
    const out = await waiting(s, 40);
    await owner.smsOptOut.create({ data: { tenantId: s.f.tenantId, phone: out.ph, reason: "USER_STOP_REQUEST" } });
    const r1 = await waiting(s, 40);
    await sendRecoveryMessages(s.f.tenantId, { sender: sms });
    expect(sms.sent.map((m) => m.to)).toEqual([r1.ph]);
    expect((await owner.abandonedCheckout.findUniqueOrThrow({ where: { id: out.row.id } })).smsStatus).toBe("SKIPPED_OPTOUT");
    // The same number leaves a second checkout within a day (the first was closed): no second text.
    await owner.abandonedCheckout.update({ where: { id: r1.row.id }, data: { status: "LOST" } });
    await captureCheckout(s.f.tenantId, { phone: r1.ph, items: cart(s.f) });
    const again = (await open(s.f.tenantId)).find((r) => r.phone === r1.ph && r.status === "CAPTURED")!;
    await age(again.id, 40);
    await sendRecoveryMessages(s.f.tenantId, { sender: sms });
    expect(sms.sent).toHaveLength(1);
    expect((await owner.abandonedCheckout.findUniqueOrThrow({ where: { id: again.id } })).smsStatus).toBe("SKIPPED_LIMIT");
  });

  it("spends the plan's SMS credits and stops when they are gone", async () => {
    const s = await store("sms4");
    await owner.tenant.update({ where: { id: s.f.tenantId }, data: { planTier: "STARTER" } });
    await owner.plan.update({ where: { tier: "STARTER" }, data: { limits: { products: 300, ordersPerMonth: 500, staff: 2, storageGb: 5, smsCredits: 2, landingPages: 3, aiCredits: 50 } } });
    for (let i = 0; i < 3; i++) await waiting(s, 40);
    const r = await sendRecoveryMessages(s.f.tenantId, { sender: sms });
    expect(r).toMatchObject({ sent: 2, skipped: 1 });
    expect((await owner.abandonedCheckout.findMany({ where: { tenantId: s.f.tenantId, smsStatus: "SKIPPED_NO_CREDITS" } }))).toHaveLength(1);
    const used = await owner.usageCounter.findFirstOrThrow({ where: { tenantId: s.f.tenantId, metric: "sms" } });
    expect(Number(used.value)).toBe(2);
    await owner.plan.update({ where: { tier: "STARTER" }, data: { limits: { products: 300, ordersPerMonth: 500, staff: 2, storageGb: 5, smsCredits: 200, landingPages: 3, aiCredits: 50 } } });
  });

  it("a broken SMS provider fails quietly, gives the credit back, and is not retried in a storm", async () => {
    const s = await store("sms5");
    await waiting(s, 40);
    sms.fail = true;
    const r = await sendRecoveryMessages(s.f.tenantId, { sender: sms });
    expect(r).toMatchObject({ sent: 0, failed: 1 });
    expect((await open(s.f.tenantId))[0]).toMatchObject({ smsStatus: "FAILED" });
    expect(Number((await owner.usageCounter.findFirstOrThrow({ where: { tenantId: s.f.tenantId, metric: "sms" } })).value)).toBe(0);
    sms.fail = false;
    await sendRecoveryMessages(s.f.tenantId, { sender: sms });
    expect(sms.sent).toHaveLength(0);
  });

  it("can be switched off per store, and uses the store's own wording and Bangla by default", async () => {
    const off = await store("sms6");
    await owner.storeSettings.update({ where: { tenantId: off.f.tenantId }, data: { abandonedSmsEnabled: false } });
    await waiting(off, 40);
    await sendRecoveryMessages(off.f.tenantId, { sender: sms });
    expect(sms.sent).toHaveLength(0);

    const bn = await store("sms7", { locale: "bn-BD" });
    await waiting(bn, 40);
    await sendRecoveryMessages(bn.f.tenantId, { sender: sms });
    expect(sms.sent[0]!.text).toMatch(/আসসালামু আলাইকুম/);

    const custom = await store("sms8", { locale: "en-US" });
    await owner.messageTemplate.create({ data: { tenantId: custom.f.tenantId, event: "ABANDONED_RECOVERY", channel: "SMS", locale: "en", body: "{customer_name}, your {store_name} basket (৳{total}) is waiting: {link}" } });
    sms.sent = [];
    await waiting(custom, 40);
    await sendRecoveryMessages(custom.f.tenantId, { sender: sms });
    expect(sms.sent[0]!.text).toContain(`Tania Akter, your sms8 basket (৳2300) is waiting: https://${custom.f.subdomain}.bt.test/checkout?recover=`);
    expect(recoveryText("en-US", { name: null, storeName: "S", total: 5, link: "L" })).toBe("Hi, you left items worth ৳5 in your S cart. Finish your order: L");
  });

  it("the scheduled sweep finds every store with something waiting", async () => {
    const a = await store("swA");
    const b = await store("swB");
    const quiet = await store("swC");
    await waiting(a, 40);
    await waiting(b, 40);
    await waiting(quiet, 5);
    const r = await sweepRecoveryMessages({ sender: sms });
    expect(r.stores).toBeGreaterThanOrEqual(2);
    expect(sms.sent.map((m) => m.tenantId).sort()).toEqual([a.f.tenantId, b.f.tenantId].sort());
    void now;
  });
});

// ---- Pixels -------------------------------------------------------------------------------------------------------

interface Hit { url: string; headers: Record<string, string>; body: any }
const meta = {
  hits: [] as Hit[],
  respond: (): Response => new Response(JSON.stringify({ events_received: 1 }), { status: 200 }),
  reset() { this.hits = []; this.respond = () => new Response(JSON.stringify({ events_received: 1 }), { status: 200 }); },
};
const fakeMeta = (async (url: string | URL | Request, init?: RequestInit) => {
  meta.hits.push({ url: String(url), headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)), body: init?.body ? JSON.parse(String(init.body)) : undefined });
  return meta.respond();
}) as typeof fetch;

async function pixelStore(name: string, opts: { token?: boolean; pixel?: boolean } = {}) {
  const s = await store(name);
  if (opts.pixel !== false) await savePixelId(s.f.tenantId, s.owner, "123456789012345");
  if (opts.token !== false) await saveIntegration(s.f.tenantId, { provider: "META_CAPI", mode: "LIVE", secrets: { accessToken: "EAAB-secret-token-xyz" }, config: { pixelId: "123456789012345" } });
  return s;
}
const events = (tenantId: string) => owner.trackingEvent.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
const ctx = { phoneLocal: null, ip: "203.0.113.9", userAgent: "Mozilla/5.0 Test", fbp: "fb.1.1700000000.123", fbc: null };

describe("the Pixel and server-side events", () => {
  beforeEach(() => { meta.reset(); setPixelFetchForTests(fakeMeta); });

  it("saves a Pixel ID after checking its shape, for people who may edit marketing", async () => {
    const s = await store("px1");
    await fails(savePixelId(s.f.tenantId, s.owner, "abc"), "VALIDATION_ERROR", /8 to 20 digits/);
    await fails(savePixelId(s.f.tenantId, s.packer, "123456789012345"), "FORBIDDEN");
    await savePixelId(s.f.tenantId, s.manager, " 123456789012345 ");
    expect((await owner.storeSettings.findFirstOrThrow({ where: { tenantId: s.f.tenantId } })).metaPixelId).toBe("123456789012345");
    await savePixelId(s.f.tenantId, s.owner, "");
    expect((await owner.storeSettings.findFirstOrThrow({ where: { tenantId: s.f.tenantId } })).metaPixelId).toBeNull();
  });

  it("saving one tracking field leaves the others alone, and an empty value clears only that field", async () => {
    const s = await store("px-partial");
    await saveTrackingConfig(s.f.tenantId, s.owner, {
      pixelId: "123456789012345",
      googleAnalyticsId: "G-ABC123XYZ",
      googleTagManagerId: "GTM-ABC123X",
      tiktokPixelId: "TT1234567890",
      ga4ApiSecret: "secret_value_123",
    });
    const read = () => owner.storeSettings.findFirstOrThrow({ where: { tenantId: s.f.tenantId } });

    await savePixelId(s.f.tenantId, s.owner, "999888777666555");
    let row = await read();
    expect(row).toMatchObject({ metaPixelId: "999888777666555", googleAnalyticsId: "G-ABC123XYZ", googleTagManagerId: "GTM-ABC123X", tiktokPixelId: "TT1234567890", ga4ApiSecret: "secret_value_123" });

    await saveTrackingConfig(s.f.tenantId, s.owner, { googleTagManagerId: "" });
    row = await read();
    expect(row).toMatchObject({ metaPixelId: "999888777666555", googleAnalyticsId: "G-ABC123XYZ", googleTagManagerId: null, ga4ApiSecret: "secret_value_123" });

    await saveTrackingConfig(s.f.tenantId, s.owner, {});
    expect(await read()).toMatchObject({ metaPixelId: "999888777666555", googleAnalyticsId: "G-ABC123XYZ" });
  });

  it("reports a GA4 purchase once per order even when the return page and the webhook both try", async () => {
    const s = await store("px-ga4");
    await saveTrackingConfig(s.f.tenantId, s.owner, { googleAnalyticsId: "G-ABC123XYZ", ga4ApiSecret: "secret_value_123" });
    const ga4Hits = () => meta.hits.filter((h) => h.url.includes("google-analytics.com"));
    const purchase = { name: "purchase" as const, transactionId: "ord_ga4_1", value: 1500, items: [{ id: "sku1" }] };

    expect((await sendGa4ServerEvent(s.f.tenantId, purchase)).ok).toBe(true);
    expect((await sendGa4ServerEvent(s.f.tenantId, purchase)).ok).toBe(true);
    expect(ga4Hits()).toHaveLength(1);
    expect(ga4Hits()[0]!.body.events[0].params.transaction_id).toBe("ord_ga4_1");

    // A refund for the same order is a different event and still goes out, once.
    await sendGa4ServerEvent(s.f.tenantId, { ...purchase, name: "refund" });
    await sendGa4ServerEvent(s.f.tenantId, { ...purchase, name: "refund" });
    expect(ga4Hits()).toHaveLength(2);

    // These bookkeeping rows are GA4's, so they never show up in the Meta dashboard counts.
    const rows = await events(s.f.tenantId);
    expect(rows.filter((r) => r.provider === "GA4")).toHaveLength(2);
  });

  it("a failed GA4 send does not block the retry", async () => {
    const s = await store("px-ga4-retry");
    await saveTrackingConfig(s.f.tenantId, s.owner, { googleAnalyticsId: "G-ABC123XYZ", ga4ApiSecret: "secret_value_123" });
    const ev = { name: "purchase" as const, transactionId: "ord_ga4_2", value: 900 };

    meta.respond = () => new Response("nope", { status: 500 });
    expect((await sendGa4ServerEvent(s.f.tenantId, ev)).ok).toBe(false);
    meta.respond = () => new Response(null, { status: 204 });
    expect((await sendGa4ServerEvent(s.f.tenantId, ev)).ok).toBe(true);
    expect(meta.hits.filter((h) => h.url.includes("google-analytics.com"))).toHaveLength(2);
  });

  it("without a Pixel nothing is recorded or sent", async () => {
    const s = await pixelStore("px2", { pixel: false });
    expect(await trackBrowserEvent(s.f.tenantId, { name: "ViewContent", eventId: "vc_abcdefgh1" }, ctx)).toEqual({ recorded: false });
    expect(await events(s.f.tenantId)).toHaveLength(0);
    expect(meta.hits).toHaveLength(0);
  });

  it("a browser event is recorded, then sent from the server with the same id and hashed details", async () => {
    const s = await pixelStore("px3");
    const r = await trackBrowserEvent(s.f.tenantId, { name: "AddToCart", eventId: "atc_0001abcd", url: "https://shop.example/products/x", contentIds: ["SKU-1"], numItems: 2 }, { ...ctx, phoneLocal: "01712345678", email: "Tania@Example.com" });
    expect(r).toEqual({ recorded: true });
    const rows = await events(s.f.tenantId);
    expect(rows.map((e) => `${e.origin}:${e.status}`)).toEqual(["BROWSER:SENT", "SERVER:SENT"]);
    expect(rows.every((e) => e.eventId === "atc_0001abcd" && e.provider === "META")).toBe(true);
    expect(meta.hits).toHaveLength(1);
    const h = meta.hits[0]!;
    expect(h.url).toBe("https://graph.facebook.com/v21.0/123456789012345/events");
    expect(h.headers.Authorization).toBe("Bearer EAAB-secret-token-xyz");
    const ev = h.body.data[0];
    expect(ev).toMatchObject({ event_name: "AddToCart", event_id: "atc_0001abcd", action_source: "website", event_source_url: "https://shop.example/products/x" });
    expect(ev.custom_data).toMatchObject({ content_ids: ["SKU-1"], num_items: 2 });
    expect(ev.user_data.client_ip_address).toBe("203.0.113.9");
    expect(ev.user_data.fbp).toBe("fb.1.1700000000.123");
    // Personal details leave only as SHA-256 hashes: 88 + local number, and the lower-cased email.
    expect(ev.user_data.ph[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(ev.user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(h.body)).not.toMatch(/01712345678|Tania@Example|tania@example/i);
    expect(JSON.stringify(rows.map((e) => e.payload))).not.toContain("01712345678");
  });

  it("the same event arriving twice is counted and sent once", async () => {
    const s = await pixelStore("px4");
    await trackBrowserEvent(s.f.tenantId, { name: "PageView", eventId: "pv_00000001" }, ctx);
    expect(await trackBrowserEvent(s.f.tenantId, { name: "PageView", eventId: "pv_00000001" }, ctx)).toEqual({ recorded: false });
    await Promise.all(Array.from({ length: 5 }, () => trackBrowserEvent(s.f.tenantId, { name: "PageView", eventId: "pv_00000001" }, ctx)));
    expect(await events(s.f.tenantId)).toHaveLength(2);
    expect(meta.hits).toHaveLength(1);
  });

  it("refuses made-up names, bad ids, and a Purchase claimed by the browser", async () => {
    const s = await pixelStore("px5");
    for (const bad of [{ name: "Hack", eventId: "abcdefgh12" }, { name: "PageView", eventId: "x" }, { name: "PageView", eventId: "has space here" }, { name: "Purchase", eventId: "purchase_abcdef" }, null, { name: "PageView" }]) {
      expect(await trackBrowserEvent(s.f.tenantId, bad, ctx)).toEqual({ recorded: false });
    }
    expect(await events(s.f.tenantId)).toHaveLength(0);
  });

  it("with only a Pixel (no server token) the browser event is kept and nothing is sent", async () => {
    const s = await pixelStore("px6", { token: false });
    await trackBrowserEvent(s.f.tenantId, { name: "ViewContent", eventId: "vc_00000002" }, ctx);
    expect((await events(s.f.tenantId)).map((e) => e.origin)).toEqual(["BROWSER"]);
    expect(meta.hits).toHaveLength(0);
  });

  it("a Meta outage is recorded as a failure, without the token in the message, and never throws", async () => {
    const s = await pixelStore("px7");
    meta.respond = () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token EAAB-secret-token-xyz" } }), { status: 400 });
    await trackBrowserEvent(s.f.tenantId, { name: "InitiateCheckout", eventId: "ic_00000003" }, ctx);
    const failed = (await events(s.f.tenantId)).find((e) => e.origin === "SERVER")!;
    expect(failed).toMatchObject({ status: "FAILED", httpStatus: 400 });
    expect(failed.detail).not.toContain("EAAB-secret-token-xyz");
    setPixelFetchForTests((async () => { throw new TypeError("network"); }) as unknown as typeof fetch);
    await trackBrowserEvent(s.f.tenantId, { name: "InitiateCheckout", eventId: "ic_00000004" }, ctx);
    expect((await events(s.f.tenantId)).find((e) => e.eventId === "ic_00000004" && e.origin === "SERVER")).toMatchObject({ status: "FAILED", detail: "Could not reach Meta" });
  });

  it("a Purchase is sent from the server with the order's own value and a shared id the browser can match", async () => {
    const s = await pixelStore("px8");
    const ph = phone();
    const o = await place(s.f, ph, { customer: { name: "Tania Akter", phone: ph, email: "tania@example.com" }, items: [{ variantId: vid(s.f), quantity: 2 }] });
    expect(await sendServerPurchase(s.f.tenantId, o.orderId, { ip: "203.0.113.9", userAgent: "UA", fbp: "fb.1.1.1", url: "https://shop.example/order/x" })).toEqual({ sent: true });
    const hit = meta.hits[0]!.body.data[0];
    expect(hit).toMatchObject({ event_name: "Purchase", event_id: purchaseEventId(o.orderId) });
    expect(hit.custom_data).toMatchObject({ value: o.totalAmount, currency: "BDT", num_items: 2 });
    expect(hit.user_data.ph[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(meta.hits[0]!.body)).not.toContain(ph);
    // Called again (a retry): ignored.
    expect(await sendServerPurchase(s.f.tenantId, o.orderId)).toEqual({ sent: false });
    expect(meta.hits).toHaveLength(1);
    // The thank-you page's browser event uses the same id, and the screen shows the pair as deduplicated.
    const b = await recordBrowserPurchase(s.f.tenantId, o.orderId);
    expect(b).toMatchObject({ eventId: purchaseEventId(o.orderId), value: o.totalAmount, numItems: 2 });
    await recordBrowserPurchase(s.f.tenantId, o.orderId);
    const overview = await getTrackingOverview(s.f.tenantId, s.manager);
    expect(overview.stats.find((e) => e.name === "Purchase")).toEqual({ name: "Purchase", browser: 1, server: 1, deduped: 1, failed: 0 });
    expect(overview.config).toMatchObject({ pixelId: "123456789012345", capiConnected: true, capiMode: "LIVE" });
  });

  it("an order is never touched by Meta being down, and another store's order cannot be reported", async () => {
    const s = await pixelStore("px9");
    const other = await pixelStore("px10");
    const o = await place(s.f, phone());
    meta.respond = () => new Response("{}", { status: 500 });
    expect(await sendServerPurchase(s.f.tenantId, o.orderId)).toEqual({ sent: false });
    expect((await events(s.f.tenantId))[0]).toMatchObject({ origin: "SERVER", status: "FAILED", orderId: o.orderId });
    expect((await owner.order.findUniqueOrThrow({ where: { id: o.orderId } })).status).toBe("PENDING");
    expect(await sendServerPurchase(other.f.tenantId, o.orderId)).toEqual({ sent: false });
    expect(await recordBrowserPurchase(other.f.tenantId, o.orderId)).toBeNull();
    expect(await events(other.f.tenantId)).toHaveLength(0);
  });

  it("sends a test event to Meta's Test Events tab, with checks first", async () => {
    const s = await pixelStore("px11");
    await fails(sendTestEvent(s.f.tenantId, s.owner, "nonsense"), "VALIDATION_ERROR", /test code/);
    await fails(sendTestEvent(s.f.tenantId, s.packer, "TEST12345"), "FORBIDDEN");
    expect(await sendTestEvent(s.f.tenantId, s.owner, "TEST12345")).toMatchObject({ ok: true });
    expect(meta.hits[0]!.body.test_event_code).toBe("TEST12345");
    const bare = await store("px12");
    await fails(sendTestEvent(bare.f.tenantId, bare.owner, "TEST12345"), "VALIDATION_ERROR", /Pixel ID/);
    const noToken = await pixelStore("px13", { token: false });
    await fails(sendTestEvent(noToken.f.tenantId, noToken.owner, "TEST12345"), "VALIDATION_ERROR", /token/);
  });

  it("the overview counts the last 7 days by event and flags failures", async () => {
    const s = await pixelStore("px14");
    await trackBrowserEvent(s.f.tenantId, { name: "PageView", eventId: "pv_aaaaaaaa1" }, ctx);
    await trackBrowserEvent(s.f.tenantId, { name: "PageView", eventId: "pv_aaaaaaaa2" }, ctx);
    meta.respond = () => new Response("{}", { status: 500 });
    await trackBrowserEvent(s.f.tenantId, { name: "AddToCart", eventId: "atc_aaaaaaa1" }, ctx);
    await owner.trackingEvent.updateMany({ where: { tenantId: s.f.tenantId, eventId: "pv_aaaaaaaa2" }, data: { createdAt: new Date(Date.now() - 10 * 86_400_000) } });
    const o = await getTrackingOverview(s.f.tenantId, s.owner);
    expect(o.stats.find((e) => e.name === "PageView")).toMatchObject({ browser: 1, server: 1, deduped: 1 });
    expect(o.stats.find((e) => e.name === "AddToCart")).toMatchObject({ browser: 1, server: 0, deduped: 0, failed: 1 });
    expect(o.recent.length).toBeGreaterThan(0);
    await fails(getTrackingOverview(s.f.tenantId, s.tele), "FORBIDDEN");
  });
});

// ---- Reviews ------------------------------------------------------------------------------------------------------

describe("reviews", () => {
  it("only someone whose order was delivered can review that product, once", async () => {
    const s = await store("rv1");
    const buyer = await delivered(s);
    const stranger = await place(s.f, phone()); // ordered, not delivered
    const strangerCustomer = (await owner.order.findUniqueOrThrow({ where: { id: stranger.orderId } })).customerId!;
    await fails(submitReview(s.f.tenantId, strangerCustomer, { productId: buyer.productId, rating: 5, body: "Loved it, great stuff" }), "VALIDATION_ERROR", /after it has been delivered/);
    await fails(submitReview(s.f.tenantId, buyer.customerId, { productId: s.f.products[1]!.id, rating: 5, body: "Never bought this one" }), "VALIDATION_ERROR", /delivered/);
    expect(await submitReview(s.f.tenantId, buyer.customerId, { productId: buyer.productId, rating: 4, title: "Good fit", body: "Fits well, fabric is soft." })).toEqual({ published: false });
    await fails(submitReview(s.f.tenantId, buyer.customerId, { productId: buyer.productId, rating: 5, body: "Second review attempt" }), "VALIDATION_ERROR", /already reviewed/);
    const row = await owner.review.findFirstOrThrow({ where: { tenantId: s.f.tenantId } });
    expect(row).toMatchObject({ rating: 4, title: "Good fit", isVerified: true, isPublished: false, orderId: buyer.orderId });
  });

  it("checks the rating and the words, and strips markup", async () => {
    const s = await store("rv2");
    const b = await delivered(s);
    for (const bad of [{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: 5, body: "" }, { rating: 5, body: "ok" }, { rating: 5, body: "   <b></b>  " }]) {
      await fails(submitReview(s.f.tenantId, b.customerId, { productId: b.productId, body: "A decent product overall", ...bad }), "VALIDATION_ERROR");
    }
    await submitReview(s.f.tenantId, b.customerId, { productId: b.productId, rating: 5, title: "<script>alert(1)</script>Great", body: "Nice <img src=x onerror=alert(1)> panjabi\u0000 \n\n really" });
    const row = await owner.review.findFirstOrThrow({ where: { tenantId: s.f.tenantId } });
    expect(row.title).toBe("alert(1) Great");
    expect(row.body).toBe("Nice panjabi really");
    expect(cleanText("a   b\tc", 10)).toBe("a b c");
    expect(cleanText("x".repeat(50), 10)).toHaveLength(10);
  });

  it("waits for the owner, who can publish, hide, reply and turn on auto-publish", async () => {
    const s = await store("rv3");
    const b = await delivered(s);
    await submitReview(s.f.tenantId, b.customerId, { productId: b.productId, rating: 5, body: "Perfect, will order again" });
    expect(await listPublicReviews(s.f.tenantId, b.productId)).toHaveLength(0);
    expect(await reviewTabCounts(s.f.tenantId, s.manager)).toEqual({ pending: 1, published: 0, hidden: 0, all: 1 });
    const pending = (await listReviews(s.f.tenantId, s.manager, "pending"))[0]!;
    expect(pending).toMatchObject({ customerName: "Tania Akter", productTitle: b.productId ? expect.any(String) : "", rating: 5 });
    await fails(setReviewPublished(s.f.tenantId, s.packer, pending.id, true), "FORBIDDEN");
    await setReviewPublished(s.f.tenantId, s.manager, pending.id, true);
    await replyToReview(s.f.tenantId, s.manager, pending.id, "Thank you <b>so much</b>!");
    const pub = await listPublicReviews(s.f.tenantId, b.productId);
    expect(pub).toHaveLength(1);
    expect(pub[0]).toMatchObject({ rating: 5, author: "Tania A.", reply: "Thank you so much !" });
    expect(await reviewTabCounts(s.f.tenantId, s.manager)).toMatchObject({ pending: 0, published: 1 });
    await setReviewPublished(s.f.tenantId, s.manager, pending.id, false);
    expect(await listPublicReviews(s.f.tenantId, b.productId)).toHaveLength(0);
    expect(await reviewTabCounts(s.f.tenantId, s.manager)).toMatchObject({ pending: 0, hidden: 1 });
    await fails(setReviewPublished(s.f.tenantId, s.manager, "nope", true), "NOT_FOUND");

    const second = await delivered(s, phone(), 1);
    await setReviewsAutoPublish(s.f.tenantId, s.owner, true);
    expect(await submitReview(s.f.tenantId, second.customerId, { productId: second.productId, rating: 3, body: "Okay but a bit thin" })).toEqual({ published: true });
    expect(await listPublicReviews(s.f.tenantId, second.productId)).toHaveLength(1);
    await fails(setReviewsAutoPublish(s.f.tenantId, s.content, true), "FORBIDDEN");
    expect(await owner.auditLog.count({ where: { tenantId: s.f.tenantId, action: { startsWith: "review." } } })).toBeGreaterThanOrEqual(4);
  });

  it("summarises published reviews only: average, count and a star histogram", async () => {
    const s = await store("rv4");
    await setReviewsAutoPublish(s.f.tenantId, s.owner, true);
    const ratings = [5, 5, 4, 2];
    let productId = "";
    for (const r of ratings) {
      const b = await delivered(s, phone(), 0);
      productId = b.productId;
      await submitReview(s.f.tenantId, b.customerId, { productId, rating: r, body: `Rated it ${r} stars overall` });
    }
    await setReviewsAutoPublish(s.f.tenantId, s.owner, false);
    const hidden = await delivered(s, phone(), 0);
    await submitReview(s.f.tenantId, hidden.customerId, { productId, rating: 1, body: "Terrible, waiting for approval" });
    expect(await getReviewSummary(s.f.tenantId, productId)).toEqual({ count: 4, average: 4, histogram: [0, 1, 0, 1, 2] });
    expect(await getReviewSummary(s.f.tenantId, s.f.products[2]!.id)).toEqual({ count: 0, average: null, histogram: [0, 0, 0, 0, 0] });
  });

  it("lists what a customer can still review, and never shows another store's reviews", async () => {
    const a = await store("rvA");
    const b = await store("rvB");
    const buyer = await delivered(a, phone(), 0);
    await delivered(a, buyer.phone, 1);
    let items = await reviewableItems(a.f.tenantId, buyer.customerId);
    expect(items.map((i) => i.alreadyReviewed)).toEqual([false, false]);
    await submitReview(a.f.tenantId, buyer.customerId, { productId: buyer.productId, rating: 5, body: "Lovely thing, thanks" });
    items = await reviewableItems(a.f.tenantId, buyer.customerId);
    expect(items.find((i) => i.productId === buyer.productId)!.alreadyReviewed).toBe(true);
    expect(await reviewableItems(b.f.tenantId, buyer.customerId)).toEqual([]);
    await fails(submitReview(b.f.tenantId, buyer.customerId, { productId: buyer.productId, rating: 5, body: "Wrong store entirely" }), "VALIDATION_ERROR");
    expect(await listReviews(b.f.tenantId, b.owner, "all")).toHaveLength(0);
  });

  it("shows a short author name", () => {
    expect(displayName("Tania Akter")).toBe("Tania A.");
    expect(displayName("  rahim ")).toBe("rahim");
    expect(displayName("A B C")).toBe("A B.");
  });
});
