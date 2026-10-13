import { withTenant, type TenantTx } from "@biztrackbd/db";
import { recordOrderEvent } from "../admin/order-events";
import { audit } from "../audit/service";
import { checkSteadfastFraud } from "../couriers/steadfast";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";
import { loadCredentials } from "../vault/integrations";
import {
  FLAG_LABELS, computeUnifiedFraudScore, type CourierFraudStats, type UnifiedFraudReport,
} from "./assess";
import { lookupTrust, type TrustScore } from "./trust";

const actorName = (a: StaffActor) => a.name ?? a.email;
const OPEN = ["PENDING", "CONFIRMED", "PROCESSING"] as const;

export interface FlaggedOrder {
  id: string;
  orderNumber: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  district: string;
  total: number;
  paymentMethod: string;
  status: string;
  level: string;
  score: number;
  flags: { code: string; label: string }[];
  held: boolean;
}

export interface FraudOverview {
  held: number;
  flaggedThisMonth: number;
  blockedNumbers: number;
  /** Order value of held orders the owner then cancelled this month: the cash on delivery they did not ship. */
  valueStopped: number;
}

export interface BlockedRow {
  id: string;
  phone: string;
  reason: string;
  source: string;
  createdAt: Date;
}

const flagList = (codes: string[]) => codes.filter((c) => c !== "FIRST_TIME_BUYER").map((code) => ({ code, label: FLAG_LABELS[code] ?? code }));

export async function getFraudOverview(tenantId: string, actor: StaffActor): Promise<FraudOverview> {
  assertCan(actor, "orders", "view");
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  return withTenant(tenantId, async (tx) => {
    const [held, flagged, blocked, stopped] = await Promise.all([
      tx.order.count({ where: { fraudReview: "HELD", status: { in: [...OPEN] } } }),
      tx.order.count({ where: { fraudRiskLevel: { in: ["MEDIUM", "HIGH"] }, createdAt: { gt: monthAgo } } }),
      tx.blockedContact.count(),
      tx.order.aggregate({ _sum: { totalAmount: true }, where: { fraudReview: "HELD", status: "CANCELLED", createdAt: { gt: monthAgo } } }),
    ]);
    return { held, flaggedThisMonth: flagged, blockedNumbers: blocked, valueStopped: Number(stopped._sum.totalAmount ?? 0) };
  });
}

/** Orders that need a human look: held for review, or scored medium or high and not yet shipped. Highest risk first. */
export async function listFlaggedOrders(tenantId: string, actor: StaffActor, tab: "held" | "watch" = "held"): Promise<FlaggedOrder[]> {
  assertCan(actor, "orders", "view");
  const rows = await withTenant(tenantId, (tx) =>
    tx.order.findMany({
      where: tab === "held"
        ? { fraudReview: "HELD", status: { in: [...OPEN] } }
        : { fraudRiskLevel: { in: ["MEDIUM", "HIGH"] }, fraudReview: { not: "HELD" }, status: { in: [...OPEN] } },
      orderBy: [{ fraudTrustScore: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
  );
  return rows.map((o) => ({
    id: o.id, orderNumber: o.orderNumber, createdAt: o.createdAt, customerName: o.customerName, customerPhone: o.customerPhone, district: o.shippingDistrict,
    total: Number(o.totalAmount), paymentMethod: o.paymentMethod, status: o.status, level: o.fraudRiskLevel, score: o.fraudTrustScore, flags: flagList(o.fraudFlags), held: o.fraudReview === "HELD",
  }));
}

/** The owner has called the customer and is happy to ship. */
export async function releaseHold(tenantId: string, actor: StaffActor, orderId: string, note?: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  await withTenant(tenantId, async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId } });
    if (!o) throw new NotFoundError("Order");
    if (o.fraudReview !== "HELD") return;
    await tx.order.update({ where: { id: orderId }, data: { fraudReview: "CLEARED" } });
    const why = note?.trim().slice(0, 200);
    await recordOrderEvent(tx, tenantId, orderId, { type: "FRAUD", message: `Hold released by ${actorName(actor)}${why ? `: ${why}` : ""}`, actor: { id: actor.userId, name: actorName(actor) } });
    await audit(tx, tenantId, actor, "fraud.hold_released", { orderNumber: o.orderNumber, score: o.fraudTrustScore, note: why ?? null });
  });
}

