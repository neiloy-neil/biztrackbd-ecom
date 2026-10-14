import { Prisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { currentSmsSender } from "../customers/auth";
import { NotFoundError, ValidationError } from "../errors";
import { consumeSmsCredit } from "../growth/abandoned";
import { adjustPoints } from "../loyalty/service";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";
import { dhakaDate } from "./dashboard";

export { adjustPoints };

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

export interface CustomerActivityItem {
  id: string;
  date: Date;
  type: "ORDER" | "SMS" | "REVIEW" | "LOYALTY" | "CREDIT" | "STAFF";
  title: string;
  detail?: string;
  link?: string;
}

export interface CustomerAddressView {
  id: string;
  label: string;
  address: string;
  district: string;
  division: string;
  upazila: string | null;
  isDefault: boolean;
}

export interface CustomerDetailView {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  notes: string | null;
  since: Date;
  smsConsent: boolean;
  emailConsent: boolean;
  birthMonth: number | null;
  birthDay: number | null;
  isVip: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  storeCredit: number;
  deliveryScore: number;
  loyalty: {
    availablePoints: number;
    pendingPoints: number;
    lifetimePoints: number;
    tier: string;
  } | null;
  addresses: CustomerAddressView[];
  address: { line: string; area: string; district: string; division: string } | null;
  stats: {
    totalSpent: number;
    orders: number;
    averageOrder: number;
    deliverySuccessPercent: number | null;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    createdAt: Date;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    summary: string;
  }>;
  activity: CustomerActivityItem[];
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

export async function getCustomerDetail(tenantId: string, actor: StaffActor, customerId: string): Promise<CustomerDetailView> {
  assertCan(actor, "customers", "view");
  return withTenant(tenantId, async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId } });
    if (!c) throw new NotFoundError("Customer");

    const [orders, loyaltyAccount, reviews, savedAddresses, auditLogs] = await Promise.all([
      tx.order.findMany({
        relationLoadStrategy: "join",
        where: { customerId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { items: { select: { productTitle: true, quantity: true } } },
      }),
      tx.customerLoyaltyAccount.findFirst({
        where: { customerId },
        include: { transactions: { orderBy: { createdAt: "desc" }, take: 20 } },
      }),
      tx.review.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { product: { select: { title: true } } },
      }),
      tx.customerAddress.findMany({
        where: { customerId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      }),
      tx.auditLog.findMany({
        where: {
          tenantId,
          OR: [
            { action: { startsWith: "customer." } },
            { action: { startsWith: "loyalty." } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const fallbackAddr = orders[0];
    const defaultAddr = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    const primaryAddress = defaultAddr
      ? { line: defaultAddr.address, area: defaultAddr.upazila ?? defaultAddr.district, district: defaultAddr.district, division: defaultAddr.division }
      : fallbackAddr
      ? { line: fallbackAddr.shippingAddress, area: fallbackAddr.shippingCity, district: fallbackAddr.shippingDistrict, division: fallbackAddr.shippingDivision }
      : null;

    const blocked = c.isBlacklisted || Boolean(await tx.blockedContact.findFirst({ where: { phone: c.phone } }));
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;
    const returned = orders.filter((o) => o.status === "RETURNED" || o.status === "REFUNDED").length;
    const counted = orders.filter((o) => !["CANCELLED", "RETURNED", "REFUNDED"].includes(o.status));
    const spent = Number(c.totalSpent);

    // Build unified chronological activity timeline
    const activity: CustomerActivityItem[] = [];

    for (const o of orders) {
      activity.push({
        id: `order-placed-${o.id}`,
        date: o.createdAt,
        type: "ORDER",
        title: `Placed order ${o.orderNumber}`,
        detail: `৳${Number(o.totalAmount).toLocaleString()} · ${o.status}`,
        link: `/orders/${o.id}`,
      });
      if (o.status === "DELIVERED") {
        activity.push({
          id: `order-del-${o.id}`,
          date: o.updatedAt,
          type: "ORDER",
          title: `Order ${o.orderNumber} delivered`,
          detail: "Successfully completed",
          link: `/orders/${o.id}`,
        });
      } else if (o.status === "RETURNED" || o.status === "REFUNDED") {
        activity.push({
          id: `order-ret-${o.id}`,
          date: o.updatedAt,
          type: "ORDER",
          title: `Order ${o.orderNumber} ${o.status.toLowerCase()}`,
          detail: "Order returned or refunded",
          link: `/orders/${o.id}`,
        });
      }
    }

    if (loyaltyAccount) {
      for (const t of loyaltyAccount.transactions) {
        activity.push({
          id: `loyalty-${t.id}`,
          date: t.createdAt,
          type: "LOYALTY",
          title: `${t.points >= 0 ? "+" : ""}${t.points} loyalty points`,
          detail: t.description,
        });
      }
    }

    for (const r of reviews) {
      activity.push({
        id: `review-${r.id}`,
        date: r.createdAt,
        type: "REVIEW",
        title: `Wrote a ${r.rating}★ review`,
        detail: `${r.product?.title ?? "Product"}: "${r.body?.slice(0, 80) ?? ""}"`,
      });
    }

    const customerAudit = auditLogs.filter((a) => {
      const meta = (a.details ?? {}) as Record<string, unknown>;
      return meta.customerId === customerId || meta.phone === c.phone;
    });

    for (const a of customerAudit) {
      const meta = (a.details ?? {}) as Record<string, unknown>;
      if (a.action === "customer.sms_sent") {
        activity.push({
          id: `audit-${a.id}`,
          date: a.createdAt,
          type: "SMS",
          title: "Direct SMS sent",
          detail: typeof meta.text === "string" ? meta.text : "SMS sent to customer",
        });
      } else if (a.action === "customer.store_credit_adjusted") {
        const amt = Number(meta.amount ?? 0);
        activity.push({
          id: `audit-${a.id}`,
          date: a.createdAt,
          type: "CREDIT",
          title: `Store credit adjusted (${amt >= 0 ? `+৳${amt}` : `-৳${Math.abs(amt)}`})`,
          detail: typeof meta.reason === "string" ? meta.reason : undefined,
        });
      } else if (a.action === "customer.blocked") {
        activity.push({
          id: `audit-${a.id}`,
          date: a.createdAt,
          type: "STAFF",
          title: "Customer blocked",
          detail: typeof meta.reason === "string" ? meta.reason : undefined,
        });
      } else if (a.action === "customer.unblocked") {
        activity.push({
          id: `audit-${a.id}`,
          date: a.createdAt,
          type: "STAFF",
          title: "Customer unblocked",
        });
      } else if (a.action === "customer.created") {
        activity.push({
          id: `audit-${a.id}`,
          date: a.createdAt,
          type: "STAFF",
          title: "Customer profile created",
        });
      } else if (a.action === "customer.address_added") {
        activity.push({
          id: `audit-${a.id}`,
          date: a.createdAt,
          type: "STAFF",
          title: "New shipping address added",
        });
      }
    }

    activity.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      id: c.id,
      name: c.name || c.phone,
      phone: c.phone,
      email: c.email,
      tags: c.tags,
      notes: c.notes,
      since: c.createdAt,
      smsConsent: c.smsConsent,
      emailConsent: c.emailConsent,
      birthMonth: c.birthMonth,
      birthDay: c.birthDay,
      isVip: isVip(spent, c.totalOrders),
      isBlocked: blocked,
      blockReason: c.blacklistReason,
      storeCredit: Number(c.storeCredit ?? 0),
      deliveryScore: c.deliveryScore ?? 90,
      loyalty: loyaltyAccount
        ? {
            availablePoints: loyaltyAccount.availablePoints,
            pendingPoints: loyaltyAccount.pendingPoints,
            lifetimePoints: loyaltyAccount.lifetimePoints,
            tier: loyaltyAccount.currentTier,
          }
        : null,
      addresses: savedAddresses.map((a) => ({
        id: a.id,
        label: a.label,
        address: a.address,
        district: a.district,
        division: a.division,
        upazila: a.upazila,
        isDefault: a.isDefault,
      })),
      address: primaryAddress,
      stats: {
        totalSpent: spent,
        orders: c.totalOrders,
        averageOrder: counted.length ? Math.round(counted.reduce((s, o) => s + Number(o.totalAmount), 0) / counted.length) : 0,
        deliverySuccessPercent: delivered + returned > 0 ? Math.round((delivered / (delivered + returned)) * 100) : null,
      },
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalAmount: Number(o.totalAmount),
        summary: o.items.slice(0, 2).map((i) => i.productTitle).join(", ") + (o.items.length > 2 ? ` + ${o.items.length - 2}` : ""),
      })),
      activity: activity.slice(0, 25),
    };
  });
}

const TAG = /^[\p{L}\p{N} _-]{1,24}$/u;

export interface UpdateCustomerInput {
  name?: string;
  email?: string | null;
  tags?: string[];
  notes?: string | null;
  smsConsent?: boolean;
  emailConsent?: boolean;
  birthMonth?: number | null;
  birthDay?: number | null;
}

export async function updateCustomer(
  tenantId: string,
  actor: StaffActor,
  customerId: string,
  input: UpdateCustomerInput,
): Promise<void> {
  assertCan(actor, "customers", "edit");
  if (input.tags) {
    if (input.tags.length > 20) throw new ValidationError("Use up to 20 tags");
    for (const t of input.tags) if (!TAG.test(t.trim())) throw new ValidationError("Tags can use letters, numbers, spaces and dashes");
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new ValidationError("Enter a valid email");
  if (input.birthMonth !== undefined && input.birthMonth !== null) {
    if (input.birthMonth < 1 || input.birthMonth > 12) throw new ValidationError("Birth month must be 1 to 12");
  }
  if (input.birthDay !== undefined && input.birthDay !== null) {
    if (input.birthDay < 1 || input.birthDay > 31) throw new ValidationError("Birth day must be 1 to 31");
  }

  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.customer.updateMany({
      where: { id: customerId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
        ...(input.tags ? { tags: [...new Set(input.tags.map((t) => t.trim()))] } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim().slice(0, 1000) || null } : {}),
        ...(input.smsConsent !== undefined ? { smsConsent: Boolean(input.smsConsent) } : {}),
        ...(input.emailConsent !== undefined ? { emailConsent: Boolean(input.emailConsent) } : {}),
        ...(input.birthMonth !== undefined ? { birthMonth: input.birthMonth } : {}),
        ...(input.birthDay !== undefined ? { birthDay: input.birthDay } : {}),
      },
    });
    if (count === 0) throw new NotFoundError("Customer");
    await audit(tx, tenantId, actor, "customer.updated", { customerId });
  });
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  tags?: string[];
  smsConsent?: boolean;
  emailConsent?: boolean;
  address?: {
    label?: string;
    address: string;
    district: string;
    division: string;
    upazila?: string;
  };
}

