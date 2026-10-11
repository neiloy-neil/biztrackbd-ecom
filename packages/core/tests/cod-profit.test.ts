import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, acceptShortPayment, addDays, addExpense, createOrder, deleteExpense, dhakaDate, expectedFor, getCodDashboard, getProfitReport, importStatement, listExpenses,
  listReconciliation, listSettlements, parseCsv, parseMoney, raiseDispute, readStatement, setEventPublisher, transitionOrder, DEFAULT_RATES, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0181${String(1000000 + ++seq).slice(-7)}`;
const key = () => `cod-${Date.now()}-${++seq}`;
const TODAY = () => dhakaDate(new Date());

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 100 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678", nagadNumber: "01812345678" } });
  await owner.product.updateMany({ where: { tenantId: f.tenantId, id: f.products[0]!.id }, data: { costPrice: 600 } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), manager: mk("STORE_MANAGER", "Kamrul"), packer: mk("ORDER_PACKER", "Rubel") };
}
type Store = Awaited<ReturnType<typeof store>>;
const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;
const merchant = (s: Store) => ({ type: "MERCHANT" as const, id: s.owner.userId, name: "Nusrat" });
const fails = async (p: Promise<unknown>, code: string, msg?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (msg) expect((e as DomainError).message).toMatch(msg);
};
const order = (id: string) => owner.order.findUniqueOrThrow({ where: { id } });

let cid = 5000;
/** A cash-on-delivery order shipped with Steadfast and delivered. Total 1230 inside Dhaka (1150 + 80). */
async function parcel(s: Store, opts: { to?: "DELIVERED" | "RETURNED" | "SHIPPED"; district?: string; courier?: "STEADFAST" | "PATHAO"; items?: { variantId: string; quantity: number }[] } = {}) {
  const district = opts.district ?? "Dhaka";
  const o = await createOrder(s.f.tenantId, {
    idempotencyKey: key(), customer: { name: "Cod Buyer", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district, division: district === "Dhaka" ? "Dhaka" : "Chattogram" },
    items: opts.items ?? [{ variantId: vid(s.f), quantity: 1 }],
  });
  const consignmentId = `${++cid}`;
  await transitionOrder(s.f.tenantId, o.orderId, "CONFIRMED", merchant(s));
  await transitionOrder(s.f.tenantId, o.orderId, "PROCESSING", merchant(s));
  await owner.order.update({ where: { id: o.orderId }, data: { courierProvider: opts.courier ?? "STEADFAST", consignmentId, trackingCode: `TRK${consignmentId}`, courierBookedAt: new Date() } });
  await transitionOrder(s.f.tenantId, o.orderId, "SHIPPED", merchant(s));
  const to = opts.to ?? "DELIVERED";
  if (to !== "SHIPPED") await transitionOrder(s.f.tenantId, o.orderId, to, merchant(s));
  return { ...o, consignmentId };
}

const HEADER = "Consignment ID,Invoice,COD Amount,Delivery Charge,COD Charge,Payable,Status";
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");
const stmt = (over: Record<string, unknown> = {}) => ({ courier: "STEADFAST", invoiceNumber: `INV-${++seq}`, disbursedAt: TODAY(), paymentMethod: "BEFTN_BANK", csv: "", ...over });

beforeAll(async () => {
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
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

describe("reading a statement", () => {
  it("parses quoted cells, a byte-order mark, Windows line breaks and blank lines", () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","say ""hi""",3\r\n\r\n4,5,6');
    expect(rows).toEqual([["a", "b", "c"], ["x, y", 'say "hi"', "3"], ["4", "5", "6"]]);
  });

  it("reads money however a courier writes it", () => {
    expect(parseMoney("৳ 1,250.50")).toBe(1250.5);
    expect(parseMoney("Tk 1250")).toBe(1250);
    expect(parseMoney("১২৫০")).toBe(1250);
    expect(parseMoney("(120)")).toBe(-120);
    expect(parseMoney("-30")).toBe(-30);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("n/a")).toBeNull();
  });

  it("finds the columns by their usual names, even under a title line", () => {
    const rows = readStatement(`Steadfast payout report\n${HEADER}\n5001,BT-1,"1,230",70,12.30,"1,147.70",Delivered\n5002,BT-2,1230,70,0,0,Cancelled`);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ ref: "5001", invoice: "BT-1", collected: 1230, delivery: 70, codFee: 12.3, net: 1147.7, returned: false });
    expect(rows[1]).toMatchObject({ returned: true });
  });

  it("works out the payout itself when the file has no payable column", () => {
    const rows = readStatement("cid,cod,delivery_charge,cod_charge\n5001,1230,70,12.30");
    expect(rows[0]!.net).toBe(1147.7);
    const net = readStatement("consignment_id,collected_amount,net_payable\n5001,1230,1100");
    expect(net[0]).toMatchObject({ net: 1100, delivery: 130 });
  });

  it("explains what is wrong with a file it cannot read", () => {
    expect(() => readStatement("")).toThrow(/no rows/);
    expect(() => readStatement("name,age\nx,1")).toThrow(/could not find the columns/);
    expect(() => readStatement(`${HEADER}\n`)).toThrow(/no rows/);
    expect(() => readStatement(`${HEADER}\n,,100,,,,`)).toThrow(/no parcels/);
  });
});

describe("what a parcel should pay", () => {
  it("is the cash collected, less the delivery charge and the COD fee", () => {
    const base = { paymentMethod: "COD", settlementStatus: "COLLECTED_UNSETTLED", totalAmount: 1230, courierBookingFee: null, shippingDistrict: "Dhaka" };
    expect(expectedFor(base, DEFAULT_RATES)).toEqual({ collected: 1230, delivery: 70, codFee: 12.3, net: 1147.7 });
    expect(expectedFor({ ...base, shippingDistrict: "Chattogram" }, DEFAULT_RATES).delivery).toBe(130);
    expect(expectedFor({ ...base, courierBookingFee: 83 }, DEFAULT_RATES).delivery).toBe(83);
    // Paid in advance: no cash, only the courier's charge.
    expect(expectedFor({ ...base, paymentMethod: "MANUAL_BKASH" }, DEFAULT_RATES)).toMatchObject({ collected: 0, codFee: 0, net: -70 });
  });
});

describe("importing a payout statement", () => {
  it("matches what was paid, flags what was paid short, and records returns", async () => {
    const s = await store("import");
    const ok = await parcel(s);
    const short = await parcel(s);
    const back = await parcel(s, { to: "RETURNED" });
    const waiting = await parcel(s);
    expect((await order(ok.orderId)).settlementStatus).toBe("COLLECTED_UNSETTLED");

    const res = await importStatement(s.f.tenantId, s.owner, stmt({
      invoiceNumber: "INV-100",
      csv: csv(
        `${ok.consignmentId},${ok.orderNumber},1230,70,12.30,1147.70,Delivered`,
        `${short.consignmentId},${short.orderNumber},1230,70,12.30,1117.70,Delivered`, // 30 short
        `${back.consignmentId},${back.orderNumber},0,70,0,-70,Returned`,
        `99999,BT-NOPE,500,70,5,425,Delivered`,
      ),
    }));
    expect(res).toMatchObject({ parcels: 3, matched: 1, shortPaid: 1, returned: 1, shortfall: 30, invoiceNumber: "INV-100" });
    expect(res.unmatched).toEqual([{ row: 5, ref: "99999" }]);
    expect(res.disbursed).toBe(1147.7 + 1117.7 - 70);

    expect((await order(ok.orderId)).settlementStatus).toBe("SETTLED");
    expect((await order(short.orderId)).settlementStatus).toBe("DISCREPANCY_FLAGGED");
    expect((await order(back.orderId)).settlementStatus).toBe("SETTLED");
    expect((await order(waiting.orderId)).settlementStatus).toBe("COLLECTED_UNSETTLED");

    const inv = await owner.courierSettlementInvoice.findFirstOrThrow({ where: { tenantId: s.f.tenantId } });
    expect(Number(inv.totalCodCollected)).toBe(2460);
    expect(Number(inv.deliveryFeesTotal)).toBe(210);
    expect(Number(inv.codServiceFee)).toBe(24.6);
    expect(Number(inv.disbursedAmount)).toBe(res.disbursed);
    const lines = await owner.courierSettledOrder.findMany({ where: { settlementId: inv.id }, orderBy: { codCollected: "desc" } });
    expect(lines.map((l) => l.result).sort()).toEqual(["MATCHED", "RETURNED", "SHORT_PAID"]);
    expect(await owner.orderEvent.count({ where: { tenantId: s.f.tenantId, type: "SETTLEMENT" } })).toBe(3);

    const rows = await listReconciliation(s.f.tenantId, s.owner, { filter: "all" });
    expect(rows.find((r) => r.orderId === short.orderId)).toMatchObject({ state: "SHORT_PAID", shortfall: 30, netPaid: 1117.7, expectedNet: 1147.7, invoiceNumber: "INV-100" });
    expect(rows.find((r) => r.orderId === waiting.orderId)).toMatchObject({ state: "NOT_PAID", netPaid: null, expectedNet: 1147.7 });
    expect((await listReconciliation(s.f.tenantId, s.owner, { filter: "attention" })).map((r) => r.orderId)).toEqual([short.orderId]);
    expect((await listReconciliation(s.f.tenantId, s.owner, { filter: "returns" })).map((r) => r.orderId)).toEqual([back.orderId]);
    expect((await listReconciliation(s.f.tenantId, s.owner, { filter: "unpaid" })).map((r) => r.orderId)).toEqual([waiting.orderId]);
    expect((await listReconciliation(s.f.tenantId, s.owner, { filter: "matched" })).map((r) => r.orderId)).toEqual([ok.orderId]);
    expect((await listReconciliation(s.f.tenantId, s.owner, { filter: "all", courier: "PATHAO" }))).toHaveLength(0);
    expect(await listSettlements(s.f.tenantId, s.owner)).toMatchObject([{ invoiceNumber: "INV-100", parcels: 3, courier: "STEADFAST" }]);
  });

  it("gives a plain-words guess at why a payout was short", async () => {
    const s = await store("reasons");
    const twice = await parcel(s);
    const rate = await parcel(s);
    const none = await parcel(s);
    await importStatement(s.f.tenantId, s.owner, stmt({
      csv: csv(
        `${twice.consignmentId},,1230,70,24.60,1135.40,Delivered`, // COD fee taken twice (12.30 extra)
        `${rate.consignmentId},,1230,130,12.30,1087.70,Delivered`, // outside-Dhaka rate (60 extra)
        `${none.consignmentId},,1230,70,12.30,0,Delivered`, // paid nothing
      ),
    }));
    const rows = await listReconciliation(s.f.tenantId, s.owner, { filter: "attention" });
    const reason = (id: string) => rows.find((r) => r.orderId === id)!.reason;
    expect(reason(twice.orderId)).toMatch(/COD fee .* twice/);
    expect(reason(rate.orderId)).toMatch(/outside-Dhaka/);
    expect(reason(none.orderId)).toMatch(/not paid out/);
  });

  it("will not import the same payout twice, or count a parcel twice", async () => {
    const s = await store("dups");
    const a = await parcel(s);
    const b = await parcel(s);
    const input = stmt({ invoiceNumber: "INV-DUP", csv: csv(`${a.consignmentId},,1230,70,12.30,1147.70,Delivered`) });
    await importStatement(s.f.tenantId, s.owner, input);
    await fails(importStatement(s.f.tenantId, s.owner, input), "VALIDATION_ERROR", /already imported/);
    // The same parcel on a later statement is reported, not added again.
    const again = await importStatement(s.f.tenantId, s.owner, stmt({
      csv: csv(`${a.consignmentId},,1230,70,12.30,1147.70,Delivered`, `${b.consignmentId},,1230,70,12.30,1147.70,Delivered`, `${b.consignmentId},,1230,70,12.30,1147.70,Delivered`),
    }));
    expect(again.parcels).toBe(1);
    expect(again.duplicates).toHaveLength(2);
    expect(again.duplicates[0]).toMatchObject({ orderNumber: a.orderNumber });
    expect(await owner.courierSettledOrder.count({ where: { orderId: a.orderId } })).toBe(1);
  });

  it("matches by order number when the file has no consignment id, and only for that courier", async () => {
    const s = await store("byinvoice");
    const a = await parcel(s);
    await fails(importStatement(s.f.tenantId, s.owner, stmt({ courier: "PATHAO", csv: csv(`${a.consignmentId},${a.orderNumber},1230,70,12.30,1147.70,Delivered`) })), "VALIDATION_ERROR", /None of the parcels/);
    const r = await importStatement(s.f.tenantId, s.owner, stmt({ csv: "Invoice,COD Amount,Payable\n" + `${a.orderNumber},1230,1147.70` }));
    expect(r).toMatchObject({ parcels: 1, matched: 1 });
  });

  it("is for the owner only, and rejects bad input", async () => {
    const s = await store("importperm");
    const a = await parcel(s);
    const good = stmt({ csv: csv(`${a.consignmentId},,1230,70,12.30,1147.70,Delivered`) });
    await fails(importStatement(s.f.tenantId, s.manager, good), "FORBIDDEN");
    await fails(importStatement(s.f.tenantId, s.packer, good), "FORBIDDEN");
    await fails(importStatement(s.f.tenantId, s.owner, { ...good, invoiceNumber: "" }), "VALIDATION_ERROR");
    await fails(importStatement(s.f.tenantId, s.owner, { ...good, disbursedAt: "10/10/2026" }), "VALIDATION_ERROR");
    await fails(importStatement(s.f.tenantId, s.owner, { ...good, courier: "FEDEX" }), "VALIDATION_ERROR");
    await fails(importStatement(s.f.tenantId, s.owner, { ...good, csv: "x".repeat(1_600_000) }), "VALIDATION_ERROR", /too large/);
  });

  it("never matches another store's parcels, even with the same consignment id", async () => {
    const a = await store("tenA");
    const b = await store("tenB");
    const pa = await parcel(a);
    await owner.order.updateMany({ where: { tenantId: b.f.tenantId }, data: {} });
    await fails(importStatement(b.f.tenantId, b.owner, stmt({ csv: csv(`${pa.consignmentId},${pa.orderNumber},1230,70,12.30,1147.70,Delivered`) })), "VALIDATION_ERROR", /None of the parcels/);
    expect((await order(pa.orderId)).settlementStatus).toBe("COLLECTED_UNSETTLED");
    expect(await listReconciliation(b.f.tenantId, b.owner, { filter: "all" })).toHaveLength(0);
    expect(await listSettlements(b.f.tenantId, b.owner)).toHaveLength(0);
  });
});

describe("acting on a short payment", () => {
  it("accepting closes it; disputing keeps it open and leaves a note", async () => {
    const s = await store("resolve");
    const a = await parcel(s);
    const b = await parcel(s);
    await importStatement(s.f.tenantId, s.owner, stmt({ csv: csv(`${a.consignmentId},,1230,70,12.30,1100,Delivered`, `${b.consignmentId},,1230,70,12.30,1100,Delivered`) }));
    const rows = await listReconciliation(s.f.tenantId, s.owner, { filter: "attention" });
    expect(rows).toHaveLength(2);
    const la = rows.find((r) => r.orderId === a.orderId)!.lineId!;
    const lb = rows.find((r) => r.orderId === b.orderId)!.lineId!;

    await fails(acceptShortPayment(s.f.tenantId, s.manager, la), "FORBIDDEN");
    await acceptShortPayment(s.f.tenantId, s.owner, la);
    expect((await order(a.orderId)).settlementStatus).toBe("SETTLED");
    expect((await listReconciliation(s.f.tenantId, s.owner, { filter: "attention" })).map((r) => r.orderId)).toEqual([b.orderId]);
    expect((await listReconciliation(s.f.tenantId, s.owner, { filter: "matched" })).map((r) => r.orderId)).toContain(a.orderId);

    await fails(raiseDispute(s.f.tenantId, s.owner, lb, " "), "VALIDATION_ERROR");
    await raiseDispute(s.f.tenantId, s.owner, lb, "Called Steadfast, they will recheck");
    expect((await order(b.orderId)).settlementStatus).toBe("DISCREPANCY_FLAGGED");
    expect((await owner.orderEvent.findMany({ where: { orderId: b.orderId, type: "SETTLEMENT" } })).some((e) => /Dispute raised/.test(e.message))).toBe(true);
    await fails(acceptShortPayment(s.f.tenantId, s.owner, "nope"), "NOT_FOUND");
  });
});

describe("the receivables screen", () => {
  it("shows what couriers hold, what is overdue, what was paid and what does not match", async () => {
    const s = await store("dash");
    const a = await parcel(s); // Steadfast, waiting
    const b = await parcel(s, { courier: "PATHAO" }); // Pathao, waiting and overdue
    const c = await parcel(s);
    const d = await parcel(s);
    await parcel(s, { to: "SHIPPED" }); // still on the road: not owed yet
    await owner.order.update({ where: { id: b.orderId }, data: { deliveredAt: new Date(Date.now() - 10 * 86_400_000) } });

    let dash = await getCodDashboard(s.f.tenantId, s.manager);
    expect(dash.owed.total).toBe(4590.8);
    expect(dash.owed.byCourier).toEqual([{ courier: "STEADFAST", amount: 3443.1, parcels: 3 }, { courier: "PATHAO", amount: 1147.7, parcels: 1 }]);
    expect(dash.overdue).toEqual({ parcels: 1, amount: 1147.7 });
    expect(dash.settledThisMonth).toEqual({ amount: 0, payouts: 0 });

    await importStatement(s.f.tenantId, s.owner, stmt({ csv: csv(`${c.consignmentId},,1230,70,12.30,1147.70,Delivered`, `${d.consignmentId},,1230,70,12.30,1100,Delivered`) }));
    dash = await getCodDashboard(s.f.tenantId, s.manager);
    expect(dash.owed.total).toBe(2295.4);
    expect(dash.settledThisMonth).toEqual({ amount: 2247.7, payouts: 1 });
    expect(dash.deductionsThisMonth).toEqual({ delivery: 140, codFee: 24.6, returns: 0, total: 164.6 });
    expect(dash.mismatch).toEqual({ parcels: 1, shortfall: 47.7 });
    void a;
    await fails(getCodDashboard(s.f.tenantId, { ...s.owner, role: "ORDER_PACKER" }), "FORBIDDEN");
  });

  it("does not count parcels the owner delivered themselves, or prepaid ones, as owed", async () => {
    const s = await store("notowed");
    const o = await createOrder(s.f.tenantId, {
      idempotencyKey: key(), customer: { name: "Own Rider", phone: phone() },
      shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: vid(s.f), quantity: 1 }],
    });
    for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const) await transitionOrder(s.f.tenantId, o.orderId, to, merchant(s));
    const after = await order(o.orderId);
    expect(after.settlementStatus).toBe("SETTLED");
    expect(after.paymentStatus).toBe("PAID"); // the owner collected the cash
    expect((await getCodDashboard(s.f.tenantId, s.owner)).owed.total).toBe(0);
  });
});

describe("profit and loss", () => {
  async function scenario() {
    const s = await store("profit");
    const day = TODAY();
    const a = await parcel(s);
    const b = await parcel(s);
    const back = await parcel(s, { to: "RETURNED" });
    await addExpense(s.f.tenantId, s.owner, { category: "ADS", amount: 500, incurredOn: day });
    await addExpense(s.f.tenantId, s.owner, { category: "PACKAGING", amount: 100.5, incurredOn: day, note: "boxes" });
    const refundOrder = await order(a.orderId);
    await owner.refundLedger.create({ data: { tenantId: s.f.tenantId, orderId: a.orderId, amount: 200, reason: "RT-0001", method: "BKASH_SEND_MONEY", trxId: "TX1", processedBy: s.owner.userId } });
    await owner.refundLedger.create({ data: { tenantId: s.f.tenantId, orderId: a.orderId, amount: 99, reason: "RT-0002", method: "STORE_CREDIT", processedBy: s.owner.userId } });
    void refundOrder;
    return { s, day, a, b, back };
  }
  const line = (r: Awaited<ReturnType<typeof getProfitReport>>, key: string) => r.lines.find((l) => l.key === key)!.amount;

  it("adds up: net profit is sales less every line, to the paisa", async () => {
    const { s, day } = await scenario();
    const r = await getProfitReport(s.f.tenantId, s.owner, { from: day, to: day });
    expect(r.deliveredOrders).toBe(2);
    expect(r.sales).toBe(2460);
    expect(line(r, "cogs")).toBe(1200); // 2 x 600
    expect(line(r, "courier_delivery")).toBe(140); // estimated 70 each
    expect(line(r, "courier_cod_fee")).toBe(24.6);
    expect(line(r, "returns")).toBe(70); // the returned parcel's trip
    expect(line(r, "refunds")).toBe(200); // store credit is not cash out
    expect(line(r, "gateway")).toBe(0);
    expect(line(r, "ads")).toBe(500);
    expect(line(r, "packaging")).toBe(100.5);
    const sum = Math.round(r.lines.reduce((a, l) => a + l.amount * 100, 0));
    expect(Math.round(r.totalCosts * 100)).toBe(sum);
    expect(Math.round(r.net * 100)).toBe(Math.round(r.sales * 100) - sum);
    expect(r.net).toBe(224.9);
    expect(r.grossMargin).toBe(1260);
    expect(r.grossMarginPercent).toBe(51.2);
    expect(r.netMarginPercent).toBe(Math.round((r.net / 2460) * 1000) / 10);
    // The days add up to the headline too.
    expect(r.days).toHaveLength(1);
    expect(r.days[0]).toMatchObject({ date: day, sales: 2460, net: r.net });
    expect(r.biggestLeak).toMatchObject({ key: "ads", amount: 500 });
    expect(r.estimatedFeeParcels).toBe(3);
    expect(r.itemsWithoutCost).toBe(0);
  });

  it("uses the courier's real charges once a statement is in", async () => {
    const { s, day, a } = await scenario();
    await importStatement(s.f.tenantId, s.owner, stmt({ csv: csv(`${a.consignmentId},,1230,75,15,1140,Delivered`) }));
    const r = await getProfitReport(s.f.tenantId, s.owner, { from: day, to: day });
    expect(r.lines.find((l) => l.key === "courier_delivery")!.amount).toBe(75 + 70);
    expect(r.lines.find((l) => l.key === "courier_cod_fee")!.amount).toBe(15 + 12.3);
    expect(r.estimatedFeeParcels).toBe(2);
    expect(Math.round(r.net * 100)).toBe(Math.round(r.sales * 100) - Math.round(r.lines.reduce((x, l) => x + l.amount * 100, 0)));
  });

  it("spreads costs over the days they happened, and the days still add up", async () => {
    const { s, day } = await scenario();
    const yesterday = addDays(day, -1);
    await addExpense(s.f.tenantId, s.owner, { category: "RENT_SALARY", amount: 3000, incurredOn: yesterday });
    const r = await getProfitReport(s.f.tenantId, s.owner, { from: yesterday, to: day });
    expect(r.days.map((d) => d.date)).toEqual([yesterday, day]);
    expect(r.days[0]).toMatchObject({ sales: 0, costs: 3000, net: -3000 });
    expect(Math.round(r.days.reduce((a, d) => a + d.net * 100, 0))).toBe(Math.round(r.net * 100));
    expect(Math.round(r.days.reduce((a, d) => a + d.sales * 100, 0))).toBe(Math.round(r.sales * 100));
    expect(r.biggestLeak).toMatchObject({ key: "rent_salary", amount: 3000 });
  });

  it("warns when products have no cost on file", async () => {
    const s = await store("nocost");
    await parcel(s, { items: [{ variantId: vid(s.f, 1), quantity: 3 }] }); // the linen shirt has no cost
    const r = await getProfitReport(s.f.tenantId, s.owner, { from: TODAY(), to: TODAY() });
    expect(r.itemsWithoutCost).toBe(3);
    expect(r.lines.find((l) => l.key === "cogs")!.amount).toBe(0);
  });

  it("an empty period is all zeros, not an error", async () => {
    const s = await store("empty");
    const r = await getProfitReport(s.f.tenantId, s.owner, { from: "2020-01-01", to: "2020-01-03" });
    expect(r).toMatchObject({ sales: 0, net: 0, totalCosts: 0, deliveredOrders: 0, biggestLeak: null, grossMarginPercent: null });
    expect(r.days).toHaveLength(3);
  });

  it("checks the range and who is asking", async () => {
    const s = await store("profitperm");
    await fails(getProfitReport(s.f.tenantId, s.owner, { from: "2026-10-10", to: "2026-10-01" }), "VALIDATION_ERROR");
    await fails(getProfitReport(s.f.tenantId, s.owner, { from: "2024-01-01", to: "2026-10-01" }), "VALIDATION_ERROR", /400 days/);
    await fails(getProfitReport(s.f.tenantId, s.owner, { from: "bad", to: "2026-10-01" }), "VALIDATION_ERROR");
    await fails(getProfitReport(s.f.tenantId, s.packer, { from: TODAY(), to: TODAY() }), "FORBIDDEN");
    await getProfitReport(s.f.tenantId, s.manager, { from: TODAY(), to: TODAY() }); // managers can look
  });

  it("is per store", async () => {
    const a = await store("profitA");
    const b = await store("profitB");
    await parcel(a);
    expect((await getProfitReport(a.f.tenantId, a.owner, { from: TODAY(), to: TODAY() })).sales).toBe(1230);
    expect((await getProfitReport(b.f.tenantId, b.owner, { from: TODAY(), to: TODAY() })).sales).toBe(0);
  });
});

describe("expenses", () => {
  it("are added by the owner, listed by date, and deleted with a record", async () => {
    const s = await store("expenses");
    const day = TODAY();
    const e1 = await addExpense(s.f.tenantId, s.owner, { category: "ADS", amount: 1500.456, incurredOn: day, note: "Facebook" });
    await addExpense(s.f.tenantId, s.owner, { category: "OTHER", amount: 20, incurredOn: addDays(day, -2) });
    const list = await listExpenses(s.f.tenantId, s.manager, { from: addDays(day, -5), to: day });
    expect(list.map((e) => e.category)).toEqual(["ADS", "OTHER"]);
    expect(list[0]).toMatchObject({ amount: 1500.46, note: "Facebook", incurredOn: day });
    await fails(addExpense(s.f.tenantId, s.manager, { category: "ADS", amount: 5, incurredOn: day }), "FORBIDDEN");
    await fails(addExpense(s.f.tenantId, s.owner, { category: "ADS", amount: -5, incurredOn: day }), "VALIDATION_ERROR");
    await fails(addExpense(s.f.tenantId, s.owner, { category: "TAXES", amount: 5, incurredOn: day }), "VALIDATION_ERROR");
    await fails(addExpense(s.f.tenantId, s.owner, { category: "ADS", amount: 5, incurredOn: "yesterday" }), "VALIDATION_ERROR");
    await deleteExpense(s.f.tenantId, s.owner, e1.id);
    expect(await listExpenses(s.f.tenantId, s.owner, { from: day, to: day })).toHaveLength(0);
    await fails(deleteExpense(s.f.tenantId, s.owner, e1.id), "NOT_FOUND");
    expect((await owner.auditLog.findMany({ where: { tenantId: s.f.tenantId, action: { startsWith: "expense." } } })).map((a) => a.action).sort()).toEqual(["expense.added", "expense.added", "expense.deleted"]);
  });

  it("cannot be seen or deleted from another store", async () => {
    const a = await store("expA");
    const b = await store("expB");
    const e = await addExpense(a.f.tenantId, a.owner, { category: "ADS", amount: 10, incurredOn: TODAY() });
    await fails(deleteExpense(b.f.tenantId, b.owner, e.id), "NOT_FOUND");
    expect(await listExpenses(b.f.tenantId, b.owner, { from: TODAY(), to: TODAY() })).toHaveLength(0);
  });
});
