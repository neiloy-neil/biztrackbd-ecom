import { Prisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";
import { dhakaDate } from "./dashboard";

/** A customer is a "VIP" from this much spent or this many delivered orders. A constant for now; a store setting later. */
export const VIP_SPENT = 10_000;
export const VIP_ORDERS = 5;

export type CustomerSegment = "all" | "repeat" | "vip" | "dormant" | "failed";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  area: string | null;
  orders: number;
  spent: number;
  lastOrderAt: Date | null;
  isVip: boolean;
  isBlocked: boolean;
  tags: string[];
}

const isVip = (spent: number, orders: number) => spent >= VIP_SPENT || orders >= VIP_ORDERS;

export async function listCustomers(
  tenantId: string, actor: StaffActor, opts: { segment?: CustomerSegment; q?: string; page?: number; pageSize?: number } = {},
) {
  assertCan(actor, "customers", "view");
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const q = opts.q?.trim().slice(0, 60);
  const like = q?.replace(/[\\%_]/g, (c) => `\\${c}`);
  const digits = q?.replace(/\D/g, "");
  const dormantBefore = new Date(Date.now() - 60 * 86_400_000);

  return withTenant(tenantId, async (tx) => {
    const seg = opts.segment ?? "all";
    const where: Prisma.CustomerWhereInput = {
      ...(q ? { OR: [{ name: { contains: like, mode: "insensitive" } }, { email: { contains: like, mode: "insensitive" } }, ...(digits && digits.length >= 4 ? [{ phone: { contains: digits.replace(/^880/, "0") } }] : [])] } : {}),
      ...(seg === "repeat" ? { totalOrders: { gte: 2 } } : {}),
      ...(seg === "vip" ? { OR: [{ totalSpent: { gte: VIP_SPENT } }, { totalOrders: { gte: VIP_ORDERS } }] } : {}),
      ...(seg === "dormant" ? { orders: { some: {} }, NOT: { orders: { some: { createdAt: { gte: dormantBefore } } } } } : {}),
      ...(seg === "failed" ? { orders: { some: { status: { in: ["RETURNED", "REFUNDED"] } } } } : {}),
    };
    const customers = await tx.customer.findMany({
      where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      include: { orders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, shippingCity: true, shippingDistrict: true } } },
    });
    const total = await tx.customer.count({ where });
    const blocked = new Set((await tx.blockedContact.findMany({ where: { phone: { in: customers.map((c) => c.phone) } }, select: { phone: true } })).map((b) => b.phone));

    const monthStart = new Date(`${dhakaDate(new Date()).slice(0, 7)}-01T00:00:00+06:00`);
    const all = await tx.customer.count();
    const newThisMonth = await tx.customer.count({ where: { createdAt: { gte: monthStart } } });
    const repeat = await tx.customer.count({ where: { totalOrders: { gte: 2 } } });
    const [aov] = await tx.$queryRaw<{ v: number }[]>`SELECT COALESCE(avg("totalAmount"), 0)::float8 AS v FROM "Order" WHERE "deletedAt" IS NULL AND status NOT IN ('CANCELLED', 'REFUNDED', 'RETURNED')`;

    return {
      page, pageSize, total,
      summary: { all, newThisMonth, repeatPercent: all > 0 ? Math.round((repeat / all) * 100) : 0, averageOrderValue: Math.round(aov?.v ?? 0) },
      rows: customers.map<CustomerRow>((c) => ({
        id: c.id, name: c.name || c.phone, phone: c.phone, email: c.email, orders: c.totalOrders, spent: Number(c.totalSpent), tags: c.tags,
        area: c.orders[0] ? `${c.orders[0].shippingCity}, ${c.orders[0].shippingDistrict}` : null, lastOrderAt: c.orders[0]?.createdAt ?? null,
        isVip: isVip(Number(c.totalSpent), c.totalOrders), isBlocked: c.isBlacklisted || blocked.has(c.phone),
      })),
    };
  });
}