/** Adds a customer by hand (for example before keying in a phone order). Returns the existing one if the number is known. */
export async function createCustomer(
  tenantId: string,
  actor: StaffActor,
  input: CreateCustomerInput,
): Promise<{ id: string; created: boolean }> {
  assertCan(actor, "customers", "edit");
  const phone = normalizeBdPhone(input.phone);
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Enter the customer's name");

  return withTenant(tenantId, async (tx) => {
    const existing = await tx.customer.findFirst({ where: { phone } });
    if (existing) return { id: existing.id, created: false };

    const c = await tx.customer.create({
      data: {
        tenantId,
        name,
        phone,
        email: input.email?.trim() || null,
        notes: input.notes?.trim().slice(0, 1000) || null,
        tags: input.tags ?? [],
        smsConsent: Boolean(input.smsConsent),
        emailConsent: Boolean(input.emailConsent),
      },
    });

    if (input.address && input.address.address.trim()) {
      await tx.customerAddress.create({
        data: {
          tenantId,
          customerId: c.id,
          label: input.address.label?.trim() || "Home",
          address: input.address.address.trim(),
          district: input.address.district.trim(),
          division: input.address.division.trim(),
          upazila: input.address.upazila?.trim() || null,
          isDefault: true,
        },
      });
    }

    await audit(tx, tenantId, actor, "customer.created", { customerId: c.id, phone });
    return { id: c.id, created: true };
  });
}

