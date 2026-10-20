import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  CourierError, DomainError, WebhookAuthError, applyCourierUpdate, bookCourier, bookCouriers, createOrder, handleCourierWebhook, listConnectedCouriers, loadCredentials,
  markParcelReturned, releaseHold, saveIntegration, setAdapterFactory, setEventPublisher, syncCourierStatuses, testCourierConnection, transitionOrder,
  type AdapterFactory, type BookingParcel, type CourierAdapter, type CourierProviderKey, type CourierStatus, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0151${String(1000000 + ++seq).slice(-7)}`;
const key = () => `crr-${Date.now()}-${++seq}`;
const trx = () => `TX${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "A");

/** A scriptable courier. Tests set what the next book(), status() and webhook should do. */
const fake = {
  booked: [] as BookingParcel[],
  nextBook: (): Promise<{ consignmentId: string; trackingCode: string; status: CourierStatus }> => Promise.resolve({ consignmentId: `C${++seq}`, trackingCode: `TRK${seq}`, status: "BOOKED" }),
  statuses: new Map<string, CourierStatus>(),
  verifyError: null as Error | null,
  badSignature: false,
  reset() {
    this.booked = [];
    this.statuses = new Map();
    this.verifyError = null;
    this.badSignature = false;
    this.nextBook = () => Promise.resolve({ consignmentId: `C${++seq}`, trackingCode: `TRK${seq}`, status: "BOOKED" });
  },
};
const factory: AdapterFactory = (provider: CourierProviderKey): CourierAdapter => ({
  provider,
  verify: async () => { if (fake.verifyError) throw fake.verifyError; },
  book: async (p) => {
    fake.booked.push(p);
    return fake.nextBook();
  },
  status: async (ref) => {
    const s = fake.statuses.get(ref.consignmentId);
    if (!s) throw new CourierError("not found", provider);
    return { status: s, rawStatus: s.toLowerCase() };
  },
  parseWebhook: (_h, body) => {
    if (fake.badSignature) throw new WebhookAuthError();
    const b = body as { consignment?: string; invoice?: string; status?: CourierStatus; at?: string };
    return b.status ? { consignmentId: b.consignment, invoice: b.invoice, status: b.status, rawStatus: String(b.status).toLowerCase(), occurredAt: b.at ? new Date(b.at) : undefined } : null;
  },
});

async function store(name: string, opts: { plan?: "STARTER" | "PRO"; connect?: boolean } = {}) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 50 });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: opts.plan ?? "PRO" } });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678", nagadNumber: "01812345678" } });
  if (opts.connect !== false) await saveIntegration(f.tenantId, { provider: "STEADFAST", mode: "LIVE", secrets: { apiKey: "key-live-111", secretKey: "secret-live-222" } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), packer: mk("ORDER_PACKER", "Rubel"), support: mk("TELEMARKETER", "Sumaiya") };
}
type Store = Awaited<ReturnType<typeof store>>;

const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;
const place = (f: TenantFixture, over: Record<string, unknown> = {}) =>
  createOrder(f.tenantId, {
    idempotencyKey: key(), customer: { name: "Test Buyer", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(f), quantity: 1 }], ...over,
  });
const merchant = (s: Store) => ({ type: "MERCHANT" as const, id: s.owner.userId, name: "Nusrat" });
/** A confirmed COD order, ready to book. */
async function ready(s: Store, over: Record<string, unknown> = {}) {
  const o = await place(s.f, over);
  await transitionOrder(s.f.tenantId, o.orderId, "CONFIRMED", merchant(s));
  return o;
}
const row = (id: string) => owner.order.findUniqueOrThrow({ where: { id } });
const events = (orderId: string) => owner.orderEvent.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
const fails = async (p: Promise<unknown>, code?: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, "expected a failure").toBeInstanceOf(DomainError);
  if (code) expect((e as DomainError).code).toBe(code);
  return e as DomainError;
};
const tokenOf = async (s: Store) => (await loadCredentials(s.f.tenantId, "STEADFAST", "LIVE")).integrationToken;
const hook = (token: string, body: unknown, headers: Record<string, string> = {}) => handleCourierWebhook(token, headers, JSON.stringify(body));

