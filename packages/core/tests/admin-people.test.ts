import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, changePercent, createCustomer, createOrder, createQuickOrder, customersCsv, deleteZone, findCustomerForOrder, getCustomerDetail, getSalesReport,
  getStoreSettings, lastDays, listCustomers, listZones, parseOrderMessage, savePaymentSettings, saveStoreDetails, saveZone, salesReportCsv, searchVariantsForOrder,
  setCustomerBlocked, setEventPublisher, setOrdersPaused, transitionOrder, updateCustomer, type CatalogVariant, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const phone = () => `0191${String(1000000 + ++seq).slice(-7)}`;

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 100 });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), manager: mk("STORE_MANAGER", "Kamrul"), support: mk("TELEMARKETER", "Sumaiya"), packer: mk("ORDER_PACKER", "Rubel") };
}
const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;
const place = (f: TenantFixture, over: Record<string, unknown> = {}) =>
  createOrder(f.tenantId, {
    idempotencyKey: `pp-${++seq}-${Date.now()}`, customer: { name: "Test Buyer", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: vid(f), quantity: 1 }], ...over,
  });
const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  return e as DomainError;
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

describe("customers", () => {
  it("lists customers with their spend and orders, segments them, and searches", async () => {
    const S = await store("cust");
    const repeat = { name: "Repeat Rahim", phone: phone() };
    const one = await place(S.f, { customer: repeat });
    await place(S.f, { customer: repeat });
    await place(S.f, { customer: { name: "Single Karim", phone: phone() } });
    await transitionOrder(S.f.tenantId, one.orderId, "CONFIRMED", { type: "MERCHANT" });
    const all = await listCustomers(S.f.tenantId, S.owner);
    expect(all.total).toBe(2);
    expect(all.summary).toMatchObject({ all: 2, repeatPercent: 50, averageOrderValue: 1230 });
    const rows = Object.fromEntries(all.rows.map((r) => [r.name, r]));
    expect(rows["Repeat Rahim"]).toMatchObject({ orders: 2, area: "Dhanmondi, Dhaka" });
    expect((await listCustomers(S.f.tenantId, S.owner, { segment: "repeat" })).rows.map((r) => r.name)).toEqual(["Repeat Rahim"]);
    expect((await listCustomers(S.f.tenantId, S.owner, { q: "karim" })).total).toBe(1);
    expect((await listCustomers(S.f.tenantId, S.owner, { q: repeat.phone.slice(-6) })).total).toBe(1);
    expect((await listCustomers(S.f.tenantId, S.owner, { q: "%" })).total).toBe(0);
  });

  it("marks VIPs and customers whose parcels came back", async () => {
    const S = await store("seg");
    const vip = await owner.customer.create({ data: { tenantId: S.f.tenantId, name: "Big Spender", phone: phone(), totalSpent: 25000, totalOrders: 4 } });
    const bad = { name: "Returner", phone: phone() };
    const o = await place(S.f, { customer: bad });
    for (const s of ["CONFIRMED", "PROCESSING", "SHIPPED", "RETURNED"] as const) await transitionOrder(S.f.tenantId, o.orderId, s, { type: "MERCHANT" });
    expect((await listCustomers(S.f.tenantId, S.owner, { segment: "vip" })).rows.map((r) => r.id)).toEqual([vip.id]);
    expect((await listCustomers(S.f.tenantId, S.owner, { segment: "failed" })).rows.map((r) => r.name)).toEqual(["Returner"]);
    await owner.customer.update({ where: { id: vip.id }, data: { updatedAt: new Date() } });
    await place(S.f, { customer: { name: "Dormant Dina", phone: phone() } });
    await owner.order.updateMany({ where: { customerName: "Dormant Dina" }, data: { createdAt: new Date(Date.now() - 90 * 86_400_000) } });
    expect((await listCustomers(S.f.tenantId, S.owner, { segment: "dormant" })).rows.map((r) => r.name)).toEqual(["Dormant Dina"]);
  });

  it("shows a customer's orders, stats and address, and lets the team add tags and a private note", async () => {
    const S = await store("detail");
    const buyer = { name: "Tania Akter", phone: phone() };
    const a = await place(S.f, { customer: buyer, items: [{ variantId: vid(S.f), quantity: 1 }, { variantId: vid(S.f, 1), quantity: 1 }, { variantId: vid(S.f, 2), quantity: 1 }] });
    for (const s of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const) await transitionOrder(S.f.tenantId, a.orderId, s, { type: "MERCHANT" });
    const id = (await owner.customer.findFirstOrThrow({ where: { tenantId: S.f.tenantId, phone: buyer.phone } })).id;
    await updateCustomer(S.f.tenantId, S.owner, id, { tags: ["Eid buyer", " VIP ", "Eid buyer"], notes: "Prefers a call before delivery" });
    const d = await getCustomerDetail(S.f.tenantId, S.owner, id);
    expect(d).toMatchObject({ name: "Tania Akter", tags: ["Eid buyer", "VIP"], notes: "Prefers a call before delivery", isBlocked: false });
    expect(d.stats).toMatchObject({ totalSpent: 3290, orders: 1, deliverySuccessPercent: 100 });
    expect(d.orders[0]).toMatchObject({ orderNumber: a.orderNumber, status: "DELIVERED", summary: expect.stringContaining(" + 1") });
    expect(d.address).toMatchObject({ area: "Dhanmondi", district: "Dhaka" });
  });

  it("validates tags and email, and cannot touch another store's customer", async () => {
    const A = await store("ca");
    const B = await store("cb");
    await place(A.f, { customer: { name: "A Customer", phone: phone() } });
    const id = (await owner.customer.findFirstOrThrow({ where: { tenantId: A.f.tenantId } })).id;
    await fails(updateCustomer(A.f.tenantId, A.owner, id, { tags: ["<script>"] }), "VALIDATION_ERROR");
    await fails(updateCustomer(A.f.tenantId, A.owner, id, { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }), "VALIDATION_ERROR");
    await fails(updateCustomer(A.f.tenantId, A.owner, id, { email: "nope" }), "VALIDATION_ERROR");
    await fails(updateCustomer(B.f.tenantId, B.owner, id, { name: "Hijack" }), "NOT_FOUND");
    await fails(getCustomerDetail(B.f.tenantId, B.owner, id), "NOT_FOUND");
    await fails(updateCustomer(A.f.tenantId, A.packer, id, { name: "No" }), "FORBIDDEN"); // packers can only view customers
  });

  it("blocking a customer stops their new orders without telling them why, and unblocking restores them", async () => {
    const S = await store("block");
    const buyer = { name: "Fake Orderer", phone: phone() };
    await place(S.f, { customer: buyer });
    const id = (await owner.customer.findFirstOrThrow({ where: { tenantId: S.f.tenantId, phone: buyer.phone } })).id;
    await setCustomerBlocked(S.f.tenantId, S.owner, id, true, "Refused 3 parcels");
    await fails(place(S.f, { customer: buyer }), "ORDER_NOT_ALLOWED");
    expect((await getCustomerDetail(S.f.tenantId, S.owner, id)).isBlocked).toBe(true);
    expect((await listCustomers(S.f.tenantId, S.owner)).rows[0]!.isBlocked).toBe(true);
    await setCustomerBlocked(S.f.tenantId, S.owner, id, false);
    await expect(place(S.f, { customer: buyer })).resolves.toBeTruthy();
    expect(await owner.auditLog.count({ where: { tenantId: S.f.tenantId, action: { in: ["customer.blocked", "customer.unblocked"] } } })).toBe(2);
  });

  it("adds a customer by hand, and returns the existing one for a known number", async () => {
    const S = await store("add");
    const p = phone();
    const first = await createCustomer(S.f.tenantId, S.owner, { name: "Walk In", phone: `+88${p}` });
    expect(first.created).toBe(true);
    expect(await createCustomer(S.f.tenantId, S.owner, { name: "Other Name", phone: p })).toEqual({ id: first.id, created: false });
    await fails(createCustomer(S.f.tenantId, S.owner, { name: "X", phone: p }), "VALIDATION_ERROR");
    await expect(createCustomer(S.f.tenantId, S.owner, { name: "Bad Phone", phone: "123" })).rejects.toBeInstanceOf(DomainError);
  });

  it("exports a CSV that cannot run formulas when opened in a spreadsheet", async () => {
    const S = await store("csv");
    await owner.customer.create({ data: { tenantId: S.f.tenantId, name: '=HYPERLINK("http://evil.test")', phone: phone(), tags: ["a", "b"] } });
    await owner.customer.create({ data: { tenantId: S.f.tenantId, name: 'Comma, "Quote" Person', phone: phone() } });
    const csv = await customersCsv(S.f.tenantId, S.owner);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"Name","Phone","Email","Orders","Total spent (BDT)","Tags","Joined"');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.test"")"`);
    expect(csv).toContain('"Comma, ""Quote"" Person"');
    await fails(customersCsv(S.f.tenantId, { ...S.owner, role: "CONTENT_EDITOR" }), "FORBIDDEN");
  });
});

