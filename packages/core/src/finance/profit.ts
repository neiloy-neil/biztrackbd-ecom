import { withTenant } from "@biztrackbd/db";
import { z } from "zod";
import { addDays, dhakaDate } from "../admin/dashboard";
import { audit } from "../audit/service";
import { COURIER_PROVIDERS } from "../couriers/types";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { loadRates } from "./cod";

/**
 * Profit and loss (docs/28 section 7).
 *
 *   net profit = delivered sales - cost of goods - courier delivery fees - courier COD fees - return losses
 *                - refunds - gateway fees - ads and other expenses
 *
 * Each cost lands on the day it happened: product cost and courier fees on the day the parcel was delivered, return losses
 * on the day it came back, refunds on the day they were paid, expenses on the day the owner says they were spent.
 * Everything is added up in whole paisa so the lines always sum exactly to the total.
 */

export const EXPENSE_CATEGORIES = ["ADS", "PACKAGING", "RENT_SALARY", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_LABELS: Record<ExpenseCategory, string> = { ADS: "Ads", PACKAGING: "Packaging", RENT_SALARY: "Rent and salaries", OTHER: "Other" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400;

export type LineKey = "cogs" | "courier_delivery" | "courier_cod_fee" | "returns" | "refunds" | "gateway" | "ads" | "packaging" | "rent_salary" | "other";

const LINES: { key: LineKey; label: string }[] = [
  { key: "cogs", label: "Cost of goods" },
  { key: "courier_delivery", label: "Courier delivery fees" },
  { key: "courier_cod_fee", label: "Courier COD fees" },
  { key: "returns", label: "Return losses" },
  { key: "refunds", label: "Refunds to customers" },
  { key: "gateway", label: "Payment gateway fees" },
  { key: "ads", label: "Ads" },
  { key: "packaging", label: "Packaging" },
  { key: "rent_salary", label: "Rent and salaries" },
  { key: "other", label: "Other expenses" },
];
const CATEGORY_LINE: Record<ExpenseCategory, LineKey> = { ADS: "ads", PACKAGING: "packaging", RENT_SALARY: "rent_salary", OTHER: "other" };

export interface ProfitLine {
  key: LineKey;
  label: string;
  amount: number;
}

export interface ProfitDay {
  date: string;
  sales: number;
  costs: number;
  net: number;
}

export interface ProfitReport {
  from: string;
  to: string;
  deliveredOrders: number;
  sales: number;
  /** Sales minus cost of goods. */
  grossMargin: number;
  grossMarginPercent: number | null;
  lines: ProfitLine[];
  totalCosts: number;
  net: number;
  netMarginPercent: number | null;
  days: ProfitDay[];
  /** The largest cost that is not the products themselves: where profit leaks. */
  biggestLeak: { key: LineKey; label: string; amount: number; percentOfSales: number | null } | null;
  /** Items sold with no product cost on file. Their cost counts as zero, so profit is overstated until costs are entered. */
  itemsWithoutCost: number;
  /** Parcels whose courier fees are our estimate (no payout statement yet). */
  estimatedFeeParcels: number;
}

const cents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

export async function getProfitReport(tenantId: string, actor: StaffActor, range: { from: string; to: string }): Promise<ProfitReport> {
  assertCan(actor, "reports", "view");
  if (!DATE.test(range.from) || !DATE.test(range.to) || range.from > range.to) throw new ValidationError("Choose a valid date range");
  const dayCount = Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000) + 1;
  if (dayCount > MAX_DAYS) throw new ValidationError(`Choose a range of up to ${MAX_DAYS} days`);
  const start = new Date(`${range.from}T00:00:00+06:00`);
  const end = new Date(`${addDays(range.to, 1)}T00:00:00+06:00`);
  const inRange = { gte: start, lt: end };

  return withTenant(tenantId, async (tx) => {
    const rates = await loadRates(tx);
    const dates: string[] = [];
    for (let i = 0; i < dayCount; i++) dates.push(addDays(range.from, i));
    const sales = new Map<string, number>(dates.map((d) => [d, 0]));
    const cost = new Map<string, Map<LineKey, number>>(dates.map((d) => [d, new Map()]));
    const add = (date: string, key: LineKey, amount: number) => {
      const day = cost.get(date);
      if (!day) return;
      day.set(key, (day.get(key) ?? 0) + cents(amount));
    };
    let itemsWithoutCost = 0;
    let estimatedFeeParcels = 0;

    // Delivered parcels: sales, product cost, courier fees.
    const delivered = await tx.order.findMany({
      where: { deliveredAt: inRange, status: { in: ["DELIVERED", "REFUNDED"] }, deletedAt: null },
      include: { items: { select: { quantity: true, unitCost: true, productId: true } }, settledLines: { select: { deliveryCharge: true, codFeeDeduction: true, result: true } } },
    });
    const productCosts = new Map<string, number | null>();
    const missingProducts = [...new Set(delivered.flatMap((o) => o.items.filter((i) => i.unitCost == null).map((i) => i.productId)))];
    if (missingProducts.length) {
      for (const p of await tx.product.findMany({ where: { id: { in: missingProducts } }, select: { id: true, costPrice: true } })) {
        productCosts.set(p.id, p.costPrice == null ? null : Number(p.costPrice));
      }
    }
    for (const o of delivered) {
      const day = dhakaDate(o.deliveredAt!);
      sales.set(day, (sales.get(day) ?? 0) + cents(Number(o.totalAmount)));
      for (const i of o.items) {
        const unit = i.unitCost != null ? Number(i.unitCost) : productCosts.get(i.productId) ?? null;
        if (unit == null) itemsWithoutCost += i.quantity;
        else add(day, "cogs", unit * i.quantity);
      }
      if (o.courierProvider && (COURIER_PROVIDERS as string[]).includes(o.courierProvider)) {
        const line = o.settledLines.find((l) => l.result !== "RETURNED");
        const base = o.paymentMethod === "COD" ? Number(o.totalAmount) : 0;
        if (line) {
          add(day, "courier_delivery", Number(line.deliveryCharge));
          add(day, "courier_cod_fee", Number(line.codFeeDeduction));
        } else {
          estimatedFeeParcels++;
          add(day, "courier_delivery", o.courierBookingFee != null ? Number(o.courierBookingFee) : o.shippingDistrict.trim().toLowerCase() === "dhaka" ? rates.inside : rates.outside);
          add(day, "courier_cod_fee", (base * rates.codPercent) / 100);
        }
      }
    }

    // Parcels that came back: the courier still charges for the trip.
    const returned = await tx.order.findMany({
      where: { returnedAt: inRange, status: "RETURNED", deletedAt: null },
      select: { returnedAt: true, courierProvider: true, courierBookingFee: true, shippingDistrict: true, settledLines: { select: { deliveryCharge: true } } },
    });
    for (const o of returned) {
      if (!o.courierProvider || !(COURIER_PROVIDERS as string[]).includes(o.courierProvider)) continue;
      const day = dhakaDate(o.returnedAt!);
      const line = o.settledLines[0];
      if (line) add(day, "returns", Number(line.deliveryCharge));
      else {
        estimatedFeeParcels++;
        add(day, "returns", o.courierBookingFee != null ? Number(o.courierBookingFee) : o.shippingDistrict.trim().toLowerCase() === "dhaka" ? rates.inside : rates.outside);
      }
    }

    // Money paid back to customers. Store credit is not cash out yet, so only wallet refunds count.
    const refunds = await tx.refundLedger.findMany({ where: { createdAt: inRange, method: { not: "STORE_CREDIT" } }, select: { amount: true, createdAt: true } });
    for (const r of refunds) add(dhakaDate(r.createdAt), "refunds", Number(r.amount));

    // Costs the owner entered.
    const expenses = await tx.expense.findMany({ where: { incurredOn: { gte: new Date(`${range.from}T00:00:00Z`), lte: new Date(`${range.to}T00:00:00Z`) } } });
    for (const e of expenses) add(e.incurredOn.toISOString().slice(0, 10), CATEGORY_LINE[e.category as ExpenseCategory] ?? "other", Number(e.amount));

    // Totals come from the same daily numbers, so lines, days and the headline cannot disagree.
    const lineTotals = new Map<LineKey, number>();
    const days: ProfitDay[] = dates.map((date) => {
      const day = cost.get(date)!;
      let costs = 0;
      for (const [k, v] of day) { costs += v; lineTotals.set(k, (lineTotals.get(k) ?? 0) + v); }
      const s = sales.get(date) ?? 0;
      return { date, sales: fromCents(s), costs: fromCents(costs), net: fromCents(s - costs) };
    });
    const salesC = [...sales.values()].reduce((a, b) => a + b, 0);
    const lines: ProfitLine[] = LINES.map((l) => ({ key: l.key, label: l.label, amount: fromCents(lineTotals.get(l.key) ?? 0) }));
    const costsC = [...lineTotals.values()].reduce((a, b) => a + b, 0);
    const cogsC = lineTotals.get("cogs") ?? 0;
    const leak = [...lines].filter((l) => l.key !== "cogs" && l.amount > 0).sort((a, b) => b.amount - a.amount)[0];
    const salesN = fromCents(salesC);
    return {
      from: range.from, to: range.to, deliveredOrders: delivered.length, sales: salesN,
      grossMargin: fromCents(salesC - cogsC), grossMarginPercent: pct(salesC - cogsC, salesC),
      lines, totalCosts: fromCents(costsC), net: fromCents(salesC - costsC), netMarginPercent: pct(salesC - costsC, salesC), days,
      biggestLeak: leak ? { key: leak.key, label: leak.label, amount: leak.amount, percentOfSales: pct(cents(leak.amount), salesC) } : null,
      itemsWithoutCost, estimatedFeeParcels,
    };
  });
}

// ---- Expenses ------------------------------------------------------------------------------------------------------

export const ExpenseInput = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive("Enter the amount").max(100_000_000),
  incurredOn: z.string().regex(DATE, "Choose the date"),
  note: z.string().trim().max(200).optional(),
});
export type ExpenseInput = z.infer<typeof ExpenseInput>;

export interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  amount: number;
  incurredOn: string;
  note: string | null;
  createdAt: Date;
}

export async function addExpense(tenantId: string, actor: StaffActor, raw: unknown): Promise<{ id: string }> {
  assertCan(actor, "reports", "edit");
  const p = ExpenseInput.safeParse(raw);
  if (!p.success) throw new ValidationError(p.error.issues[0]?.message ?? "Invalid expense");
  const e = p.data;
  const amount = Math.round(e.amount * 100) / 100;
  return withTenant(tenantId, async (tx) => {
    const row = await tx.expense.create({ data: { tenantId, category: e.category, amount, incurredOn: new Date(`${e.incurredOn}T00:00:00Z`), note: e.note || null, createdBy: actor.userId } });
    await audit(tx, tenantId, actor, "expense.added", { category: e.category, amount, incurredOn: e.incurredOn });
    return { id: row.id };
  });
}

export async function deleteExpense(tenantId: string, actor: StaffActor, id: string): Promise<void> {
  assertCan(actor, "reports", "edit");
  await withTenant(tenantId, async (tx) => {
    const e = await tx.expense.findFirst({ where: { id } });
    if (!e) throw new NotFoundError("Expense");
    await tx.expense.delete({ where: { id } });
    await audit(tx, tenantId, actor, "expense.deleted", { category: e.category, amount: Number(e.amount), incurredOn: e.incurredOn.toISOString().slice(0, 10) });
  });
}

export async function listExpenses(tenantId: string, actor: StaffActor, range: { from: string; to: string }): Promise<ExpenseRow[]> {
  assertCan(actor, "reports", "view");
  if (!DATE.test(range.from) || !DATE.test(range.to)) throw new ValidationError("Choose a valid date range");
  const rows = await withTenant(tenantId, (tx) =>
    tx.expense.findMany({ where: { incurredOn: { gte: new Date(`${range.from}T00:00:00Z`), lte: new Date(`${range.to}T00:00:00Z`) } }, orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }], take: 300 }),
  );
  return rows.map((e) => ({ id: e.id, category: e.category as ExpenseCategory, amount: Number(e.amount), incurredOn: e.incurredOn.toISOString().slice(0, 10), note: e.note, createdAt: e.createdAt }));
}