beforeAll(async () => {
  process.env.INTEGRATION_VAULT_SECRET = randomBytes(32).toString("hex");
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
beforeEach(() => {
  setEventPublisher(async () => {});
  setAdapterFactory(factory);
  fake.reset();
});
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

describe("booking a courier", () => {
  it("books, ships the order, and tells the courier how much cash to collect", async () => {
    const s = await store("book");
    const o = await ready(s);
    const r = await bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" });
    const after = await row(o.orderId);
    expect(after.status).toBe("SHIPPED");
    expect(after.courierProvider).toBe("STEADFAST");
    expect(after.consignmentId).toBe(r.consignmentId);
    expect(after.trackingCode).toBe(r.trackingCode);
    expect(after.courierStatus).toBe("BOOKED");
    expect(after.courierBookedAt).not.toBeNull();
    expect(after.courierBookingLock).toBeNull();
    expect(fake.booked).toHaveLength(1);
    expect(fake.booked[0]).toMatchObject({ orderNumber: o.orderNumber, codAmount: o.totalAmount, recipientName: "Test Buyer" });
    const types = (await events(o.orderId)).map((e) => e.type);
    expect(types).toContain("COURIER_BOOKED");
    expect(await owner.auditLog.count({ where: { tenantId: s.f.tenantId, action: "courier.booked" } })).toBe(1);
    // Packed on the way out: the state log shows the whole path.
    const path = (await owner.orderStateLog.findMany({ where: { orderId: o.orderId }, orderBy: { createdAt: "asc" } })).map((l) => l.toStatus);
    expect(path).toEqual(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"]);
  });

  it("collects nothing for an order already paid", async () => {
    const s = await store("prepaid");
    const o = await place(s.f, { paymentMethod: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId: trx() } });
    await fails(bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" }), "VALIDATION_ERROR"); // still pending
    await withTenant(s.f.tenantId, (tx) => tx.order.update({ where: { id: o.orderId }, data: { paymentStatus: "PAID", status: "CONFIRMED" } }));
    await bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" });
    expect(fake.booked[0]!.codAmount).toBe(0);
  });

  it("will not book an unconfirmed mobile-money payment, a new order, or a closed one", async () => {
    const s = await store("guards");
    const fresh = await place(s.f);
    expect((await fails(bookCourier(s.f.tenantId, s.owner, fresh.orderId, { provider: "STEADFAST" }))).message).toMatch(/Confirm the order/);
    const mfs = await place(s.f, { paymentMethod: "MANUAL_NAGAD", mfs: { senderNumber: "01712345678", trxId: trx() } });
    await transitionOrder(s.f.tenantId, mfs.orderId, "CONFIRMED", merchant(s));
    expect((await fails(bookCourier(s.f.tenantId, s.owner, mfs.orderId, { provider: "STEADFAST" }))).message).toMatch(/Confirm the payment/);
    const gone = await ready(s);
    await transitionOrder(s.f.tenantId, gone.orderId, "CANCELLED", merchant(s));
    await fails(bookCourier(s.f.tenantId, s.owner, gone.orderId, { provider: "STEADFAST" }), "VALIDATION_ERROR");
    expect(fake.booked).toHaveLength(0);
  });

  it("books exactly once when clicked many times at once", async () => {
    const s = await store("race");
    const o = await ready(s);
    fake.nextBook = async () => {
      await new Promise((r) => setTimeout(r, 150));
      return { consignmentId: `C${++seq}`, trackingCode: "ONLY", status: "BOOKED" };
    };
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(fake.booked).toHaveLength(1);
    const after = await row(o.orderId);
    expect(after.trackingCode).toBe("ONLY");
    expect(after.status).toBe("SHIPPED");
  });

  it("refuses a second booking of a booked parcel", async () => {
    const s = await store("twice");
    const o = await ready(s);
    await bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" });
    // SHIPPED now, so the status check answers first; either way nothing reaches the courier again.
    await fails(bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" }), "VALIDATION_ERROR");
    expect(fake.booked).toHaveLength(1);
  });

  it("is a paid plan feature", async () => {
    const s = await store("starter", { plan: "STARTER" });
    const o = await ready(s);
    await fails(bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" }), "PLAN_FEATURE");
    expect(fake.booked).toHaveLength(0);
    expect((await row(o.orderId)).status).toBe("CONFIRMED");
  });

  it("needs the courier to be connected", async () => {
    const s = await store("unconnected", { connect: false });
    const o = await ready(s);
    expect((await fails(bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" }), "VALIDATION_ERROR")).message).toMatch(/not connected/);
    await fails(bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "NOPE" }), "VALIDATION_ERROR");
  });

  it("is limited to people who may edit orders, and to the store's own orders", async () => {
    const a = await store("permA");
    const b = await store("permB");
    const o = await ready(a);
    await fails(bookCourier(a.f.tenantId, a.support, o.orderId, { provider: "STEADFAST" }), "FORBIDDEN");
    await fails(bookCourier(b.f.tenantId, b.owner, o.orderId, { provider: "STEADFAST" }), "NOT_FOUND");
    expect(fake.booked).toHaveLength(0);
    // A packer may book.
    await bookCourier(a.f.tenantId, a.packer, o.orderId, { provider: "STEADFAST" });
  });

  it("keeps a held order from shipping until the owner releases it", async () => {
    const s = await store("held");
    const o = await ready(s);
    await withTenant(s.f.tenantId, (tx) => tx.order.update({ where: { id: o.orderId }, data: { fraudReview: "HELD" } }));
    expect((await fails(bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" }))).message).toMatch(/held for review/);
    await releaseHold(s.f.tenantId, s.owner, o.orderId, "called, confirmed");
    await bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" });
    expect((await row(o.orderId)).status).toBe("SHIPPED");
  });

  it("releases the lock when the courier refuses, so the owner can fix the order and retry", async () => {
    const s = await store("refused");
    const o = await ready(s);
    fake.nextBook = () => Promise.reject(new CourierError("Steadfast said: Invalid recipient phone", "Steadfast"));
    await fails(bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" }), "COURIER_ERROR");
    const mid = await row(o.orderId);
    expect(mid.status).toBe("PROCESSING");
    expect(mid.consignmentId).toBeNull();
    expect(mid.courierBookingLock).toBeNull();
    expect((await events(o.orderId)).find((e) => e.type === "COURIER_FAILED")?.message).toMatch(/Invalid recipient phone/);
    fake.reset();
    await bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" });
    expect((await row(o.orderId)).status).toBe("SHIPPED");
  });

  it("does not rebook blindly when the courier's reply was lost", async () => {
    const s = await store("ambiguous");
    const o = await ready(s);
    fake.nextBook = () => Promise.reject(new CourierError("Could not reach Steadfast. Check Steadfast's portal before trying again.", "Steadfast", true));
    await fails(bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" }), "COURIER_ERROR");
    expect((await row(o.orderId)).courierBookingLock).not.toBeNull();
    fake.reset();
    expect((await fails(bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" }), "VALIDATION_ERROR")).message).toMatch(/already in progress/);
    expect(fake.booked).toHaveLength(0);
    // The owner has checked the portal and nothing was booked: the lock expires by itself.
    await owner.$executeRaw`UPDATE "Order" SET "courierBookingLock" = now() - interval '3 minutes' WHERE id = ${o.orderId}`;
    await bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" });
    expect(fake.booked).toHaveLength(1);
  });

  it("books a batch and reports what it skipped", async () => {
    const s = await store("batch");
    const good = await ready(s);
    const bad = await place(s.f); // still new
    const r = await bookCouriers(s.f.tenantId, s.owner, [good.orderId, bad.orderId, good.orderId], { provider: "STEADFAST" });
    expect(r.done).toHaveLength(1);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0]!.id).toBe(bad.orderId);
  });

  it("lists connected couriers and records a connection test", async () => {
    const s = await store("conn");
    expect((await listConnectedCouriers(s.f.tenantId)).map((c) => c.provider)).toEqual(["STEADFAST"]);
    expect(await testCourierConnection(s.f.tenantId, s.owner, "STEADFAST", "LIVE")).toEqual({ ok: true });
    expect((await owner.tenantIntegration.findFirstOrThrow({ where: { tenantId: s.f.tenantId } })).lastVerifiedAt).not.toBeNull();
    fake.verifyError = new CourierError("Steadfast did not accept the keys.", "Steadfast");
    expect(await testCourierConnection(s.f.tenantId, s.owner, "STEADFAST", "LIVE")).toEqual({ ok: false, error: "Steadfast did not accept the keys." });
    expect((await owner.tenantIntegration.findFirstOrThrow({ where: { tenantId: s.f.tenantId } })).status).toBe("NEEDS_ATTENTION");
    await fails(testCourierConnection(s.f.tenantId, { ...s.owner, role: "STORE_MANAGER" }, "STEADFAST", "LIVE"), "FORBIDDEN");
  });
});

describe("courier callbacks", () => {
  async function shipped(s: Store, over: Record<string, unknown> = {}) {
    const o = await ready(s, over);
    const b = await bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" });
    return { ...o, consignment: b.consignmentId };
  }

  it("delivered: closes the order, records the cash the courier now holds, and counts the sale", async () => {
    const s = await store("hookdelivered");
    const o = await shipped(s);
    const token = await tokenOf(s);
    const r = await hook(token, { consignment: o.consignment, invoice: o.orderNumber, status: "DELIVERED", at: "2026-10-10T10:00:00Z" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, result: "APPLIED" });
    const after = await row(o.orderId);
    expect(after.status).toBe("DELIVERED");
    expect(after.paymentStatus).toBe("PAID");
    expect(after.settlementStatus).toBe("COLLECTED_UNSETTLED");
    expect(after.deliveredAt).not.toBeNull();
    expect(after.courierStatus).toBe("DELIVERED");
    expect(Number((await owner.customer.findFirstOrThrow({ where: { id: after.customerId! } })).totalSpent)).toBe(o.totalAmount);
    const ev = await owner.courierEvent.findMany({ where: { orderId: o.orderId } });
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ result: "APPLIED", status: "DELIVERED", source: "WEBHOOK" });
  });

  it("does nothing the second time the same message arrives", async () => {
    const s = await store("hookdup");
    const o = await shipped(s);
    const token = await tokenOf(s);
    const msg = { consignment: o.consignment, status: "DELIVERED", at: "2026-10-10T10:00:00Z" };
    await hook(token, msg);
    const again = await hook(token, msg);
    expect(again.body).toMatchObject({ duplicate: true });
    expect(await owner.courierEvent.count({ where: { orderId: o.orderId } })).toBe(1);
    expect(await owner.orderStateLog.count({ where: { orderId: o.orderId, toStatus: "DELIVERED" } })).toBe(1);
    // Many copies at once still change the order once.
    const o2 = await shipped(s);
    const burst = await Promise.all(Array.from({ length: 5 }, () => hook(token, { consignment: o2.consignment, status: "DELIVERED", at: "2026-10-10T11:00:00Z" })));
    expect(burst.every((r) => r.status === 200)).toBe(true);
    expect(await owner.orderStateLog.count({ where: { orderId: o2.orderId, toStatus: "DELIVERED" } })).toBe(1);
    expect(Number((await owner.customer.findFirstOrThrow({ where: { id: (await row(o2.orderId)).customerId! } })).totalSpent)).toBe(o2.totalAmount);
  });

  it("ignores progress that arrives late or out of order", async () => {
    const s = await store("hookorder");
    const o = await shipped(s);
    const token = await tokenOf(s);
    await hook(token, { consignment: o.consignment, status: "IN_TRANSIT", at: "2026-10-10T08:00:00Z" });
    expect((await row(o.orderId)).courierStatus).toBe("IN_TRANSIT");
    await hook(token, { consignment: o.consignment, status: "PICKED_UP", at: "2026-10-10T07:00:00Z" });
    expect((await row(o.orderId)).courierStatus).toBe("IN_TRANSIT");
    await hook(token, { consignment: o.consignment, status: "DELIVERED", at: "2026-10-10T09:00:00Z" });
    await hook(token, { consignment: o.consignment, status: "IN_TRANSIT", at: "2026-10-10T08:30:00Z" });
    const after = await row(o.orderId);
    expect(after.status).toBe("DELIVERED");
    expect(after.courierStatus).toBe("DELIVERED");
  });

  it("returned: keeps the stock out until the warehouse checks the parcel (the default), and counts against the buyer's record", async () => {
    const s = await store("hookreturn");
    const before = (await owner.productVariant.findUniqueOrThrow({ where: { id: vid(s.f) } })).stockQuantity;
    const o = await shipped(s);
    expect((await owner.productVariant.findUniqueOrThrow({ where: { id: vid(s.f) } })).stockQuantity).toBe(before - 1);
    const r = await hook(await tokenOf(s), { consignment: o.consignment, status: "RETURNED", at: "2026-10-10T12:00:00Z" });
    expect(r.body).toMatchObject({ result: "APPLIED" });
    const after = await row(o.orderId);
    expect(after.status).toBe("RETURNED");
    expect(after.returnedAt).not.toBeNull();
    expect(after.trustRecorded).toBe("RETURNED");
    // courierAutoRestockOnReturn is off by default: a returned parcel is only put back on the shelf after a physical check.
    expect((await owner.productVariant.findUniqueOrThrow({ where: { id: vid(s.f) } })).stockQuantity).toBe(before - 1);
  });

  it("refused at the door is remembered as a refusal", async () => {
    const s = await store("hookrefused");
    const o = await shipped(s);
    await hook(await tokenOf(s), { consignment: o.consignment, status: "REFUSED", at: "2026-10-10T12:00:00Z" });
    const after = await row(o.orderId);
    expect(after.status).toBe("RETURNED");
    expect(after.refusedAtDoor).toBe(true);
    expect(after.trustRecorded).toBe("REFUSED");
  });

  it("answers unknown tokens, bad bodies, bad signatures and strangers' parcels without changing anything", async () => {
    const s = await store("hookbad");
    const other = await store("hookother");
    const o = await shipped(s);
    const token = await tokenOf(s);
    expect((await hook("0".repeat(48), { consignment: o.consignment, status: "DELIVERED" })).status).toBe(404);
    expect((await hook("not-a-token", {})).status).toBe(404);
    expect((await handleCourierWebhook(token, {}, "{not json")).status).toBe(400);
    fake.badSignature = true;
    expect((await hook(token, { consignment: o.consignment, status: "DELIVERED" })).status).toBe(401);
    fake.badSignature = false;
    // Another store's token cannot touch this store's parcel, even with the right consignment id.
    const r = await hook(await tokenOf(other), { consignment: o.consignment, status: "DELIVERED" });
    expect(r.body).toMatchObject({ result: "UNKNOWN_ORDER" });
    expect((await row(o.orderId)).status).toBe("SHIPPED");
    // A parcel we never booked is acknowledged (so the courier stops retrying) and logged.
    const unknown = await hook(token, { consignment: "NOPE-1", status: "DELIVERED" });
    expect(unknown.status).toBe(200);
    expect(await owner.courierEvent.count({ where: { tenantId: s.f.tenantId, result: "UNKNOWN_ORDER" } })).toBe(1);
    // A message with no status change is ignored.
    expect((await hook(token, { note: "hub scan" })).body).toMatchObject({ ignored: true });
  });

  it("keeps secrets out of the stored callback", async () => {
    const s = await store("hookredact");
    const o = await shipped(s);
    await hook(await tokenOf(s), { consignment: o.consignment, status: "IN_TRANSIT", at: "2026-10-10T08:00:00Z", api_key: "SHOULD-NOT-BE-STORED" });
    const ev = await owner.courierEvent.findFirstOrThrow({ where: { orderId: o.orderId } });
    expect(JSON.stringify(ev.payload)).not.toContain("SHOULD-NOT-BE-STORED");
  });

  it("an order the owner already closed stays closed", async () => {
    const s = await store("hookclosed");
    const o = await shipped(s);
    await applyCourierUpdate(s.f.tenantId, o.orderId, "STEADFAST", { status: "DELIVERED", rawStatus: "delivered" });
    // A late "returned" after delivery is a courier correction and is applied; a late "delivered" after return is not.
    await applyCourierUpdate(s.f.tenantId, o.orderId, "STEADFAST", { status: "RETURNED", rawStatus: "cancelled" });
    expect((await row(o.orderId)).status).toBe("RETURNED");
    expect(await applyCourierUpdate(s.f.tenantId, o.orderId, "STEADFAST", { status: "DELIVERED", rawStatus: "delivered" })).toBe("IGNORED");
    expect((await row(o.orderId)).status).toBe("RETURNED");
    // The customer's lifetime spend went up on delivery and back down on return.
    expect(Number((await owner.customer.findFirstOrThrow({ where: { id: (await row(o.orderId)).customerId! } })).totalSpent)).toBe(0);
  });
});

describe("the 30-minute sync", () => {
  async function shipped(s: Store) {
    const o = await ready(s);
    const b = await bookCourier(s.f.tenantId, s.owner, o.orderId, { provider: "STEADFAST" });
    return { ...o, consignment: b.consignmentId };
  }

  it("catches up on parcels the callbacks missed", async () => {
    const s = await store("sync");
    const a = await shipped(s);
    const b = await shipped(s);
    const c = await shipped(s);
    fake.statuses.set(a.consignment, "DELIVERED");
    fake.statuses.set(b.consignment, "IN_TRANSIT");
    // c has no status at the courier: that parcel fails alone and does not stop the others.
    await owner.$executeRaw`UPDATE "Order" SET "courierSyncedAt" = timezone('utc', now()) - interval '1 hour' WHERE "tenantId" = ${s.f.tenantId}`;
    const sum = await syncCourierStatuses(s.f.tenantId);
    expect(sum).toEqual({ checked: 3, changed: 1, failed: 1 });
    expect((await row(a.orderId)).status).toBe("DELIVERED");
    expect((await row(b.orderId)).courierStatus).toBe("IN_TRANSIT");
    expect((await row(c.orderId)).status).toBe("SHIPPED");
  });

  it("skips parcels it looked at a moment ago, but a manual refresh looks anyway", async () => {
    const s = await store("syncfresh");
    const a = await shipped(s);
    fake.statuses.set(a.consignment, "DELIVERED");
    expect(await syncCourierStatuses(s.f.tenantId)).toEqual({ checked: 0, changed: 0, failed: 0 });
    expect(await syncCourierStatuses(s.f.tenantId, { orderIds: [a.orderId] })).toMatchObject({ checked: 1, changed: 1 });
  });

  it("never touches another store's parcels", async () => {
    const a = await store("syncA");
    const b = await store("syncB");
    const oa = await shipped(a);
    const ob = await shipped(b);
    fake.statuses.set(oa.consignment, "DELIVERED");
    fake.statuses.set(ob.consignment, "DELIVERED");
    await owner.$executeRaw`UPDATE "Order" SET "courierSyncedAt" = timezone('utc', now()) - interval '1 hour'`;
    await syncCourierStatuses(a.f.tenantId);
    expect((await row(oa.orderId)).status).toBe("DELIVERED");
    expect((await row(ob.orderId)).status).toBe("SHIPPED");
  });
});

describe("returned by hand", () => {
  it("lets the owner record a refusal for a parcel they delivered themselves", async () => {
    const s = await store("manualreturn", { connect: false });
    const o = await ready(s);
    await transitionOrder(s.f.tenantId, o.orderId, "PROCESSING", merchant(s));
    await transitionOrder(s.f.tenantId, o.orderId, "SHIPPED", merchant(s));
    await fails(markParcelReturned(s.f.tenantId, s.support, o.orderId, { refused: true }), "FORBIDDEN");
    await markParcelReturned(s.f.tenantId, s.owner, o.orderId, { refused: true, note: "said wrong colour" });
    const after = await row(o.orderId);
    expect(after).toMatchObject({ status: "RETURNED", refusedAtDoor: true, trustRecorded: "REFUSED" });
    expect((await events(o.orderId)).some((e) => /refused at the door/.test(e.message))).toBe(true);
  });
});
