import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, bulkChangeStatus, cleanTag, createOrder, getOrderDetail, listOrderTags, listOrders, ordersCsv, setCallNote, setEventPublisher, setOrderTags, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0151${String(2000000 + ++seq).slice(-7)}`;
async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 100 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678", nagadNumber: "01812345678" } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), content: mk("CONTENT_EDITOR", "Tamim") };
}
const place = (f: TenantFixture, over: Record<string, unknown> = {}) =>
  createOrder(f.tenantId, {
    idempotencyKey: `oh-${Date.now()}-${++seq}`, customer: { name: "Test Buyer", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: f.products[0]!.variants[0]!.id, quantity: 1 }], ...over,
  });
const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
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

describe("order labels", () => {
  it("cleans labels to a few lowercase words", () => {
    expect(cleanTag("  Call   FIRST!! ")).toBe("call first");
    expect(cleanTag("গিফট")).toBe("গিফট");
    expect(cleanTag("a".repeat(60)).length).toBe(24);
    expect(cleanTag("=cmd|'x'")).toBe("cmdx");
  });

  it("puts labels on an order, shows them in the list, filters by them and writes it on the timeline", async () => {
    const S = await store("tags");
    const a = await place(S.f);
    const b = await place(S.f);
    expect(await setOrderTags(S.f.tenantId, S.owner, a.orderId, ["Gift", "call first", "gift", ""])).toEqual(["gift", "call first"]);
    expect((await getOrderDetail(S.f.tenantId, S.owner, a.orderId)).tags).toEqual(["gift", "call first"]);
    expect((await listOrders(S.f.tenantId, S.owner, { tag: "GIFT" })).rows.map((r) => r.id)).toEqual([a.orderId]);
    expect((await listOrders(S.f.tenantId, S.owner)).rows.find((r) => r.id === b.orderId)!.tags).toEqual([]);
    expect(await listOrderTags(S.f.tenantId, S.owner)).toEqual([{ tag: "call first", count: 1 }, { tag: "gift", count: 1 }]);
    const e = await owner.orderEvent.findMany({ where: { orderId: a.orderId, type: "TAGS" } });
    expect(e.map((x) => x.message)).toEqual(["Labels: gift, call first"]);
    // saving the same labels again adds nothing to the timeline
    await setOrderTags(S.f.tenantId, S.owner, a.orderId, ["gift", "call first"]);
    expect(await owner.orderEvent.count({ where: { orderId: a.orderId, type: "TAGS" } })).toBe(1);
  });

  it("keeps at most eight labels, and only people who can edit orders can change them", async () => {
    const S = await store("tagcap");
    const o = await place(S.f);
    const many = await setOrderTags(S.f.tenantId, S.owner, o.orderId, Array.from({ length: 12 }, (_, i) => `label ${i}`));
    expect(many).toHaveLength(8);
    await fails(setOrderTags(S.f.tenantId, S.content, o.orderId, ["x"]), "FORBIDDEN");
  });

  it("another store's labels and orders are out of reach", async () => {
    const A = await store("tga");
    const B = await store("tgb");
    const o = await place(A.f);
    await setOrderTags(A.f.tenantId, A.owner, o.orderId, ["secret"]);
    expect(await listOrderTags(B.f.tenantId, B.owner)).toEqual([]);
    await fails(setOrderTags(B.f.tenantId, B.owner, o.orderId, ["x"]), "NOT_FOUND");
  });
});

describe("call note", () => {
  it("is kept on the order and logged, and clearing it is logged too", async () => {
    const S = await store("call");
    const o = await place(S.f);
    await setCallNote(S.f.tenantId, S.owner, o.orderId, "  Said deliver after 6pm  ");
    expect((await getOrderDetail(S.f.tenantId, S.owner, o.orderId)).callNote).toBe("Said deliver after 6pm");
    await setCallNote(S.f.tenantId, S.owner, o.orderId, "");
    expect((await getOrderDetail(S.f.tenantId, S.owner, o.orderId)).callNote).toBeNull();
    const e = await owner.orderEvent.findMany({ where: { orderId: o.orderId, type: "CALL_NOTE" }, orderBy: { createdAt: "asc" } });
    expect(e.map((x) => x.message)).toEqual(["Call note: Said deliver after 6pm", "Call note cleared"]);
  });
});

describe("changing many orders at once", () => {
  it("confirms several, skipping any that cannot be confirmed, and says which", async () => {
    const S = await store("bulkc");
    const a = await place(S.f);
    const b = await place(S.f);
    await bulkChangeStatus(S.f.tenantId, S.owner, [b.orderId], "CANCELLED", "customer asked");
    const r = await bulkChangeStatus(S.f.tenantId, S.owner, [a.orderId, b.orderId, "nope"], "CONFIRMED");
    expect(r.done).toEqual([a.orderId]);
    expect(r.skipped.map((s) => s.id).sort()).toEqual([b.orderId, "nope"].sort());
    expect((await owner.order.findUniqueOrThrow({ where: { id: a.orderId } })).status).toBe("CONFIRMED");
  });

  it("cancelling needs a reason, puts the stock back, and is on each timeline", async () => {
    const S = await store("bulkx");
    const v = S.f.products[0]!.variants[0]!.id;
    const before = (await owner.productVariant.findUniqueOrThrow({ where: { id: v } })).stockQuantity;
    const a = await place(S.f, { items: [{ variantId: v, quantity: 3 }] });
    const b = await place(S.f, { items: [{ variantId: v, quantity: 2 }] });
    await fails(bulkChangeStatus(S.f.tenantId, S.owner, [a.orderId], "CANCELLED", " "), "VALIDATION_ERROR");
    const r = await bulkChangeStatus(S.f.tenantId, S.owner, [a.orderId, b.orderId], "CANCELLED", "fake orders");
    expect(r.done).toHaveLength(2);
    expect((await owner.productVariant.findUniqueOrThrow({ where: { id: v } })).stockQuantity).toBe(before);
    const e = await owner.orderEvent.findMany({ where: { orderId: a.orderId, type: "STATUS" } });
    expect(e.map((x) => x.message)).toContain("Order cancelled: fake orders");
  });

  it("someone without order editing rights cannot use it", async () => {
    const S = await store("bulkf");
    const a = await place(S.f);
    await fails(bulkChangeStatus(S.f.tenantId, S.content, [a.orderId], "CONFIRMED"), "FORBIDDEN");
  });
});

describe("orders spreadsheet", () => {
  it("has one row per item, follows the list filters, and neutralises formulas typed by customers", async () => {
    const S = await store("csv");
    const f = S.f;
    const two = await place(f, {
      customer: { name: '=HYPERLINK("http://x")', phone: phone() },
      items: [{ variantId: f.products[0]!.variants[0]!.id, quantity: 2 }, { variantId: f.products[1]!.variants[0]!.id, quantity: 1 }],
    });
    const other = await place(f);
    await setOrderTags(f.tenantId, S.owner, two.orderId, ["vip"]);
    await setCallNote(f.tenantId, S.owner, two.orderId, "call, then ship");
    const all = (await ordersCsv(f.tenantId, S.owner)).split("\r\n");
    expect(all[0]).toContain('"Order","Date","Status"');
    expect(all).toHaveLength(1 + 2 + 1);
    const tagged = (await ordersCsv(f.tenantId, S.owner, { tag: "vip" })).split("\r\n");
    expect(tagged).toHaveLength(1 + 2);
    expect(tagged.join("\n")).not.toContain(other.orderNumber);
    expect(tagged[1]).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(tagged[1]).toContain('"vip"');
    expect(tagged[1]).toContain('"call, then ship"');
    await fails(ordersCsv(f.tenantId, S.content), "FORBIDDEN");
  });
});
