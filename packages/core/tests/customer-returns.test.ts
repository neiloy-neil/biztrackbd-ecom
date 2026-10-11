import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, createOrder, customerExchangeVariants, customerRequestReturn,
  customerReturnableItems, getCustomerOrderReturns, getOrderTrackingTimeline,
  setEventPublisher, signOrderAccess, transitionOrder, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0171${String(1000000 + ++seq).slice(-7)}`;
const key = () => `ret-${Date.now()}-${++seq}`;

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 20 });
  await owner.storeSettings.create({
    data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678", nagadNumber: "01812345678" },
  });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat") };
}
type Store = Awaited<ReturnType<typeof store>>;
const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;
const merchant = (s: Store) => ({ type: "MERCHANT" as const, id: s.owner.userId, name: "Nusrat" });

async function delivered(s: Store) {
  const o = await createOrder(s.f.tenantId, {
    idempotencyKey: key(),
    customer: { name: "Tania Akter", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(s.f, 0, 1), quantity: 2 }, { variantId: vid(s.f, 2, 0), quantity: 1 }],
  });
  for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const) {
    await transitionOrder(s.f.tenantId, o.orderId, to, merchant(s));
  }
  const items = await owner.orderItem.findMany({ where: { orderId: o.orderId }, orderBy: { totalPrice: "desc" } });
  const ord = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
  return { ...o, customerId: ord.customerId, shirt: items[0]!, chino: items[1]! };
}

const fails = async (p: Promise<unknown>, code: string, msg?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (msg) expect((e as DomainError).message).toMatch(msg);
};

beforeAll(async () => {
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
  process.env.SESSION_SECRET = "test-session-secret-test-session-secret-32b";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
beforeEach(() => setEventPublisher(async () => {}));
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

describe("Customer returns & courier timeline (Phase 5 Section B2)", () => {
  it("rejects unauthorized access without valid token or customer session", async () => {
    const s = await store("RetAuth");
    const o = await delivered(s);

    await fails(
      customerRequestReturn(s.f.tenantId, {
        orderId: o.orderId,
        reason: "Wrong size",
        type: "REFUND",
        items: [{ orderItemId: o.shirt.id, qty: 1 }],
      }, { token: "bad-token" }),
      "NOT_FOUND",
    );
  });

  it("rejects return requests for orders that are not yet delivered", async () => {
    const s = await store("RetNotDeliv");
    const unconfirmed = await createOrder(s.f.tenantId, {
      idempotencyKey: key(),
      customer: { name: "Rifat", phone: phone() },
      shipping: { address: "Banani 11", city: "Dhaka", district: "Dhaka", division: "Dhaka" },
      items: [{ variantId: vid(s.f, 0, 1), quantity: 1 }],
    });
    const token = signOrderAccess(s.f.tenantId, unconfirmed.orderId);

    await fails(
      customerRequestReturn(s.f.tenantId, {
        orderId: unconfirmed.orderId,
        reason: "Changed my mind",
        type: "REFUND",
        items: [{ orderItemId: "any-item", qty: 1 }],
      }, { token }),
      "VALIDATION_ERROR",
      /only be requested for delivered orders/i,
    );
  });

  it("rejects return requests when the 7-day delivery window has expired", async () => {
    const s = await store("RetExpired");
    const o = await delivered(s);
    const token = signOrderAccess(s.f.tenantId, o.orderId);

    // Backdate deliveredAt by 8 days
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000);
    await owner.order.update({
      where: { id: o.orderId },
      data: { deliveredAt: eightDaysAgo, updatedAt: eightDaysAgo },
    });

    await fails(
      customerRequestReturn(s.f.tenantId, {
        orderId: o.orderId,
        reason: "Wrong size",
        type: "REFUND",
        items: [{ orderItemId: o.shirt.id, qty: 1 }],
      }, { token }),
      "VALIDATION_ERROR",
      /7-day return window/i,
    );
  });

  it("requires photo upload for 'Damaged or defective' claims", async () => {
    const s = await store("RetPhotoReq");
    const o = await delivered(s);
    const token = signOrderAccess(s.f.tenantId, o.orderId);

    await fails(
      customerRequestReturn(s.f.tenantId, {
        orderId: o.orderId,
        reason: "Damaged or defective",
        type: "REFUND",
        items: [{ orderItemId: o.shirt.id, qty: 1 }],
        photos: [],
      }, { token }),
      "VALIDATION_ERROR",
      /upload at least one photo/i,
    );
  });

  it("submits a valid refund return request with payout info and creates RT-code", async () => {
    const s = await store("RetSuccess");
    const o = await delivered(s);
    const token = signOrderAccess(s.f.tenantId, o.orderId);

    const res = await customerRequestReturn(s.f.tenantId, {
      orderId: o.orderId,
      reason: "Wrong size",
      customerNote: "Need size L instead",
      type: "REFUND",
      payoutMethod: "BKASH",
      payoutNumber: "01712345678",
      items: [{ orderItemId: o.shirt.id, qty: 1 }],
    }, { token });

    expect(res.code).toMatch(/^RT-\d{4}$/);
    expect(res.status).toBe("PENDING");

    // Verify row in DB
    const saved = await owner.returnRequest.findUniqueOrThrow({ where: { id: res.id } });
    expect(saved.code).toBe(res.code);
    expect(saved.status).toBe("PENDING");
    expect(saved.customerNote).toContain("Refund to: BKASH (01712345678)");
    expect(saved.customerNote).toContain("Need size L instead");

    // Verify customerReturnableItems reflects active return
    const returnable = await customerReturnableItems(s.f.tenantId, o.orderId, { token });
    expect(returnable.eligible).toBe(false);
    expect(returnable.activeReturn?.code).toBe(res.code);
    expect(returnable.activeReturn?.status).toBe("PENDING");

    // Attempting a second active return should fail
    await fails(
      customerRequestReturn(s.f.tenantId, {
        orderId: o.orderId,
        reason: "Changed my mind",
        type: "STORE_CREDIT",
        items: [{ orderItemId: o.chino.id, qty: 1 }],
      }, { token }),
      "VALIDATION_ERROR",
      /already in progress/i,
    );
  });

  it("handles exchange requests with stock validation", async () => {
    const s = await store("RetExchange");
    const o = await delivered(s);
    const token = signOrderAccess(s.f.tenantId, o.orderId);

    // Get exchange options
    const variants = await customerExchangeVariants(s.f.tenantId, o.orderId, { token });
    expect(variants.length).toBeGreaterThan(0);
    const targetVariant = variants[0]!;

    // Fails without variant
    await fails(
      customerRequestReturn(s.f.tenantId, {
        orderId: o.orderId,
        reason: "Wrong size",
        type: "EXCHANGE",
        items: [{ orderItemId: o.shirt.id, qty: 1 }],
      }, { token }),
      "VALIDATION_ERROR",
      /choose the size or colour/i,
    );

    // Succeeds with valid variant
    const exRes = await customerRequestReturn(s.f.tenantId, {
      orderId: o.orderId,
      reason: "Wrong size",
      type: "EXCHANGE",
      exchangeVariantId: targetVariant.id,
      items: [{ orderItemId: o.shirt.id, qty: 1 }],
    }, { token });

    expect(exRes.code).toMatch(/^RT-\d{4}$/);

    const list = await getCustomerOrderReturns(s.f.tenantId, o.orderId, { token });
    expect(list.length).toBe(1);
    expect(list[0]?.exchangeVariantId).toBe(targetVariant.id);
    expect(list[0]?.exchangeLabel).toBeTruthy();
  });

  it("builds the 5-stage order tracking timeline with courier details and checkpoints", async () => {
    const s = await store("TrackTimeline");
    const o = await delivered(s);
    const token = signOrderAccess(s.f.tenantId, o.orderId);

    // Attach courier data and courier event
    await owner.order.update({
      where: { id: o.orderId },
      data: {
        courierProvider: "STEADFAST",
        consignmentId: "CID-998811",
        trackingCode: "ST-998811",
        courierStatus: "in_transit",
      },
    });

    await owner.courierEvent.create({
      data: {
        tenantId: s.f.tenantId,
        provider: "STEADFAST",
        dedupeKey: `st-ev-${Date.now()}`,
        orderId: o.orderId,
        consignmentId: "CID-998811",
        status: "IN_TRANSIT",
        result: "APPLIED",
        payload: { message: "Parcel departed Dhaka central hub" },
      },
    });

    const timeline = await getOrderTrackingTimeline(s.f.tenantId, o.orderId, { token });
    expect(timeline.orderNumber).toBe(o.orderNumber);
    expect(timeline.isDelivered).toBe(true);
    expect(timeline.stages).toHaveLength(5);
    expect(timeline.stages[0]?.id).toBe("PLACED");
    expect(timeline.stages[0]?.completed).toBe(true);
    expect(timeline.stages[4]?.id).toBe("DELIVERED");
    expect(timeline.stages[4]?.completed).toBe(true);

    expect(timeline.courier?.provider).toBe("STEADFAST");
    expect(timeline.courier?.trackingUrl).toContain("steadfast.com.bd/t/ST-998811");

    expect(timeline.checkpoints.length).toBeGreaterThan(0);
    const courierCheckpoint = timeline.checkpoints.find((c) => c.source === "COURIER");
    expect(courierCheckpoint).toBeTruthy();
    expect(courierCheckpoint?.note).toBe("Parcel departed Dhaka central hub");
  });
});