describe("sales report", () => {
  async function seed(S: Awaited<ReturnType<typeof store>>) {
    const mk = async (daysAgo: number, over: Record<string, unknown> = {}) => {
      const o = await place(S.f, over);
      await owner.order.update({ where: { id: o.orderId }, data: { createdAt: new Date(Date.now() - daysAgo * 86_400_000) } });
      return o;
    };
    await mk(1); await mk(1, { items: [{ variantId: vid(S.f, 1), quantity: 2 }] }); await mk(3, { shipping: { address: "Village road, Sylhet", city: "Sylhet Sadar", district: "Sylhet", division: "Sylhet" } });
    const c = await mk(2); await transitionOrder(S.f.tenantId, c.orderId, "CANCELLED", { type: "MERCHANT" });
    const r = await mk(2);
    for (const s of ["CONFIRMED", "PROCESSING", "SHIPPED", "RETURNED"] as const) await transitionOrder(S.f.tenantId, r.orderId, s, { type: "MERCHANT" });
    await mk(8); await mk(9, { items: [{ variantId: vid(S.f), quantity: 3 }] }); // the previous period
  }

  it("totals sales and orders for the period, leaves out cancelled and returned orders, and compares with the period before", async () => {
    const S = await store("rep");
    await owner.product.updateMany({ where: { tenantId: S.f.tenantId }, data: { costPrice: 600 } });
    await seed(S);
    const r = await getSalesReport(S.f.tenantId, S.owner, lastDays(7));
    expect(r.days).toBe(7);
    // 1230 (Dhaka, panjabi) + 1780 (linen x2 = 1700 + 80) + 980 ... Sylhet linen? see below
    const expectedSales = 1230 + (850 * 2 + 80) + (1150 + 130);
    expect(r.current).toMatchObject({ sales: expectedSales, orders: 3 });
    expect(r.current.averageOrder).toBe(Math.round(expectedSales / 3));
    expect(r.current.returnRate).toBeGreaterThan(0); // one of five placed orders came back
    expect(r.previous.orders).toBe(2);
    expect(changePercent(r.current.sales, r.previous.sales)).toBe(Math.round(((expectedSales - r.previous.sales) / r.previous.sales) * 100));
    expect(changePercent(5, 0)).toBeNull();
  });

  it("builds the chart series, district split, top products with margin, and payment split", async () => {
    const S = await store("rep2");
    await owner.product.updateMany({ where: { tenantId: S.f.tenantId, title: "Cotton Panjabi, Off-white" }, data: { costPrice: 600 } });
    await seed(S);
    const r = await getSalesReport(S.f.tenantId, S.owner, lastDays(7));
    expect(r.series).toHaveLength(7);
    expect(r.series.reduce((n, d) => n + d.sales, 0)).toBe(r.current.sales);
    expect(r.byDistrict.map((d) => d.district)).toEqual(expect.arrayContaining(["Dhaka", "Sylhet"]));
    const panjabi = r.topProducts.find((p) => p.title === "Cotton Panjabi, Off-white")!;
    expect(panjabi.marginPercent).toBe(Math.round(((panjabi.sales - 600 * panjabi.units) / panjabi.sales) * 100));
    expect(r.topProducts.find((p) => p.title === "Linen Shirt, Sage")!.marginPercent).toBeNull(); // no cost on file: unknown, not zero
    expect(r.byPayment).toEqual([expect.objectContaining({ method: "COD", orders: 3 })]);
  });

  it("validates the range and exports a safe CSV", async () => {
    const S = await store("rep3");
    await place(S.f);
    await fails(getSalesReport(S.f.tenantId, S.owner, { from: "2026-10-10", to: "2026-10-01" }), "VALIDATION_ERROR");
    await fails(getSalesReport(S.f.tenantId, S.owner, { from: "nope", to: "2026-10-01" }), "VALIDATION_ERROR");
    await fails(getSalesReport(S.f.tenantId, S.owner, { from: "2020-01-01", to: "2026-10-01" }), "VALIDATION_ERROR");
    await fails(getSalesReport(S.f.tenantId, S.support, lastDays(7)), "FORBIDDEN");
    const r = await getSalesReport(S.f.tenantId, S.manager, lastDays(7)); // managers can view reports
    r.topProducts.push({ productId: "x", title: "=cmd|' /C calc'!A0", units: 1, sales: 1, marginPercent: null });
    expect(salesReportCsv(r)).toContain(`"'=cmd|' /C calc'!A0"`);
  });

  it("is private to each store", async () => {
    const A = await store("ra");
    const B = await store("rb");
    await place(A.f);
    expect((await getSalesReport(B.f.tenantId, B.owner, lastDays(7))).current).toMatchObject({ sales: 0, orders: 0 });
  });
});