/** Adjusts customer store credit up or down with mandatory reason and audit record. */
export async function adjustCustomerStoreCredit(
  tenantId: string,
  actor: StaffActor,
  customerId: string,
  amount: number,
  reason: string,
): Promise<{ newBalance: number }> {
  assertCan(actor, "customers", "edit");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new ValidationError("Write the reason, at least 3 characters", { field: "reason" });
  if (amount === 0 || !Number.isFinite(amount)) throw new ValidationError("Enter a non-zero amount in Taka", { field: "amount" });

  return withTenant(tenantId, async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId } });
    if (!c) throw new NotFoundError("Customer");
    const current = Number(c.storeCredit);
    const newBal = current + amount;
    if (newBal < 0) throw new ValidationError(`Customer only has ৳${current} in store credit`, { field: "amount" });

    await tx.customer.update({
      where: { id: customerId },
      data: { storeCredit: newBal },
    });

    await audit(tx, tenantId, actor, "customer.store_credit_adjusted", {
      customerId,
      phone: c.phone,
      amount,
      previousBalance: current,
      newBalance: newBal,
      reason: why,
    });

    return { newBalance: newBal };
  });
}

/** Sends a direct custom SMS message to the customer, consuming 1 SMS credit. */
export async function sendCustomerDirectSms(
  tenantId: string,
  actor: StaffActor,
  customerId: string,
  message: string,
): Promise<void> {
  assertCan(actor, "customers", "edit");
  const text = message.trim();
  if (text.length < 3 || text.length > 500) throw new ValidationError("Message must be between 3 and 500 characters", { field: "message" });

  await withTenant(tenantId, async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId } });
    if (!c) throw new NotFoundError("Customer");

    // Verify SMS opt-out
    const optOut = await tx.smsOptOut.findFirst({ where: { phone: c.phone } });
    if (optOut) throw new ValidationError("This customer has opted out of SMS messages.");

    // Consume 1 SMS credit
    const credited = await consumeSmsCredit(tx, tenantId);
    if (!credited) {
      throw new ValidationError("Monthly SMS limit reached on your plan.");
    }

    const sender = currentSmsSender();
    await sender.send(tenantId, c.phone, text);

    await audit(tx, tenantId, actor, "customer.sms_sent", {
      customerId,
      phone: c.phone,
      text: text.slice(0, 100),
      length: text.length,
    });
  });
}

