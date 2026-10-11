import { Prisma, withTenant, type TenantTx } from "@biztrackbd/db";
import { z } from "zod";
import { audit } from "../audit/service";
import { COURIER_PROVIDERS, type CourierProviderKey } from "../couriers/types";
import { NotFoundError, ValidationError } from "../errors";
import { money } from "../orders/pricing";
import { assertCan, type StaffActor } from "../permissions";
import { headerKey, parseCsv, parseMoney } from "./csv";

/**
 * COD reconciliation (docs/28 section 2). A courier collects cash from the customer and pays the shop later, minus its
 * delivery charge and COD fee. This module works out what each parcel should have paid, reads the courier's payout
 * statement, and says which parcels were paid correctly, paid short, or not paid yet.
 */

export type LineResult = "MATCHED" | "SHORT_PAID" | "MISSING" | "RETURNED";
export type RowState = LineResult | "NOT_PAID";

/** A payout more than this far below what we expected is flagged. A rupee of rounding either way is not. */
const TOLERANCE = 1;
/** A delivered parcel unpaid for longer than this is "overdue". */
export const OVERDUE_DAYS = 7;
const MAX_ROWS = 2000;

export interface FeeRates {
  inside: number;
  outside: number;
  codPercent: number;
}

export const DEFAULT_RATES: FeeRates = { inside: 70, outside: 130, codPercent: 1 };

export async function loadRates(tx: TenantTx): Promise<FeeRates> {
  const s = await tx.storeSettings.findFirst({ select: { courierFeeInsideDhaka: true, courierFeeOutsideDhaka: true, courierCodFeePercent: true } });
  return s ? { inside: Number(s.courierFeeInsideDhaka), outside: Number(s.courierFeeOutsideDhaka), codPercent: Number(s.courierCodFeePercent) } : DEFAULT_RATES;
}

interface PricedOrder {
  paymentMethod: string;
  settlementStatus: string;
  totalAmount: Prisma.Decimal | number;
  courierBookingFee: Prisma.Decimal | number | null;
  shippingDistrict: string;
}

/** What the courier should have collected and paid out for one delivered parcel. */
export function expectedFor(o: PricedOrder, rates: FeeRates) {
  const collected = o.paymentMethod === "COD" && o.settlementStatus !== "SETTLED" ? Number(o.totalAmount) : 0;
  const delivery = o.courierBookingFee != null ? Number(o.courierBookingFee) : o.shippingDistrict.trim().toLowerCase() === "dhaka" ? rates.inside : rates.outside;
  const codFee = money((collected * rates.codPercent) / 100);
  return { collected, delivery, codFee, net: money(collected - delivery - codFee) };
}

// ---- Statement import ----------------------------------------------------------------------------------------------

export const StatementInput = z.object({
  courier: z.enum(COURIER_PROVIDERS as [CourierProviderKey, ...CourierProviderKey[]]),
  invoiceNumber: z.string().trim().min(1, "Enter the courier's payout invoice number").max(60),
  disbursedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the payout date"),
  paymentMethod: z.enum(["BEFTN_BANK", "BKASH_COMMERCIAL"]),
  bankAccountLast4: z.string().regex(/^\d{4}$/, "Last 4 digits only").optional(),
  csv: z.string().min(1, "Choose the statement file").max(1_500_000, "That file is too large"),
});
export type StatementInput = z.infer<typeof StatementInput>;