/** Puts an order back on hold, for example after a second thought. */
export async function holdOrder(tenantId: string, actor: StaffActor, orderId: string, note?: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  await withTenant(tenantId, async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId } });
    if (!o) throw new NotFoundError("Order");
    if (!OPEN.includes(o.status as (typeof OPEN)[number])) throw new ValidationError("Only an order that has not shipped can be held");
    if (o.fraudReview === "HELD") return;
    await tx.order.update({ where: { id: orderId }, data: { fraudReview: "HELD" } });
    const why = note?.trim().slice(0, 200);
    await recordOrderEvent(tx, tenantId, orderId, { type: "FRAUD", message: `Held for review by ${actorName(actor)}${why ? `: ${why}` : ""}`, actor: { id: actor.userId, name: actorName(actor) } });
    await audit(tx, tenantId, actor, "fraud.held", { orderNumber: o.orderNumber, note: why ?? null });
  });
}

// ---- Blocklist -----------------------------------------------------------------------------------------------------

export async function listBlocked(tenantId: string, actor: StaffActor): Promise<BlockedRow[]> {
  assertCan(actor, "customers", "view");
  const rows = await withTenant(tenantId, (tx) => tx.blockedContact.findMany({ orderBy: { createdAt: "desc" }, take: 500 }));
  return rows.map((r) => ({ id: r.id, phone: r.phone, reason: r.reason, source: r.source, createdAt: r.createdAt }));
}

/** Blocks a number for this store only. Works for numbers that are not customers yet. The blocked person is not told why. */
export async function blockPhone(tenantId: string, actor: StaffActor, phoneInput: string, reason: string, source: "MANUAL" | "FRAUD_REVIEW" | "REFUSED_PARCELS" = "MANUAL"): Promise<void> {
  assertCan(actor, "customers", "edit");
  const phone = normalizeBdPhone(phoneInput);
  if (!/^01[3-9]\d{8}$/.test(phone)) throw new ValidationError("Enter a Bangladesh mobile number, for example 01712345678");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new ValidationError("Say briefly why, for example: refused three parcels");
  await withTenant(tenantId, async (tx) => {
    await tx.blockedContact.upsert({ where: { tenantId_phone: { tenantId, phone } }, create: { tenantId, phone, reason: why, source, createdBy: actor.userId }, update: { reason: why, source } });
    await tx.customer.updateMany({ where: { phone }, data: { isBlacklisted: true, blacklistReason: why } });
    await audit(tx, tenantId, actor, "customer.blocked", { phone, reason: why, source });
  });
}

export async function unblockPhone(tenantId: string, actor: StaffActor, blockedId: string): Promise<void> {
  assertCan(actor, "customers", "edit");
  await withTenant(tenantId, async (tx) => {
    const b = await tx.blockedContact.findFirst({ where: { id: blockedId } });
    if (!b) throw new NotFoundError("Blocked number");
    await tx.blockedContact.delete({ where: { id: b.id } });
    await tx.customer.updateMany({ where: { phone: b.phone }, data: { isBlacklisted: false, blacklistReason: null } });
    await audit(tx, tenantId, actor, "customer.unblocked", { phone: b.phone });
  });
}

// ---- Number lookup -------------------------------------------------------------------------------------------------

// ---- Number lookup & Unified Fraud ---------------------------------------------------------------------------------

export interface PhoneLookup {
  phone: string;
  /** Across every store on the platform. Counts only; never names, addresses or items (docs/12 section 1C). */
  network: TrustScore;
  /** This store's own orders for the number. */
  here: { orders: number; delivered: number; returned: number; cancelled: number };
  blocked: boolean;
  courier?: CourierFraudStats | null;
  unifiedScore?: number;
  unifiedLevel?: string;
}

/** Safely fetches Steadfast cross-merchant delivery stats if keys are configured in the store's vault */
export async function fetchSteadfastFraudStats(tenantId: string, phone: string): Promise<CourierFraudStats | null> {
  try {
    let mode: "LIVE" | "TEST" = "LIVE";
    let creds = await loadCredentials(tenantId, "STEADFAST", "LIVE").catch(() => null);
    if (!creds) {
      creds = await loadCredentials(tenantId, "STEADFAST", "TEST").catch(() => null);
      mode = "TEST";
    }
    if (!creds?.secrets?.apiKey || !creds?.secrets?.secretKey) return null;
    const res = await checkSteadfastFraud({
      mode,
      fetch: globalThis.fetch,
      secrets: creds.secrets,
      config: creds.config,
    }, phone);
    if (!res) return null;
    return {
      provider: "STEADFAST",
      totalParcels: res.totalParcels,
      deliveredParcels: res.deliveredParcels,
      cancelledParcels: res.cancelledParcels,
      successRatio: res.successRate,
    };
  } catch {
    return null;
  }
}