describe("store settings", () => {
  it("saves store details, normalises phones and addresses, and creates the settings row when missing", async () => {
    const S = await store("set");
    await saveStoreDetails(S.f.tenantId, S.owner, {
      storeName: "  Rongdhonu Fashion ", storeNameBn: "রংধনু ফ্যাশন", contactPhone: "+880 1712-345678", whatsappNumber: "01712345678", email: "hello@shop.test",
      facebookUrl: "facebook.com/rongdhonufashion", pickupAddress: "House 22, Road 4, Mirpur 10", orderPrefix: "rf-", logoUrl: "/media/t/logo.webp",
      invoiceOptions: { showQr: true },
    });
    const s = await getStoreSettings(S.f.tenantId, S.owner);
    expect(s).toMatchObject({
      storeName: "Rongdhonu Fashion", storeNameBn: "রংধনু ফ্যাশন", contactPhone: "01712345678", facebookUrl: "https://facebook.com/rongdhonufashion", orderPrefix: "RF-",
      invoiceOptions: { showLogo: true, showSku: true, showQr: true, showPricesOnSlip: false },
    });
    const o = await place(S.f);
    expect(o.orderNumber).toMatch(/^RF-\d+$/);
  });

  it("rejects bad values", async () => {
    const S = await store("setbad");
    const ok = { storeName: "Shop" };
    await fails(saveStoreDetails(S.f.tenantId, S.owner, { storeName: "x" }), "VALIDATION_ERROR");
    await fails(saveStoreDetails(S.f.tenantId, S.owner, { ...ok, contactPhone: "12345" }), "VALIDATION_ERROR");
    await fails(saveStoreDetails(S.f.tenantId, S.owner, { ...ok, email: "no" }), "VALIDATION_ERROR");
    await fails(saveStoreDetails(S.f.tenantId, S.owner, { ...ok, facebookUrl: "javascript:alert(1)" }), "VALIDATION_ERROR");
    await fails(saveStoreDetails(S.f.tenantId, S.owner, { ...ok, orderPrefix: "TOO-LONG-PREFIX" }), "VALIDATION_ERROR");
    await fails(saveStoreDetails(S.f.tenantId, S.owner, { ...ok, logoUrl: "javascript:alert(1)" }), "VALIDATION_ERROR");
    await fails(saveStoreDetails(S.f.tenantId, S.support, ok), "FORBIDDEN");
  });

  it("pausing the store stops orders; reopening restores them", async () => {
    const S = await store("paused");
    await setOrdersPaused(S.f.tenantId, S.manager, true);
    await fails(place(S.f), "STORE_PAUSED");
    await setOrdersPaused(S.f.tenantId, S.manager, false);
    await expect(place(S.f)).resolves.toBeTruthy();
  });

  it("payment settings are owner-only, validated, and audited with the numbers", async () => {
    const S = await store("pay");
    const base = { codEnabled: true, codFee: 0, codMaxAmount: 10000, bkashEnabled: true, nagadEnabled: false };
    await fails(savePaymentSettings(S.f.tenantId, S.manager, { ...base, bkashNumber: "01712345678" }), "FORBIDDEN");
    await fails(savePaymentSettings(S.f.tenantId, S.owner, { ...base }), "VALIDATION_ERROR"); // bKash on, no number
    await fails(savePaymentSettings(S.f.tenantId, S.owner, { ...base, bkashNumber: "123" }), "VALIDATION_ERROR");
    await fails(savePaymentSettings(S.f.tenantId, S.owner, { ...base, bkashNumber: "01712345678", codFee: -5 }), "VALIDATION_ERROR");
    await fails(savePaymentSettings(S.f.tenantId, S.owner, { ...base, bkashNumber: "01712345678", codMaxAmount: 5 }), "VALIDATION_ERROR");
    await fails(savePaymentSettings(S.f.tenantId, S.owner, { codEnabled: false, codFee: 0, codMaxAmount: null, bkashEnabled: false, nagadEnabled: false }), "VALIDATION_ERROR");
    await savePaymentSettings(S.f.tenantId, S.owner, { ...base, bkashNumber: "+8801712345678", bkashKind: "MERCHANT", bkashInstruction: "Use Send Money" });
    expect(await getStoreSettings(S.f.tenantId, S.owner)).toMatchObject({ bkashNumber: "01712345678", bkashKind: "MERCHANT", codMaxAmount: 10000, nagadEnabled: false });
    const log = await owner.auditLog.findFirstOrThrow({ where: { tenantId: S.f.tenantId, action: "settings.payments_changed" } });
    expect(log.details).toMatchObject({ bkashNumber: "01712345678" });
  });

  it("delivery zones: validates districts, charges and times, and stops two zones claiming one district", async () => {
    const S = await store("zones");
    expect((await listZones(S.f.tenantId, S.owner)).map((z) => z.name)).toEqual(["Inside Dhaka city", "Outside Dhaka"]);
    const z = await saveZone(S.f.tenantId, S.owner, { name: "Dhaka suburbs", districts: ["Gazipur", "Narayanganj"], rate: 110, freeOverAmount: 4000, etaMinDays: 2, etaMaxDays: 3 });
    await fails(saveZone(S.f.tenantId, S.owner, { name: "Clash", districts: ["Gazipur"], rate: 100, freeOverAmount: null, etaMinDays: 1, etaMaxDays: 2 }), "VALIDATION_ERROR");
    await fails(saveZone(S.f.tenantId, S.owner, { name: "Atlantis", districts: ["Atlantis"], rate: 100, freeOverAmount: null, etaMinDays: 1, etaMaxDays: 2 }), "VALIDATION_ERROR");
    await fails(saveZone(S.f.tenantId, S.owner, { name: "Mixed", districts: ["*", "Sylhet"], rate: 100, freeOverAmount: null, etaMinDays: 1, etaMaxDays: 2 }), "VALIDATION_ERROR");
    await fails(saveZone(S.f.tenantId, S.owner, { name: "Backwards", districts: ["Sylhet"], rate: 100, freeOverAmount: null, etaMinDays: 5, etaMaxDays: 2 }), "VALIDATION_ERROR");
    await fails(saveZone(S.f.tenantId, S.owner, { name: "Pricey", districts: ["Sylhet"], rate: 99999, freeOverAmount: null, etaMinDays: 1, etaMaxDays: 2 }), "VALIDATION_ERROR");
    await saveZone(S.f.tenantId, S.owner, { name: "Dhaka suburbs", districts: ["Gazipur", "Narayanganj", "Savar".length ? "Munshiganj" : ""], rate: 120, freeOverAmount: 4000, etaMinDays: 2, etaMaxDays: 3 }, z.id);
    // a district moved to a named zone is served by it at checkout
    const o = await place(S.f, { shipping: { address: "House 1, Road 1", city: "Gazipur Sadar", district: "Gazipur", division: "Dhaka" } });
    expect(o.totalAmount).toBe(1150 + 120);
    await deleteZone(S.f.tenantId, S.owner, z.id);
    await fails(deleteZone(S.f.tenantId, S.owner, z.id), "NOT_FOUND");
    await fails(saveZone(S.f.tenantId, S.support, { name: "No", districts: ["Sylhet"], rate: 100, freeOverAmount: null, etaMinDays: 1, etaMaxDays: 2 }), "FORBIDDEN"); // support only views orders
  });
});