export async function getCustomerDetail(tenantId: string, actor: StaffActor, customerId: string) {
  assertCan(actor, "customers", "view");
  return withTenant(tenantId, async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId } });
    if (!c) throw new NotFoundError("Customer");
    const orders = await tx.order.findMany({
      relationLoadStrategy: "join", where: { customerId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 50,
      include: { items: { select: { productTitle: true, quantity: true } } },
    });
    const addr = orders[0];
    const blocked = c.isBlacklisted || Boolean(await tx.blockedContact.findFirst({ where: { phone: c.phone } }));
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;
    const returned = orders.filter((o) => o.status === "RETURNED" || o.status === "REFUNDED").length;
    const counted = orders.filter((o) => !["CANCELLED", "RETURNED", "REFUNDED"].includes(o.status));
    const spent = Number(c.totalSpent);
    return {
      id: c.id, name: c.name || c.phone, phone: c.phone, email: c.email, tags: c.tags, notes: c.notes, since: c.createdAt,
      smsConsent: c.smsConsent, emailConsent: c.emailConsent, isVip: isVip(spent, c.totalOrders), isBlocked: blocked, blockReason: c.blacklistReason,
      address: addr ? { line: addr.shippingAddress, area: addr.shippingCity, district: addr.shippingDistrict, division: addr.shippingDivision } : null,
      stats: {
        totalSpent: spent, orders: c.totalOrders,
        averageOrder: counted.length ? Math.round(counted.reduce((s, o) => s + Number(o.totalAmount), 0) / counted.length) : 0,
        deliverySuccessPercent: delivered + returned > 0 ? Math.round((delivered / (delivered + returned)) * 100) : null,
      },
      orders: orders.map((o) => ({
        id: o.id, orderNumber: o.orderNumber, createdAt: o.createdAt, status: o.status, paymentStatus: o.paymentStatus, totalAmount: Number(o.totalAmount),
        summary: o.items.slice(0, 2).map((i) => i.productTitle).join(", ") + (o.items.length > 2 ? ` + ${o.items.length - 2}` : ""),
      })),
    };
  });
}

const TAG = /^[\p{L}\p{N} _-]{1,24}$/u;

export async function updateCustomer(tenantId: string, actor: StaffActor, customerId: string, input: { name?: string; email?: string | null; tags?: string[]; notes?: string | null }): Promise<void> {
  assertCan(actor, "customers", "edit");
  if (input.tags) {
    if (input.tags.length > 20) throw new ValidationError("Use up to 20 tags");
    for (const t of input.tags) if (!TAG.test(t.trim())) throw new ValidationError("Tags can use letters, numbers, spaces and dashes");
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new ValidationError("Enter a valid email");
  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.customer.updateMany({
      where: { id: customerId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
        ...(input.tags ? { tags: [...new Set(input.tags.map((t) => t.trim()))] } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim().slice(0, 1000) || null } : {}),
      },
    });
    if (count === 0) throw new NotFoundError("Customer");
  });
}

/** Adds a customer by hand (for example before keying in a phone order). Returns the existing one if the number is known. */
export async function createCustomer(tenantId: string, actor: StaffActor, input: { name: string; phone: string; email?: string }): Promise<{ id: string; created: boolean }> {
  assertCan(actor, "customers", "edit");
  const phone = normalizeBdPhone(input.phone);
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Enter the customer's name");
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.customer.findFirst({ where: { phone } });
    if (existing) return { id: existing.id, created: false };
    const c = await tx.customer.create({ data: { tenantId, name, phone, email: input.email?.trim() || null } });
    await audit(tx, tenantId, actor, "customer.created", { phone });
    return { id: c.id, created: true };
  });
}

/** Blocked numbers cannot place new orders (the order service refuses them without saying why). */
export async function setCustomerBlocked(tenantId: string, actor: StaffActor, customerId: string, blocked: boolean, reason?: string): Promise<void> {
  assertCan(actor, "customers", "edit");
  await withTenant(tenantId, async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId } });
    if (!c) throw new NotFoundError("Customer");
    if (blocked) {
      const why = reason?.trim().slice(0, 200) || "Blocked by the store";
      await tx.customer.update({ where: { id: customerId }, data: { isBlacklisted: true, blacklistReason: why } });
      await tx.blockedContact.upsert({ where: { tenantId_phone: { tenantId, phone: c.phone } }, create: { tenantId, phone: c.phone, reason: why, source: "MANUAL", createdBy: actor.userId }, update: { reason: why } });
    } else {
      await tx.customer.update({ where: { id: customerId }, data: { isBlacklisted: false, blacklistReason: null } });
      await tx.blockedContact.deleteMany({ where: { phone: c.phone } });
    }
    await audit(tx, tenantId, actor, blocked ? "customer.blocked" : "customer.unblocked", { phone: c.phone, reason: reason ?? null });
  });
}

/** CSV of every customer, for the owner's own records. Quoted so names with commas or quotes stay intact. */
export async function customersCsv(tenantId: string, actor: StaffActor): Promise<string> {
  assertCan(actor, "customers", "view");
  const rows = await withTenant(tenantId, (tx) => tx.customer.findMany({ orderBy: { createdAt: "asc" } }));
  const cell = (v: string | number | null) => {
    let s = v == null ? "" : String(v);
    // A cell starting with = + - @ is run as a formula by spreadsheets. Prefix a quote so imported data cannot execute.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ["Name", "Phone", "Email", "Orders", "Total spent (BDT)", "Tags", "Joined"];
  return [header.map(cell).join(","), ...rows.map((c) => [c.name, c.phone, c.email, c.totalOrders, Number(c.totalSpent), c.tags.join("; "), c.createdAt.toISOString().slice(0, 10)].map(cell).join(","))].join("\r\n");
}