/** Saves (creates or updates) an address in the customer's address book. */
export async function saveCustomerAddress(
  tenantId: string,
  actor: StaffActor,
  customerId: string,
  input: {
    id?: string;
    label?: string;
    address: string;
    district: string;
    division: string;
    upazila?: string | null;
    isDefault?: boolean;
  },
): Promise<{ id: string }> {
  assertCan(actor, "customers", "edit");
  const line = input.address.trim();
  const district = input.district.trim();
  const division = input.division.trim();
  if (line.length < 3) throw new ValidationError("Enter the street address", { field: "address" });
  if (!district) throw new ValidationError("Select the district", { field: "district" });
  if (!division) throw new ValidationError("Select the division", { field: "division" });

  return withTenant(tenantId, async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId } });
    if (!c) throw new NotFoundError("Customer");

    if (input.isDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    if (input.id) {
      const updated = await tx.customerAddress.update({
        where: { id: input.id },
        data: {
          label: input.label?.trim() || "Home",
          address: line,
          district,
          division,
          upazila: input.upazila?.trim() || null,
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
      });
      await audit(tx, tenantId, actor, "customer.address_updated", { customerId, addressId: updated.id });
      return { id: updated.id };
    }

    const created = await tx.customerAddress.create({
      data: {
        tenantId,
        customerId,
        label: input.label?.trim() || "Home",
        address: line,
        district,
        division,
        upazila: input.upazila?.trim() || null,
        isDefault: input.isDefault ?? true,
      },
    });
    await audit(tx, tenantId, actor, "customer.address_added", { customerId, addressId: created.id });
    return { id: created.id };
  });
}

/** Removes an address from the customer's address book. */
export async function deleteCustomerAddress(
  tenantId: string,
  actor: StaffActor,
  customerId: string,
  addressId: string,
): Promise<void> {
  assertCan(actor, "customers", "edit");
  await withTenant(tenantId, async (tx) => {
    const addr = await tx.customerAddress.findFirst({ where: { id: addressId, customerId } });
    if (!addr) throw new NotFoundError("Address");
    await tx.customerAddress.delete({ where: { id: addressId } });
    await audit(tx, tenantId, actor, "customer.address_deleted", { customerId, addressId });
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
    await audit(tx, tenantId, actor, blocked ? "customer.blocked" : "customer.unblocked", { customerId, phone: c.phone, reason: reason ?? null });
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