const ALIASES = {
  ref: ["consignmentid", "cid", "consignment", "consignmentno", "cn", "trackingid", "trackingcode", "tracking", "parcelid", "trackingno"],
  order: ["invoice", "invoiceno", "invoiceid", "merchantorderid", "merchantinvoiceid", "orderid", "orderno", "ordernumber", "orderref"],
  collected: ["codamount", "cod", "collectedamount", "collectedcod", "amountcollected", "cashcollected", "collectionamount", "cashcollection", "collected", "codcollected"],
  delivery: ["deliverycharge", "deliveryfee", "deliverycost", "shippingcharge", "deliverychargeamount"],
  codFee: ["codcharge", "codfee", "codservicecharge", "codcommission", "servicecharge", "codchargeamount"],
  returnFee: ["returncharge", "returnfee", "returncost"],
  net: ["payable", "netpayable", "netamount", "paidamount", "payoutamount", "amountpayable", "payment", "paidtomerchant", "netpaid", "payableamount", "netpayment"],
  status: ["status", "deliverystatus", "parcelstatus", "currentstatus"],
} as const;

function mapColumns(header: string[]): Partial<Record<keyof typeof ALIASES, number>> {
  const cols: Partial<Record<keyof typeof ALIASES, number>> = {};
  const keys = header.map(headerKey);
  for (const field of Object.keys(ALIASES) as (keyof typeof ALIASES)[]) {
    const i = keys.findIndex((k) => (ALIASES[field] as readonly string[]).includes(k));
    if (i >= 0) cols[field] = i;
  }
  return cols;
}

interface StatementRow {
  row: number;
  ref: string;
  invoice: string;
  collected: number;
  delivery: number;
  codFee: number;
  returnFee: number;
  net: number;
  returned: boolean;
}

export function readStatement(csv: string): StatementRow[] {
  const table = parseCsv(csv);
  if (table.length < 2) throw new ValidationError("The statement has no rows");
  if (table.length - 1 > MAX_ROWS) throw new ValidationError(`The statement has more than ${MAX_ROWS} rows. Split it into two files.`);
  // The real header may sit under a title line, so look at the first few rows.
  let headerAt = -1;
  let cols: ReturnType<typeof mapColumns> = {};
  for (let i = 0; i < Math.min(table.length, 6); i++) {
    const c = mapColumns(table[i]!);
    if ((c.ref !== undefined || c.order !== undefined) && (c.net !== undefined || c.collected !== undefined)) {
      headerAt = i;
      cols = c;
      break;
    }
  }
  if (headerAt < 0) {
    throw new ValidationError("We could not find the columns. The file needs a consignment ID (or invoice number) and the amount collected or paid.");
  }
  const cell = (r: string[], i: number | undefined) => (i === undefined ? "" : (r[i] ?? "").trim());
  const out: StatementRow[] = [];
  for (let i = headerAt + 1; i < table.length; i++) {
    const r = table[i]!;
    const ref = cell(r, cols.ref);
    const invoice = cell(r, cols.order);
    if (!ref && !invoice) continue;
    const collected = parseMoney(cell(r, cols.collected)) ?? 0;
    let delivery = Math.abs(parseMoney(cell(r, cols.delivery)) ?? 0);
    const codFee = Math.abs(parseMoney(cell(r, cols.codFee)) ?? 0);
    const returnFee = Math.abs(parseMoney(cell(r, cols.returnFee)) ?? 0);
    const status = cell(r, cols.status).toLowerCase();
    const returned = /return|cancel|refus/.test(status);
    let net = parseMoney(cell(r, cols.net));
    if (net === null) net = money(collected - delivery - codFee - returnFee);
    else if (cols.delivery === undefined && cols.codFee === undefined && cols.returnFee === undefined) delivery = Math.max(money(collected - net), 0);
    out.push({ row: i + 1, ref, invoice, collected, delivery, codFee, returnFee, net: money(net), returned });
  }
  if (out.length === 0) throw new ValidationError("The statement has no parcels in it");
  return out;
}

export interface ImportResult {
  settlementId: string;
  invoiceNumber: string;
  parcels: number;
  matched: number;
  shortPaid: number;
  returned: number;
  disbursed: number;
  shortfall: number;
  /** Statement rows that match none of this store's parcels for that courier (maybe another store's file, or a typo). */
  unmatched: { row: number; ref: string }[];
  /** Rows for parcels already settled by an earlier statement. They are not counted twice. */
  duplicates: { row: number; ref: string; orderNumber: string }[];
}