async function lookup(tx: TenantTx, phone: string, courierStats: CourierFraudStats | null = null): Promise<PhoneLookup> {
  const [network, orders, delivered, returned, cancelled, blocked] = await Promise.all([
    lookupTrust(tx, phone),
    tx.order.count({ where: { customerPhone: phone } }),
    tx.order.count({ where: { customerPhone: phone, status: "DELIVERED" } }),
    tx.order.count({ where: { customerPhone: phone, status: { in: ["RETURNED", "REFUNDED"] } } }),
    tx.order.count({ where: { customerPhone: phone, status: "CANCELLED" } }),
    tx.blockedContact.findFirst({ where: { phone }, select: { id: true } }),
  ]);

  const unified = computeUnifiedFraudScore({
    courierStats,
    networkTrust: network,
    storeHistory: { orders, delivered, returned, cancelled },
    flags: [],
    isCod: true,
    customerFacing: true,
  });

  return {
    phone,
    network,
    here: { orders, delivered, returned, cancelled },
    blocked: Boolean(blocked),
    courier: courierStats,
    unifiedScore: unified.score,
    unifiedLevel: unified.level,
  };
}

/** Check a number before taking its order, for example while on the phone with a new customer. */
export async function lookupPhone(tenantId: string, actor: StaffActor, phoneInput: string): Promise<PhoneLookup> {
  assertCan(actor, "orders", "view");
  const phone = normalizeBdPhone(phoneInput);
  if (!/^01[3-9]\d{8}$/.test(phone)) throw new ValidationError("Enter a Bangladesh mobile number, for example 01712345678");
  const courierStats = await fetchSteadfastFraudStats(tenantId, phone);
  return withTenant(tenantId, (tx) => lookup(tx, phone, courierStats));
}

/** The same lookup for an order's own number, inside the order screen. */
export async function lookupInTx(tx: TenantTx, phone: string, courierStats: CourierFraudStats | null = null): Promise<PhoneLookup> {
  return lookup(tx, phone, courierStats);
}

/**
 * Re-queries Steadfast live for the order customer's phone number, recomputes the unified blended fraud score,
 * updates the order, and logs an order timeline event.
 */
export async function refreshOrderFraudReport(tenantId: string, actor: StaffActor, orderId: string): Promise<UnifiedFraudReport> {
  assertCan(actor, "orders", "edit");
  return withTenant(tenantId, async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId } });
    if (!o) throw new NotFoundError("Order");

    const [courierStats, trust, storeOrders, storeDelivered, storeReturned, storeCancelled] = await Promise.all([
      fetchSteadfastFraudStats(tenantId, o.customerPhone),
      lookupTrust(tx, o.customerPhone),
      tx.order.count({ where: { customerPhone: o.customerPhone } }),
      tx.order.count({ where: { customerPhone: o.customerPhone, status: "DELIVERED" } }),
      tx.order.count({ where: { customerPhone: o.customerPhone, status: { in: ["RETURNED", "REFUNDED"] } } }),
      tx.order.count({ where: { customerPhone: o.customerPhone, status: "CANCELLED" } }),
    ]);

    const isCod = o.paymentMethod === "COD";
    const report = computeUnifiedFraudScore({
      courierStats,
      networkTrust: trust,
      storeHistory: { orders: storeOrders, delivered: storeDelivered, returned: storeReturned, cancelled: storeCancelled },
      flags: o.fraudFlags,
      isCod,
      customerFacing: true,
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        fraudTrustScore: report.score,
        fraudRiskLevel: report.level,
      },
    });

    const courierMsg = courierStats
      ? `Steadfast courier stats: ${courierStats.totalParcels} parcels, ${courierStats.deliveredParcels} delivered (${courierStats.successRatio}% success)`
      : "No external courier history recorded";

    await recordOrderEvent(tx, tenantId, orderId, {
      type: "FRAUD",
      message: `Fraud score refreshed by ${actorName(actor)}: ${report.score}/100 (${report.levelLabel}) · ${courierMsg}`,
      actor: { id: actor.userId, name: actorName(actor) },
      data: {
        score: report.score,
        level: report.level,
        courier: courierStats,
      },
    });

    await audit(tx, tenantId, actor, "fraud.score_refreshed", {
      orderNumber: o.orderNumber,
      newScore: report.score,
      newLevel: report.level,
      courierRatio: courierStats?.successRatio ?? null,
    });

    return report;
  });
}

