import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, cancelDraftOrder, createDraftOrder, draftLink, getOrderDetail, listDraftOrders, placeDraftOrder, setEventPublisher, viewDraftOrder, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0171${String(4000000 + ++seq).slice(-7)}`;
const trx = () => `TX${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "A");
async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 10 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678", nagadNumber: "01812345678" } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), content: mk("CONTENT_EDITOR", "Tamim") };
}
const input = (f: TenantFixture, over: Record<string, unknown> = {}) => ({
  customer: { name: "Tania Akter", phone: phone() },
  shipping: { division: "Dhaka", district: "Dhaka", upazila: "Dhanmondi", address: "House 4, Road 2, Dhanmondi" },
  items: [{ variantId: f.products[0]!.variants[0]!.id, quantity: 2 }], ...over,
});
const fails = async (p: Promise<unknown>, code: string, text?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (text) expect((e as DomainError).message).toMatch(text);
};

beforeAll(async () => {
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
beforeEach(() => setEventPublisher(async () => {}));
afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("draft orders", () => {
  it("the owner makes a draft, the customer opens the link and places it, and it becomes a normal order", async () => {
    const S = await store("draft");
    const d = await createDraftOrder(S.f.tenantId, S.owner, input(S.f, { note: "Gift wrap please" }));
    expect(d.code).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(d.total).toBeGreaterThan(0);
    expect(await draftLink(S.f.tenantId, d.code)).toMatch(new RegExp(`/draft/${d.code}$`));
    expect((await listDraftOrders(S.f.tenantId, S.owner))[0]).toMatchObject({ status: "OPEN", customerName: "Tania Akter", itemCount: 2, opened: 0, createdBy: "Nusrat" });

    const v = await viewDraftOrder(S.f.tenantId, d.code);
    expect(v.state).toBe("open");
    if (v.state !== "open") return;
    expect(v.customer.name).toBe("Tania Akter");
    expect(v.quote.lines).toHaveLength(1);
    expect(v.quote.total).toBe(d.total);
    expect(v.quote.paymentOptions.cod.available).toBe(true);
    expect((await listDraftOrders(S.f.tenantId, S.owner))[0]!.opened).toBe(1);

    const stockBefore = (await owner.productVariant.findUniqueOrThrow({ where: { id: S.f.products[0]!.variants[0]!.id } })).stockQuantity;
    const placed = await placeDraftOrder(S.f.tenantId, d.code, { paymentMethod: "COD" });
    expect(placed.totalAmount).toBe(d.total);
    expect((await owner.productVariant.findUniqueOrThrow({ where: { id: S.f.products[0]!.variants[0]!.id } })).stockQuantity).toBe(stockBefore - 2);
    const o = await getOrderDetail(S.f.tenantId, S.owner, placed.orderId);
    expect(o).toMatchObject({ customerName: "Tania Akter", notes: "Gift wrap please" });
    expect(o.events.map((e) => e.message)).toContain("Placed from the order link Nusrat sent");
    const row = (await listDraftOrders(S.f.tenantId, S.owner))[0]!;
    expect(row).toMatchObject({ status: "CONVERTED", orderId: placed.orderId });
    // opening the link again leads to the order, and a second tap places nothing more
    expect(await viewDraftOrder(S.f.tenantId, d.code)).toEqual({ state: "converted", orderId: placed.orderId });
    const again = await placeDraftOrder(S.f.tenantId, d.code, { paymentMethod: "COD" });
    expect(again.orderId).toBe(placed.orderId);
    expect(await owner.order.count({ where: { tenantId: S.f.tenantId } })).toBe(1);
    expect((await owner.productVariant.findUniqueOrThrow({ where: { id: S.f.products[0]!.variants[0]!.id } })).stockQuantity).toBe(stockBefore - 2);
  });

  it("two people tapping at the same moment still place it once", async () => {
    const S = await store("draftrace");
    const d = await createDraftOrder(S.f.tenantId, S.owner, input(S.f));
    const r = await Promise.all([placeDraftOrder(S.f.tenantId, d.code, { paymentMethod: "COD" }), placeDraftOrder(S.f.tenantId, d.code, { paymentMethod: "COD" })]);
    expect(r[0].orderId).toBe(r[1].orderId);
    expect(await owner.order.count({ where: { tenantId: S.f.tenantId } })).toBe(1);
  });

  it("pays by bKash with a TrxID, and the order waits for the owner to check it", async () => {
    const S = await store("draftpay");
    const d = await createDraftOrder(S.f.tenantId, S.owner, input(S.f));
    await fails(placeDraftOrder(S.f.tenantId, d.code, { paymentMethod: "MANUAL_BKASH" }), "VALIDATION_ERROR");
    const placed = await placeDraftOrder(S.f.tenantId, d.code, { paymentMethod: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId: trx() } });
    expect((await getOrderDetail(S.f.tenantId, S.owner, placed.orderId)).paymentStatus).toBe("PENDING_VERIFICATION");
  });

  it("prices it when the customer places it: a changed price is the price they pay, shown before they confirm", async () => {
    const S = await store("draftprice");
    const v = S.f.products[0]!.variants[0]!;
    const d = await createDraftOrder(S.f.tenantId, S.owner, input(S.f));
    await owner.productVariant.update({ where: { id: v.id }, data: { price: 5000 } });
    const view = await viewDraftOrder(S.f.tenantId, d.code);
    expect(view.state === "open" && view.quote.subtotal).toBe(10000);
    const placed = await placeDraftOrder(S.f.tenantId, d.code, { paymentMethod: "COD" });
    expect((await getOrderDetail(S.f.tenantId, S.owner, placed.orderId)).totals.subtotal).toBe(10000);
  });

  it("a cancelled or expired draft cannot be placed, and says so in plain words", async () => {
    const S = await store("draftdead");
    const a = await createDraftOrder(S.f.tenantId, S.owner, input(S.f));
    await cancelDraftOrder(S.f.tenantId, S.owner, (await listDraftOrders(S.f.tenantId, S.owner))[0]!.id);
    expect(await viewDraftOrder(S.f.tenantId, a.code)).toEqual({ state: "cancelled" });
    await fails(placeDraftOrder(S.f.tenantId, a.code, { paymentMethod: "COD" }), "DRAFT_CANCELLED");
    const b = await createDraftOrder(S.f.tenantId, S.owner, input(S.f, { hours: 1 }));
    await owner.cartShortLink.updateMany({ where: { shortCode: b.code }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await viewDraftOrder(S.f.tenantId, b.code)).toEqual({ state: "expired" });
    await fails(placeDraftOrder(S.f.tenantId, b.code, { paymentMethod: "COD" }), "DRAFT_EXPIRED", /expired/);
    expect(await owner.order.count({ where: { tenantId: S.f.tenantId } })).toBe(0);
  });

  it("refuses a draft with a bad address, too little stock, or a coupon that does not work", async () => {
    const S = await store("draftbad");
    await fails(createDraftOrder(S.f.tenantId, S.owner, input(S.f, { shipping: { division: "Dhaka", district: "Chittagong", upazila: "Nowhere", address: "House 4, Road 2" } })), "VALIDATION_ERROR");
    await fails(createDraftOrder(S.f.tenantId, S.owner, input(S.f, { items: [{ variantId: S.f.products[0]!.variants[0]!.id, quantity: 40 }] })), "VALIDATION_ERROR", /Only 10 left/);
    await fails(createDraftOrder(S.f.tenantId, S.owner, input(S.f, { couponCode: "NOPE" })), "VALIDATION_ERROR");
    await fails(createDraftOrder(S.f.tenantId, S.owner, input(S.f, { customer: { name: "T", phone: phone() } })), "VALIDATION_ERROR");
    await fails(createDraftOrder(S.f.tenantId, S.content, input(S.f)), "FORBIDDEN");
    expect(await listDraftOrders(S.f.tenantId, S.owner)).toEqual([]);
  });

  it("a link works only in the store that made it, and a guessed code gets nothing", async () => {
    const A = await store("drafta");
    const B = await store("draftb");
    const d = await createDraftOrder(A.f.tenantId, A.owner, input(A.f));
    expect(await viewDraftOrder(B.f.tenantId, d.code)).toEqual({ state: "missing" });
    await fails(placeDraftOrder(B.f.tenantId, d.code, { paymentMethod: "COD" }), "NOT_FOUND");
    expect(await viewDraftOrder(A.f.tenantId, "AAAAAAAAAAAA")).toEqual({ state: "missing" });
    expect(await viewDraftOrder(A.f.tenantId, "short")).toEqual({ state: "missing" });
    expect(await listDraftOrders(B.f.tenantId, B.owner)).toEqual([]);
  });

  it("a paused store does not take the order", async () => {
    const S = await store("draftpause");
    const d = await createDraftOrder(S.f.tenantId, S.owner, input(S.f));
    await owner.storeSettings.update({ where: { tenantId: S.f.tenantId }, data: { ordersPaused: true } });
    await fails(placeDraftOrder(S.f.tenantId, d.code, { paymentMethod: "COD" }), "STORE_PAUSED");
  });
});