export async function importStatement(tenantId: string, actor: StaffActor, raw: unknown): Promise<ImportResult> {
  assertCan(actor, "reports", "edit");
  const parsed = StatementInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid statement");
  const input = parsed.data;
  const rows = readStatement(input.csv);

  return withTenant(tenantId, async (tx) => {
    // Say so first if this payout is already in, rather than reporting its parcels as duplicates one by one.
    const known = await tx.courierSettlementInvoice.findFirst({ where: { courierProvider: input.courier, invoiceNumber: input.invoiceNumber }, select: { id: true } });
    if (known) throw new ValidationError("This payout invoice was already imported");
    const rates = await loadRates(tx);
    const refs = [...new Set(rows.flatMap((r) => [r.ref, r.invoice]).filter(Boolean))];
    const orders = await tx.order.findMany({
      where: { courierProvider: input.courier, OR: [{ consignmentId: { in: refs } }, { trackingCode: { in: refs } }, { orderNumber: { in: refs } }] },
    });
    const byRef = new Map<string, (typeof orders)[number]>();
    for (const o of orders) for (const k of [o.consignmentId, o.trackingCode, o.orderNumber]) if (k) byRef.set(k, o);
    const already = new Set((await tx.courierSettledOrder.findMany({ where: { orderId: { in: orders.map((o) => o.id) } }, select: { orderId: true } })).map((l) => l.orderId));

    const unmatched: ImportResult["unmatched"] = [];
    const duplicates: ImportResult["duplicates"] = [];
    const lines: { orderId: string; consignmentId: string; r: StatementRow; expectedNet: number; result: LineResult }[] = [];
    const taken = new Set<string>();
    for (const r of rows) {
      const o = byRef.get(r.ref) ?? byRef.get(r.invoice);
      if (!o) { unmatched.push({ row: r.row, ref: r.ref || r.invoice }); continue; }
      if (already.has(o.id) || taken.has(o.id)) { duplicates.push({ row: r.row, ref: r.ref || r.invoice, orderNumber: o.orderNumber }); continue; }
      taken.add(o.id);
      const exp = expectedFor(o, rates);
      let result: LineResult;
      let expectedNet = exp.net;
      if (r.returned || o.status === "RETURNED") {
        // A returned parcel has no cash to compare; the courier's return charge is simply recorded.
        result = "RETURNED";
        expectedNet = r.net;
      } else if (r.net < exp.net - TOLERANCE) result = "SHORT_PAID";
      else result = "MATCHED";
      lines.push({ orderId: o.id, consignmentId: o.consignmentId ?? r.ref, r, expectedNet, result });
    }
    if (lines.length === 0) throw new ValidationError("None of the parcels in this file are yours for that courier. Check you chose the right courier and file.", { unmatched: unmatched.length });

    const sum = (f: (l: (typeof lines)[number]) => number) => money(lines.reduce((s, l) => s + f(l), 0));
    let settlement;
    try {
      settlement = await tx.courierSettlementInvoice.create({
        data: {
          tenantId, courierProvider: input.courier, invoiceNumber: input.invoiceNumber, paymentMethod: input.paymentMethod, bankAccountLast4: input.bankAccountLast4 ?? null,
          disbursedAt: new Date(`${input.disbursedAt}T00:00:00+06:00`),
          disbursedAmount: sum((l) => l.r.net), totalCodCollected: sum((l) => l.r.collected), deliveryFeesTotal: sum((l) => l.r.delivery),
          codServiceFee: sum((l) => l.r.codFee), returnCharges: sum((l) => l.r.returnFee),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("This payout invoice was already imported");
      throw e;
    }
    await tx.courierSettledOrder.createMany({
      data: lines.map((l) => ({
        tenantId, settlementId: settlement.id, orderId: l.orderId, consignmentId: l.consignmentId, codCollected: l.r.collected,
        // A returned parcel's line carries the trip's whole charge (delivery plus return), which is what the profit screen needs.
        deliveryCharge: l.result === "RETURNED" ? money(l.r.delivery + l.r.returnFee) : l.r.delivery,
        codFeeDeduction: l.r.codFee, netPaidToStore: l.r.net, expectedNet: l.expectedNet, result: l.result,
      })),
    });
    const ids = (res: LineResult) => lines.filter((l) => l.result === res).map((l) => l.orderId);
    // Matched and returned parcels are closed. Short-paid ones stay flagged until the owner accepts or the courier pays the rest.
    await tx.order.updateMany({ where: { id: { in: [...ids("MATCHED"), ...ids("RETURNED")] } }, data: { settlementStatus: "SETTLED" } });
    await tx.order.updateMany({ where: { id: { in: ids("SHORT_PAID") } }, data: { settlementStatus: "DISCREPANCY_FLAGGED" } });
    await tx.orderEvent.createMany({
      data: lines.map((l) => ({
        tenantId, orderId: l.orderId, type: "SETTLEMENT", actorId: actor.userId, actorName: actor.name ?? actor.email,
        message: l.result === "SHORT_PAID" ? `${input.courier} payout ${input.invoiceNumber}: paid ৳${l.r.net}, expected ৳${l.expectedNet}` : l.result === "RETURNED" ? `${input.courier} payout ${input.invoiceNumber}: returned parcel` : `${input.courier} payout ${input.invoiceNumber}: ৳${l.r.net} received`,
        data: { settlementId: settlement.id, result: l.result, net: l.r.net, expectedNet: l.expectedNet },
      })),
    });
    const shortfall = money(lines.filter((l) => l.result === "SHORT_PAID").reduce((s, l) => s + (l.expectedNet - l.r.net), 0));
    await audit(tx, tenantId, actor, "cod.statement_imported", { courier: input.courier, invoiceNumber: input.invoiceNumber, parcels: lines.length, unmatched: unmatched.length, shortfall });
    return {
      settlementId: settlement.id, invoiceNumber: input.invoiceNumber, parcels: lines.length, matched: ids("MATCHED").length, shortPaid: ids("SHORT_PAID").length, returned: ids("RETURNED").length,
      disbursed: Number(settlement.disbursedAmount), shortfall, unmatched, duplicates,
    };
  });
}

// ---- Screens -------------------------------------------------------------------------------------------------------

export interface CodDashboard {
  /** Cash couriers hold for delivered parcels and have not paid out yet. */
  owed: { total: number; byCourier: { courier: string; amount: number; parcels: number }[] };
  overdue: { parcels: number; amount: number };
  settledThisMonth: { amount: number; payouts: number };
  deductionsThisMonth: { delivery: number; codFee: number; returns: number; total: number };
  mismatch: { parcels: number; shortfall: number };
}

export async function getCodDashboard(tenantId: string, actor: StaffActor, now: Date = new Date()): Promise<CodDashboard> {
  assertCan(actor, "reports", "view");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const overdueBefore = new Date(now.getTime() - OVERDUE_DAYS * 86_400_000);
  return withTenant(tenantId, async (tx) => {
    const rates = await loadRates(tx);
    const waiting = await tx.order.findMany({
      where: { status: "DELIVERED", settlementStatus: "COLLECTED_UNSETTLED", courierProvider: { in: COURIER_PROVIDERS } },
      select: { courierProvider: true, paymentMethod: true, settlementStatus: true, totalAmount: true, courierBookingFee: true, shippingDistrict: true, deliveredAt: true },
    });
    const by = new Map<string, { amount: number; parcels: number }>();
    let total = 0, overdueAmount = 0, overdueParcels = 0;
    for (const o of waiting) {
      const amount = expectedFor(o, rates).net;
      total += amount;
      const c = by.get(o.courierProvider!) ?? { amount: 0, parcels: 0 };
      c.amount += amount;
      c.parcels++;
      by.set(o.courierProvider!, c);
      if (o.deliveredAt && o.deliveredAt < overdueBefore) { overdueAmount += amount; overdueParcels++; }
    }
    const payouts = await tx.courierSettlementInvoice.aggregate({
      where: { disbursedAt: { gte: monthStart } }, _sum: { disbursedAmount: true, deliveryFeesTotal: true, codServiceFee: true, returnCharges: true }, _count: { _all: true },
    });
    const flagged = await tx.courierSettledOrder.findMany({ where: { result: "SHORT_PAID", order: { settlementStatus: "DISCREPANCY_FLAGGED" } }, select: { expectedNet: true, netPaidToStore: true } });
    const d = Number(payouts._sum.deliveryFeesTotal ?? 0), f = Number(payouts._sum.codServiceFee ?? 0), r = Number(payouts._sum.returnCharges ?? 0);
    return {
      owed: { total: money(total), byCourier: [...by.entries()].map(([courier, v]) => ({ courier, amount: money(v.amount), parcels: v.parcels })).sort((a, b) => b.amount - a.amount) },
      overdue: { parcels: overdueParcels, amount: money(overdueAmount) },
      settledThisMonth: { amount: Number(payouts._sum.disbursedAmount ?? 0), payouts: payouts._count._all },
      deductionsThisMonth: { delivery: d, codFee: f, returns: r, total: money(d + f + r) },
      mismatch: { parcels: flagged.length, shortfall: money(flagged.reduce((s, l) => s + Number(l.expectedNet) - Number(l.netPaidToStore), 0)) },
    };
  });
}

export type ReconFilter = "attention" | "matched" | "unpaid" | "returns" | "all";

export interface ReconRow {
  key: string;
  lineId: string | null;
  orderId: string;
  orderNumber: string;
  courier: string;
  consignmentId: string | null;
  customerName: string;
  state: RowState;
  /** True once the parcel has waited longer than OVERDUE_DAYS. */
  overdue: boolean;
  collected: number;
  expectedNet: number;
  netPaid: number | null;
  shortfall: number;
  invoiceNumber: string | null;
  daysWaiting: number | null;
  /** A plain-words guess at why a payout was short. */
  reason: string | null;
  deliveryCharge: number;
  codFee: number;
}

function guessReason(shortfall: number, collected: number, rates: FeeRates, codFeeTaken: number, netPaid: number): string {
  const near = (a: number, b: number) => Math.abs(a - b) <= 2;
  if (shortfall <= TOLERANCE) return "";
  if (netPaid <= TOLERANCE && collected > 0) return "The cash was not paid out for this parcel.";
  if (near(shortfall, money((collected * rates.codPercent) / 100)) && codFeeTaken > 0) return "The COD fee looks like it was taken twice.";
  if (near(shortfall, rates.outside - rates.inside)) return "Charged the outside-Dhaka delivery rate. Check the address.";
  if (near(shortfall, collected)) return "The cash was not paid out for this parcel.";
  return "Check this parcel on the courier's statement.";
}

export async function listReconciliation(tenantId: string, actor: StaffActor, opts: { courier?: string; filter?: ReconFilter } = {}, now: Date = new Date()): Promise<ReconRow[]> {
  assertCan(actor, "reports", "view");
  const filter = opts.filter ?? "attention";
  return withTenant(tenantId, async (tx) => {
    const rates = await loadRates(tx);
    const courierFilter = opts.courier && COURIER_PROVIDERS.includes(opts.courier as CourierProviderKey) ? { courierProvider: opts.courier as CourierProviderKey } : {};
    const rows: ReconRow[] = [];

    const lines = await tx.courierSettledOrder.findMany({
      where: { order: courierFilter }, include: { order: true, settlement: { select: { invoiceNumber: true } } }, orderBy: { id: "desc" }, take: 500,
    });
    for (const l of lines) {
      const result = l.result as LineResult;
      const accepted = result === "SHORT_PAID" && l.order.settlementStatus === "SETTLED";
      const short = money(Number(l.expectedNet) - Number(l.netPaidToStore));
      rows.push({
        key: `line:${l.id}`, lineId: l.id, orderId: l.orderId, orderNumber: l.order.orderNumber, courier: l.order.courierProvider ?? "", consignmentId: l.consignmentId, customerName: l.order.customerName,
        state: accepted ? "MATCHED" : result, overdue: false, collected: Number(l.codCollected), expectedNet: Number(l.expectedNet), netPaid: Number(l.netPaidToStore),
        shortfall: accepted || result !== "SHORT_PAID" ? 0 : short, invoiceNumber: l.settlement.invoiceNumber, daysWaiting: null,
        reason: result === "SHORT_PAID" && !accepted ? guessReason(short, Number(l.codCollected), rates, Number(l.codFeeDeduction), Number(l.netPaidToStore)) : null,
        deliveryCharge: Number(l.deliveryCharge), codFee: Number(l.codFeeDeduction),
      });
    }
    const waiting = await tx.order.findMany({
      where: { status: "DELIVERED", settlementStatus: "COLLECTED_UNSETTLED", courierProvider: { in: COURIER_PROVIDERS }, ...courierFilter }, orderBy: { deliveredAt: "asc" }, take: 500,
    });
    for (const o of waiting) {
      const exp = expectedFor(o, rates);
      const days = o.deliveredAt ? Math.floor((now.getTime() - o.deliveredAt.getTime()) / 86_400_000) : 0;
      rows.push({
        key: `order:${o.id}`, lineId: null, orderId: o.id, orderNumber: o.orderNumber, courier: o.courierProvider ?? "", consignmentId: o.consignmentId, customerName: o.customerName,
        state: "NOT_PAID", overdue: days > OVERDUE_DAYS, collected: exp.collected, expectedNet: exp.net, netPaid: null, shortfall: 0, invoiceNumber: null, daysWaiting: days,
        reason: null, deliveryCharge: exp.delivery, codFee: exp.codFee,
      });
    }
    const keep = (r: ReconRow) =>
      filter === "all" ? true : filter === "matched" ? r.state === "MATCHED" : filter === "returns" ? r.state === "RETURNED" : filter === "unpaid" ? r.state === "NOT_PAID"
        : r.state === "SHORT_PAID" || r.state === "MISSING" || (r.state === "NOT_PAID" && r.overdue);
    return rows.filter(keep);
  });
}

export interface SettlementRow {
  id: string;
  courier: string;
  invoiceNumber: string;
  disbursedAt: Date;
  disbursedAmount: number;
  collected: number;
  deductions: number;
  parcels: number;
  paymentMethod: string;
}

export async function listSettlements(tenantId: string, actor: StaffActor): Promise<SettlementRow[]> {
  assertCan(actor, "reports", "view");
  const rows = await withTenant(tenantId, (tx) => tx.courierSettlementInvoice.findMany({ orderBy: { disbursedAt: "desc" }, take: 100, include: { _count: { select: { settledOrders: true } } } }));
  return rows.map((s) => ({
    id: s.id, courier: s.courierProvider, invoiceNumber: s.invoiceNumber, disbursedAt: s.disbursedAt, disbursedAmount: Number(s.disbursedAmount), collected: Number(s.totalCodCollected),
    deductions: money(Number(s.deliveryFeesTotal) + Number(s.codServiceFee) + Number(s.returnCharges)), parcels: s._count.settledOrders, paymentMethod: s.paymentMethod,
  }));
}

/** "Mark matched": the owner accepts a short payment (for example after agreeing a fee with the courier). */
export async function acceptShortPayment(tenantId: string, actor: StaffActor, lineId: string): Promise<void> {
  assertCan(actor, "reports", "edit");
  await withTenant(tenantId, async (tx) => {
    const l = await tx.courierSettledOrder.findFirst({ where: { id: lineId }, include: { order: { select: { orderNumber: true } } } });
    if (!l) throw new NotFoundError("Payout line");
    if (l.result !== "SHORT_PAID") throw new ValidationError("This parcel was not short paid");
    await tx.order.update({ where: { id: l.orderId }, data: { settlementStatus: "SETTLED" } });
    await tx.orderEvent.create({
      data: { tenantId, orderId: l.orderId, type: "SETTLEMENT", actorId: actor.userId, actorName: actor.name ?? actor.email, message: `Short payment accepted (paid ৳${Number(l.netPaidToStore)}, expected ৳${Number(l.expectedNet)})`, data: { lineId } },
    });
    await audit(tx, tenantId, actor, "cod.short_payment_accepted", { orderNumber: l.order.orderNumber, paid: Number(l.netPaidToStore), expected: Number(l.expectedNet) });
  });
}

/** "Raise dispute": writes the problem on the order and in the audit log, and keeps the parcel flagged. */
export async function raiseDispute(tenantId: string, actor: StaffActor, lineId: string, note: string): Promise<void> {
  assertCan(actor, "reports", "edit");
  const why = note.trim().slice(0, 300);
  if (why.length < 3) throw new ValidationError("Write what you told the courier, so the team remembers");
  await withTenant(tenantId, async (tx) => {
    const l = await tx.courierSettledOrder.findFirst({ where: { id: lineId }, include: { order: { select: { orderNumber: true } } } });
    if (!l) throw new NotFoundError("Payout line");
    await tx.orderEvent.create({
      data: { tenantId, orderId: l.orderId, type: "SETTLEMENT", actorId: actor.userId, actorName: actor.name ?? actor.email, message: `Dispute raised with the courier: ${why}`, data: { lineId } },
    });
    await audit(tx, tenantId, actor, "cod.dispute_raised", { orderNumber: l.order.orderNumber, note: why });
  });
}

// ---- What the courier charges the owner ------------------------------------------------------------------------------

export interface CourierRates extends FeeRates {
  defaultCourier: string | null;
}

export async function getCourierRates(tenantId: string, actor: StaffActor): Promise<CourierRates> {
  assertCan(actor, "orders", "view");
  return withTenant(tenantId, async (tx) => {
    const s = await tx.storeSettings.findFirst({ select: { defaultCourier: true } });
    return { ...(await loadRates(tx)), defaultCourier: s?.defaultCourier ?? null };
  });
}

/** Used to check statements and to estimate courier costs on the profit screen until a real statement arrives. */
export async function saveCourierRates(tenantId: string, actor: StaffActor, input: { inside: number; outside: number; codPercent: number; defaultCourier?: string | null }): Promise<void> {
  assertCan(actor, "orders", "edit");
  const ok = (n: number, max: number) => Number.isFinite(n) && n >= 0 && n <= max;
  if (!ok(input.inside, 5000) || !ok(input.outside, 5000)) throw new ValidationError("Enter the delivery charge in taka, from 0 to 5,000");
  if (!ok(input.codPercent, 10)) throw new ValidationError("The COD fee is a percentage from 0 to 10");
  const courier = input.defaultCourier && (COURIER_PROVIDERS as string[]).includes(input.defaultCourier) ? input.defaultCourier : null;
  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.storeSettings.updateMany({
      data: { courierFeeInsideDhaka: money(input.inside), courierFeeOutsideDhaka: money(input.outside), courierCodFeePercent: Math.round(input.codPercent * 100) / 100, defaultCourier: courier },
    });
    if (count === 0) throw new NotFoundError("Store settings");
    await audit(tx, tenantId, actor, "settings.courier_rates", { inside: input.inside, outside: input.outside, codPercent: input.codPercent, defaultCourier: courier });
  });
}