describe("quick order desk", () => {
  const catalog: CatalogVariant[] = [
    { productId: "p1", productTitle: "Cotton Panjabi, Off-white", variantId: "v-m", variantTitle: "M", stock: 5 },
    { productId: "p1", productTitle: "Cotton Panjabi, Off-white", variantId: "v-l", variantTitle: "L", stock: 5 },
    { productId: "p2", productTitle: "Linen Shirt, Sage", variantId: "v-s", variantTitle: "S", stock: 5 },
    { productId: "p2", productTitle: "Linen Shirt, Sage", variantId: "v-ls", variantTitle: "M", stock: 5 },
    { productId: "p3", productTitle: "Cotton Socks, 3-pack", variantId: "v-def", variantTitle: "Default", stock: 5 },
  ];

  it("finds the details in the sample message from the design", () => {
    const m = parseOrderMessage("Tania Akter, 01712345678, মিরপুর ১০, ব্লক সি রোড ৭ বাসা ১৪। Panjabi L, 1 pcs. COD", catalog);
    expect(m).toMatchObject({ phone: "01712345678", name: "Tania Akter", district: "Dhaka", upazila: "Mirpur", division: "Dhaka", payment: "COD" });
    expect(m.items).toEqual([{ variantId: "v-l", productId: "p1", label: "Cotton Panjabi, Off-white (L)", quantity: 1 }]);
    expect(m.addressHint).toContain("ব্লক সি রোড ৭ বাসা ১৪");
  });

  it("reads Bangla digits, +880 numbers, quantities and payment words", () => {
    const m = parseOrderMessage("Rahim\n+৮৮০১৮১১২২৩৩৪৪ Sylhet Zindabazar linen shirt M 3 pcs bkash", catalog);
    expect(m.phone).toBe("01811223344");
    expect(m).toMatchObject({ name: "Rahim", district: "Sylhet", division: "Sylhet", payment: "MANUAL_BKASH" });
    expect(m.items[0]).toMatchObject({ variantId: "v-ls", quantity: 3 });
    expect(parseOrderMessage("karim 017-1234-5678 socks nagad", catalog)).toMatchObject({ phone: "01712345678", payment: "MANUAL_NAGAD", items: [{ variantId: "v-def", quantity: 1 }] });
  });

  it("suggests the product but leaves the variant empty when the size is not clear", () => {
    const m = parseOrderMessage("Sara 01912345678 Gazipur panjabi 2 pcs", catalog);
    expect(m.items).toEqual([{ variantId: "", productId: "p1", label: "Cotton Panjabi, Off-white", quantity: 2 }]);
  });

  it("keeps quantity words out of the address hint, in English and Bangla, but keeps real address text", () => {
    const en = parseOrderMessage("Sara, 01912345678, House 5 Road 2 Uttara, panjabi L, 2 pcs, COD", catalog);
    expect(en.addressHint).toContain("House 5 Road 2 Uttara");
    expect(en.addressHint).not.toMatch(/pcs/i);
    const bn = parseOrderMessage("Sara, 01912345678, মিরপুর ১০ ব্লক সি, panjabi L, ২ টি, COD", catalog);
    expect(bn.addressHint).toContain("ব্লক সি");
    expect(bn.addressHint).not.toContain("টি");
  });

  it("returns nothing it is not sure about and never throws on odd input", () => {
    for (const text of ["", "   ", "hello", "12345", "😀😀😀", "<script>alert(1)</script>", "a".repeat(5000), "০১৭১২৩৪৫৬৭৮৯৯৯৯৯৯৯"]) {
      const m = parseOrderMessage(text, catalog);
      expect(m.items.length).toBeLessThanOrEqual(1);
    }
    expect(parseOrderMessage("hello", catalog)).toMatchObject({ phone: null, name: "hello", district: null, items: [] });
    expect(parseOrderMessage("anything", [])).toMatchObject({ items: [] });
  });

  it("recognises a returning customer with their history and last address", async () => {
    const S = await store("qfind");
    const buyer = { name: "Tania Akter", phone: phone() };
    const o = await place(S.f, { customer: buyer });
    for (const s of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const) await transitionOrder(S.f.tenantId, o.orderId, s, { type: "MERCHANT" });
    const c = await findCustomerForOrder(S.f.tenantId, S.owner, buyer.phone.replace(/^0/, "+880"));
    expect(c).toMatchObject({ name: "Tania Akter", orders: 1, deliverySuccessPercent: 100, blocked: false, lastAddress: { area: "Dhanmondi", district: "Dhaka" } });
    expect(await findCustomerForOrder(S.f.tenantId, S.owner, phone())).toBeNull();
    expect(await findCustomerForOrder(S.f.tenantId, S.owner, "nonsense")).toBeNull();
  });

  it("searches variants by name or SKU with stock and price", async () => {
    const S = await store("qsearch");
    const r = await searchVariantsForOrder(S.f.tenantId, S.owner, "panjabi");
    expect(r.map((x) => x.variantTitle).sort()).toEqual(["L", "M", "XL"]);
    expect(r[0]).toMatchObject({ price: 1150, stock: 100 });
    expect((await searchVariantsForOrder(S.f.tenantId, S.owner, "COTTON-PANJABI-OFF-WHITE-XL"))).toHaveLength(1);
    expect(await searchVariantsForOrder(S.f.tenantId, S.owner, "%")).toEqual([]);
  });

  it("keys in an order: tagged with the channel and staff member, exempt from the daily limit, delivery and totals as usual", async () => {
    const S = await store("qorder");
    const buyer = { name: "Regular Buyer", phone: phone() };
    const input = (over: Record<string, unknown> = {}) => ({
      idempotencyKey: `qo-${++seq}-${Date.now()}`, source: "MESSENGER", customer: buyer,
      shipping: { division: "Dhaka", district: "Dhaka", upazila: "Mirpur", address: "House 14, Road 7, Block C" }, items: [{ variantId: vid(S.f), quantity: 1 }], ...over,
    });
    const o = await createQuickOrder(S.f.tenantId, S.support.role === "TELEMARKETER" ? S.owner : S.owner, input());
    expect(o.totalAmount).toBe(1230);
    const row = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(row).toMatchObject({ channel: "QUICK_MESSENGER", createdByUserId: S.owner.userId, shippingCity: "Mirpur", paymentStatus: "UNPAID" });
    const e = await owner.orderEvent.findFirstOrThrow({ where: { orderId: o.orderId, type: "PLACED" } });
    expect(e.message).toBe("Order keyed in by Nusrat (messenger)");
    for (let i = 0; i < 4; i++) await createQuickOrder(S.f.tenantId, S.owner, input()); // more than 3 a day is fine for staff
    expect(await owner.order.count({ where: { tenantId: S.f.tenantId, customerPhone: buyer.phone } })).toBe(5);
  });

  it("an order already paid by bKash starts as paid, with or without a TrxID", async () => {
    const S = await store("qpaid");
    const base = { source: "PHONE", customer: { name: "Phone Buyer", phone: phone() }, shipping: { division: "Dhaka", district: "Dhaka", upazila: "Mirpur", address: "House 14, Road 7" }, items: [{ variantId: vid(S.f), quantity: 1 }], paymentMethod: "MANUAL_BKASH", alreadyPaid: true };
    const a = await createQuickOrder(S.f.tenantId, S.owner, { ...base, idempotencyKey: `qp1-${Date.now()}`, trxId: "9K4M2PX7QA" });
    const b = await createQuickOrder(S.f.tenantId, S.owner, { ...base, idempotencyKey: `qp2-${Date.now()}` });
    for (const id of [a.orderId, b.orderId]) expect(await owner.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ paymentStatus: "PAID", paymentMethod: "MANUAL_BKASH" });
    expect((await owner.orderEvent.findMany({ where: { orderId: a.orderId }, orderBy: { createdAt: "asc" } })).map((e) => e.type)).toEqual(["PLACED", "PAYMENT_VERIFIED"]);
    // the same TrxID cannot back a second order
    await fails(createQuickOrder(S.f.tenantId, S.owner, { ...base, idempotencyKey: `qp3-${Date.now()}`, customer: { name: "Other Buyer", phone: phone() }, trxId: "9K4M2PX7QA" }), "VALIDATION_ERROR");
  });

  it("is limited to staff who can edit orders, and rejects bad input", async () => {
    const S = await store("qperm");
    const ok = { idempotencyKey: `qx-${Date.now()}`, source: "PHONE", customer: { name: "Perm Buyer", phone: phone() }, shipping: { division: "Dhaka", district: "Dhaka", upazila: "Mirpur", address: "House 14, Road 7" }, items: [{ variantId: vid(S.f), quantity: 1 }] };
    await fails(createQuickOrder(S.f.tenantId, S.support, ok), "FORBIDDEN");
    await fails(createQuickOrder(S.f.tenantId, S.owner, { ...ok, items: [] }), "VALIDATION_ERROR");
    await fails(createQuickOrder(S.f.tenantId, S.owner, { ...ok, source: "CARRIER_PIGEON" }), "VALIDATION_ERROR");
    await expect(createQuickOrder(S.f.tenantId, S.owner, { ...ok, customer: { name: "Bad Phone", phone: "123456789" } })).rejects.toBeInstanceOf(DomainError);
  });
});
