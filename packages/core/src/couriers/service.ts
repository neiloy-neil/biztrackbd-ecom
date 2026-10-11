import { createHash } from "node:crypto";
import { Prisma, getBasePrisma, withTenant, type TenantTx } from "@biztrackbd/db";
import { recordOrderEvent } from "../admin/order-events";
import { audit, redact } from "../audit/service";
import {
  CourierError, DomainError, InvalidTransitionError, NotFoundError, PlanFeatureError, ValidationError, WebhookAuthError,
} from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { transitionOrder, type Actor } from "../orders/service";
import { loadCredentials, recordVerification, resolveIntegrationByToken } from "../vault/integrations";
import { PROVIDERS } from "../vault/providers";
import { adapterFactory } from "./factory";
import {
  COURIER_PROVIDERS, COURIER_STATUS_LABELS,
  type CourierAdapter, type CourierProviderKey, type CourierStatus, type CourierUpdate,
} from "./types";

const LOCK_MINUTES = 2;
const DEFAULT_WEIGHT_G = 500;
const MAX_WEBHOOK_BYTES = 64 * 1024;
const SYNC_BATCH = 100;

const actorName = (a: StaffActor) => a.name ?? a.email;
const isCourier = (p: string): p is CourierProviderKey => (COURIER_PROVIDERS as string[]).includes(p);
const labelOf = (p: CourierProviderKey) => PROVIDERS[p].label;

/** How far along a parcel is. A message that would move it backwards is stale and ignored. */
const RANK: Record<CourierStatus, number> = { UNKNOWN: 0, BOOKED: 1, PICKED_UP: 2, IN_TRANSIT: 3, HOLD: 3, DELIVERED: 9, RETURNED: 9, REFUSED: 9 };

// ---------------------------------------------------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------------------------------------------------

export interface ConnectedCourier {
  provider: CourierProviderKey;
  label: string;
  mode: "TEST" | "LIVE";
  status: string;
}

/** Couriers the owner has entered keys for. If both a test and a live account exist, live wins. */
export async function listConnectedCouriers(tenantId: string): Promise<ConnectedCourier[]> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.tenantIntegration.findMany({ where: { provider: { in: COURIER_PROVIDERS }, status: { not: "DISABLED" } }, select: { provider: true, mode: true, status: true } }),
  );
  const best = new Map<string, ConnectedCourier>();
  for (const r of rows) {
    if (!isCourier(r.provider)) continue;
    const cur = best.get(r.provider);
    if (!cur || r.mode === "LIVE") best.set(r.provider, { provider: r.provider, label: labelOf(r.provider), mode: r.mode, status: r.status });
  }
  return COURIER_PROVIDERS.filter((p) => best.has(p)).map((p) => best.get(p)!);
}

async function adapterFor(tenantId: string, provider: CourierProviderKey, forceMode?: "TEST" | "LIVE"): Promise<{ adapter: CourierAdapter; mode: "TEST" | "LIVE" }> {
  const connected = (await listConnectedCouriers(tenantId)).find((c) => c.provider === provider);
  if (!connected && !forceMode) throw new ValidationError(`${labelOf(provider)} is not connected. Add its keys in Settings, Integrations.`);
  const mode = forceMode ?? connected!.mode;
  let creds;
  try {
    creds = await loadCredentials(tenantId, provider, mode);
  } catch (e) {
    if (e instanceof NotFoundError) throw new ValidationError(`${labelOf(provider)} is not connected. Add its keys in Settings, Integrations.`);
    // A key that cannot be decrypted is the owner's to fix. Say so without echoing anything from the vault.
    throw new ValidationError(`The saved ${labelOf(provider)} keys cannot be read. Enter them again in Settings, Integrations.`);
  }
  return { adapter: adapterFactory()(provider, { secrets: creds.secrets, config: creds.config as Record<string, string>, mode }), mode };
}

/** "Test connection" on the Integrations screen. Stores the outcome so the screen can show a tick or the courier's message. */
export async function testCourierConnection(tenantId: string, actor: StaffActor, provider: string, mode: "TEST" | "LIVE"): Promise<{ ok: true } | { ok: false; error: string }> {
  assertCan(actor, "billing", "edit");
  if (!isCourier(provider)) throw new ValidationError("That is not a courier");
  const { adapter } = await adapterFor(tenantId, provider, mode);
  try {
    await adapter.verify();
  } catch (e) {
    const error = e instanceof CourierError ? e.message : "The test failed";
    await recordVerification(tenantId, provider, mode, { ok: false, error });
    return { ok: false, error };
  }
  await recordVerification(tenantId, provider, mode, { ok: true });
  return { ok: true };
}

/** Automatic booking is a plan feature (Starter books by hand). Hand-entered tracking codes are always allowed. */
async function assertPlanAllowsBooking(tx: TenantTx): Promise<void> {
  const t = await tx.tenant.findFirstOrThrow({ select: { planTier: true } });
  const plan = await tx.plan.findUnique({ where: { tier: t.planTier } });
  const f = (plan?.features ?? {}) as Record<string, unknown>;
  if (f.courierBooking !== "auto") throw new PlanFeatureError("courierBooking");
}

async function lockOrder(tx: TenantTx, orderId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  if (rows.length === 0) throw new NotFoundError("Order");
}

// ---------------------------------------------------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------------------------------------------------

export interface BookOptions {
  provider: string;
  weightGrams?: number;
  note?: string;
}

export interface Booked {
  orderId: string;
  provider: CourierProviderKey;
  consignmentId: string;
  trackingCode: string;
  trackingUrl: string | null;
}

/**
 * Books one parcel with a courier and moves the order to Shipped.
 *
 * The courier call happens outside any database transaction (it can take seconds), so the order is first "claimed" with a
 * short lock. Two clicks, two staff, or a retry cannot both reach the courier. If the courier fails, the lock is released;
 * if the reply is lost (timeout), the lock is left to expire so a second parcel is not booked blindly.
 */
export async function bookCourier(tenantId: string, actor: StaffActor, orderId: string, opts: BookOptions): Promise<Booked> {
  assertCan(actor, "orders", "edit");
  if (!isCourier(opts.provider)) throw new ValidationError("Choose a courier");
  const provider = opts.provider;
  const { adapter } = await adapterFor(tenantId, provider);
  const by: Actor = { type: "MERCHANT", id: actor.userId, name: actorName(actor) };
  const weightGrams = Math.min(Math.max(Math.round(opts.weightGrams ?? DEFAULT_WEIGHT_G), 50), 30_000);

  const claimed = await withTenant(tenantId, async (tx) => {
    await assertPlanAllowsBooking(tx);
    await lockOrder(tx, orderId);
    const o = await tx.order.findFirstOrThrow({ where: { id: orderId }, include: { items: true } });
    if (o.status !== "CONFIRMED" && o.status !== "PROCESSING") {
      throw new ValidationError(o.status === "PENDING" ? "Confirm the order before booking a courier" : `A ${o.status.toLowerCase()} order cannot be booked`);
    }
    if (o.consignmentId) throw new ValidationError(`Already booked with ${o.courierProvider ?? "a courier"} (${o.trackingCode ?? o.consignmentId})`);
    if (o.fraudReview === "HELD") throw new ValidationError("This order is held for review. Call the customer, then release the hold.");
    if (o.paymentMethod !== "COD" && o.paymentStatus !== "PAID") throw new ValidationError("Confirm the payment before booking a courier");

    const n = await tx.$executeRaw`
      UPDATE "Order" SET "courierBookingLock" = now()
      WHERE "id" = ${orderId} AND "consignmentId" IS NULL
        AND ("courierBookingLock" IS NULL OR "courierBookingLock" < now() - make_interval(mins => ${LOCK_MINUTES}))`;
    if (n === 0) throw new ValidationError("A booking for this order is already in progress. Wait a moment, then check the order.");

    return {
      status: o.status,
      parcel: {
        orderNumber: o.orderNumber, recipientName: o.customerName, recipientPhone: o.customerPhone,
        address: o.shippingAddress, district: o.shippingDistrict, area: o.shippingCity,
        // Already paid in advance means nothing to collect at the door.
        codAmount: o.paymentMethod === "COD" && o.paymentStatus !== "PAID" ? Number(o.totalAmount) : 0,
        weightGrams, itemCount: o.items.reduce((s, i) => s + i.quantity, 0), note: (opts.note ?? o.notes ?? "").trim() || undefined,
      },
    };
  });

  const release = () => withTenant(tenantId, (tx) => tx.order.updateMany({ where: { id: orderId }, data: { courierBookingLock: null } }));

  // A confirmed order is packed on the way out, so "to pack" and "shipped" never disagree.
  if (claimed.status === "CONFIRMED") {
    try {
      await transitionOrder(tenantId, orderId, "PROCESSING", by, "packed for the courier");
    } catch (e) {
      await release();
      throw e;
    }
  }

  let result;
  try {
    result = await adapter.book(claimed.parcel);
  } catch (e) {
    const message = e instanceof CourierError ? e.message : "The courier could not be reached";
    const ambiguous = e instanceof CourierError && e.ambiguous;
    await withTenant(tenantId, async (tx) => {
      if (!ambiguous) await tx.order.updateMany({ where: { id: orderId }, data: { courierBookingLock: null } });
      await recordOrderEvent(tx, tenantId, orderId, {
        type: "COURIER_FAILED", message: `${labelOf(provider)} booking failed: ${message}`.slice(0, 500), actor: { id: actor.userId, name: actorName(actor) }, data: { provider, ambiguous },
      });
    });
    throw e instanceof DomainError ? e : new CourierError(message, labelOf(provider));
  }

  await withTenant(tenantId, async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        courierProvider: provider, consignmentId: result.consignmentId, trackingCode: result.trackingCode, courierTrackingUrl: result.trackingUrl ?? null,
        courierBookingFee: result.fee ?? null, courierBookedAt: new Date(), courierStatus: result.status, courierStatusAt: new Date(), courierSyncedAt: new Date(),
        courierBookingLock: null, settlementStatus: "PENDING_DELIVERY",
      },
    });
    await recordOrderEvent(tx, tenantId, orderId, {
      type: "COURIER_BOOKED",
      message: `Booked with ${labelOf(provider)}${claimed.parcel.codAmount > 0 ? `, collect ৳${claimed.parcel.codAmount}` : ", already paid"}. Tracking ${result.trackingCode}`,
      actor: { id: actor.userId, name: actorName(actor) },
      data: { provider, consignmentId: result.consignmentId, trackingCode: result.trackingCode, codAmount: claimed.parcel.codAmount, weightGrams },
    });
    await audit(tx, tenantId, actor, "courier.booked", { orderNumber: claimed.parcel.orderNumber, provider, consignmentId: result.consignmentId, codAmount: claimed.parcel.codAmount });
  });

  await transitionOrder(tenantId, orderId, "SHIPPED", by, `${labelOf(provider)} ${result.trackingCode}`);
  return { orderId, provider, consignmentId: result.consignmentId, trackingCode: result.trackingCode, trackingUrl: result.trackingUrl ?? null };
}

/** Books many orders one after another (couriers rate-limit; a loop keeps the order and the error per parcel). */
export async function bookCouriers(
  tenantId: string, actor: StaffActor, orderIds: string[], opts: BookOptions,
): Promise<{ done: Booked[]; skipped: { id: string; reason: string }[] }> {
  assertCan(actor, "orders", "edit");
  const done: Booked[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const id of [...new Set(orderIds)].slice(0, 50)) {
    try {
      done.push(await bookCourier(tenantId, actor, id, opts));
    } catch (e) {
      skipped.push({ id, reason: e instanceof Error ? e.message : "failed" });
    }
  }
  return { done, skipped };
}

// ---------------------------------------------------------------------------------------------------------------------
// Status updates (webhook, sync, manual refresh all end up here)
// ---------------------------------------------------------------------------------------------------------------------

export type ApplyResult = "APPLIED" | "IGNORED";

const TERMINAL = new Set(["DELIVERED", "RETURNED", "REFUNDED", "CANCELLED"]);

/**
 * Applies one courier status to one order. Idempotent and order-tolerant: a repeat changes nothing, an older message
 * arriving late is ignored, and "delivered" can never be overwritten by "in transit".
 */
export async function applyCourierUpdate(tenantId: string, orderId: string, provider: CourierProviderKey, u: CourierUpdate): Promise<ApplyResult> {
  const by: Actor = { type: "COURIER_WEBHOOK", name: labelOf(provider) };
  const reason = `${labelOf(provider)}: ${COURIER_STATUS_LABELS[u.status].toLowerCase()}`;

  const plan = await withTenant(tenantId, async (tx): Promise<"none" | "delivered" | "returned" | "refused"> => {
    await lockOrder(tx, orderId);
    const o = await tx.order.findFirstOrThrow({ where: { id: orderId } });
    const touch = { courierSyncedAt: new Date() };
    if (u.status === "UNKNOWN") {
      await tx.order.update({ where: { id: orderId }, data: touch });
      return "none";
    }
    if (u.status === "DELIVERED") {
      await tx.order.update({ where: { id: orderId }, data: touch });
      return o.status === "SHIPPED" ? "delivered" : "none";
    }
    if (u.status === "RETURNED" || u.status === "REFUSED") {
      await tx.order.update({ where: { id: orderId }, data: touch });
      // A delivered parcel can still come back (the courier corrects itself); anything else already closed stays closed.
      return o.status === "SHIPPED" || o.status === "DELIVERED" ? (u.status === "REFUSED" ? "refused" : "returned") : "none";
    }
    // Progress messages: BOOKED, PICKED_UP, IN_TRANSIT, HOLD.
    const current = (o.courierStatus ?? "UNKNOWN") as CourierStatus;
    if (TERMINAL.has(o.status) || RANK[current] > RANK[u.status] || current === u.status) {
      await tx.order.update({ where: { id: orderId }, data: touch });
      return "none";
    }
    await tx.order.update({ where: { id: orderId }, data: { ...touch, courierStatus: u.status, courierStatusAt: u.occurredAt ?? new Date() } });
    await recordOrderEvent(tx, tenantId, orderId, {
      type: "COURIER_STATUS", message: `${labelOf(provider)}: ${COURIER_STATUS_LABELS[u.status]}`, actor: { name: labelOf(provider) },
      data: { provider, status: u.status, raw: u.rawStatus },
    });
    return "none";
  });

  if (plan === "none") return "IGNORED";
  try {
    await transitionOrder(tenantId, orderId, plan === "delivered" ? "DELIVERED" : "RETURNED", by, reason, { refused: plan === "refused" });
  } catch (e) {
    // Two messages raced and the other one won. The order is where it should be.
    if (e instanceof InvalidTransitionError) return "IGNORED";
    throw e;
  }
  await withTenant(tenantId, (tx) =>
    tx.order.update({ where: { id: orderId }, data: { courierStatus: plan === "delivered" ? "DELIVERED" : plan === "refused" ? "REFUSED" : "RETURNED", courierStatusAt: u.occurredAt ?? new Date() } }),
  );
  return "APPLIED";
}

/** Owner-entered return of a parcel (their own rider, or a courier they book by hand). Counts toward the buyer's trust record. */
export async function markParcelReturned(tenantId: string, actor: StaffActor, orderId: string, opts: { refused: boolean; note?: string }): Promise<void> {
  assertCan(actor, "orders", "edit");
  const why = opts.refused ? "refused at the door" : "came back undelivered";
  await transitionOrder(tenantId, orderId, "RETURNED", { type: "MERCHANT", id: actor.userId, name: actorName(actor) }, `${why}${opts.note?.trim() ? `: ${opts.note.trim().slice(0, 200)}` : ""}`, { refused: opts.refused });
}

// ---------------------------------------------------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------------------------------------------------

export interface WebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

const sha = (...parts: string[]) => createHash("sha256").update(parts.join("|")).digest("hex");

/**
 * A courier callback. The store is identified by the random token in the URL (docs/10 section 1), the body is checked by the
 * adapter, repeated deliveries are recognised by a hash and do nothing, and the raw message is kept in `CourierEvent`.
 * Unknown parcels are answered with 200 so the courier does not retry them forever.
 */
export async function handleCourierWebhook(token: string, headers: Record<string, string>, rawBody: string): Promise<WebhookResponse> {
  const target = await resolveIntegrationByToken(token);
  if (!target || !isCourier(target.provider)) return { status: 404, body: { ok: false } };
  if (Buffer.byteLength(rawBody) > MAX_WEBHOOK_BYTES) return { status: 413, body: { ok: false } };
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false } };
  }
  const { tenantId, provider, mode } = target;
  let creds;
  try {
    creds = await loadCredentials(tenantId, provider, mode);
  } catch {
    return { status: 404, body: { ok: false } };
  }
  const adapter = adapterFactory()(provider, { secrets: creds.secrets, config: creds.config as Record<string, string>, mode });

  let update: CourierUpdate | null;
  try {
    update = adapter.parseWebhook(headers, body, rawBody);
  } catch (e) {
    if (e instanceof WebhookAuthError) return { status: 401, body: { ok: false } };
    throw e;
  }
  if (!update) return { status: 200, body: { ok: true, ignored: true } };

  const ref = update.consignmentId ?? update.invoice ?? "";
  const dedupeKey = sha(provider, ref, update.status, update.rawStatus, update.occurredAt?.toISOString() ?? sha(rawBody));

  const seen = await withTenant(tenantId, (tx) => tx.courierEvent.findFirst({ where: { provider, dedupeKey }, select: { id: true } }));
  if (seen) return { status: 200, body: { ok: true, duplicate: true } };

  const order = await withTenant(tenantId, (tx) =>
    tx.order.findFirst({
      where: { courierProvider: provider, OR: [...(update!.consignmentId ? [{ consignmentId: update!.consignmentId }] : []), ...(update!.invoice ? [{ orderNumber: update!.invoice }] : [])] },
      select: { id: true },
    }),
  );

  let result: "APPLIED" | "IGNORED" | "UNKNOWN_ORDER" | "ERROR" = "UNKNOWN_ORDER";
  if (order) {
    try {
      result = await applyCourierUpdate(tenantId, order.id, provider, update);
    } catch (e) {
      console.error("[courier webhook] apply failed", provider, e instanceof Error ? e.message : e);
      result = "ERROR";
    }
  }
  try {
    await withTenant(tenantId, (tx) =>
      tx.courierEvent.create({
        data: {
          tenantId, provider, dedupeKey, orderId: order?.id, consignmentId: update!.consignmentId, status: update!.status, source: "WEBHOOK", result,
          payload: redact(body) as Prisma.InputJsonValue,
        },
      }),
    );
  } catch (e) {
    // The same message arrived twice at once; the first one is on file.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  // 500 on a real failure so the courier retries; the retry is safe because applying is idempotent.
  return result === "ERROR" ? { status: 500, body: { ok: false } } : { status: 200, body: { ok: true, result } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Sync (the 30-minute safety net behind the webhooks)
// ---------------------------------------------------------------------------------------------------------------------

export interface SyncSummary {
  checked: number;
  changed: number;
  failed: number;
}

/** Asks each courier about this store's parcels that are still out. Webhooks are the fast path; this catches what they missed. */
export async function syncCourierStatuses(tenantId: string, opts: { olderThanMinutes?: number; orderIds?: string[]; limit?: number } = {}): Promise<SyncSummary> {
  const staleBefore = new Date(Date.now() - (opts.olderThanMinutes ?? 25) * 60_000);
  const parcels = await withTenant(tenantId, (tx) =>
    tx.order.findMany({
      where: {
        status: "SHIPPED", consignmentId: { not: null }, courierProvider: { in: COURIER_PROVIDERS },
        ...(opts.orderIds ? { id: { in: opts.orderIds } } : { OR: [{ courierSyncedAt: null }, { courierSyncedAt: { lt: staleBefore } }] }),
      },
      select: { id: true, orderNumber: true, courierProvider: true, consignmentId: true, trackingCode: true },
      orderBy: { courierSyncedAt: { sort: "asc", nulls: "first" } },
      take: Math.min(opts.limit ?? SYNC_BATCH, SYNC_BATCH),
    }),
  );
  const sum: SyncSummary = { checked: 0, changed: 0, failed: 0 };
  const adapters = new Map<string, CourierAdapter | null>();
  for (const p of parcels) {
    const provider = p.courierProvider as CourierProviderKey;
    if (!adapters.has(provider)) {
      adapters.set(provider, await adapterFor(tenantId, provider).then((a) => a.adapter, () => null));
    }
    const adapter = adapters.get(provider);
    sum.checked++;
    if (!adapter) {
      sum.failed++;
      continue;
    }
    try {
      const s = await adapter.status({ consignmentId: p.consignmentId!, trackingCode: p.trackingCode, invoice: p.orderNumber });
      const r = await applyCourierUpdate(tenantId, p.id, provider, { consignmentId: p.consignmentId!, invoice: p.orderNumber, status: s.status, rawStatus: s.rawStatus });
      if (r === "APPLIED") sum.changed++;
    } catch (e) {
      sum.failed++;
      console.error("[courier sync] parcel failed", provider, p.orderNumber, e instanceof Error ? e.message : e);
      await withTenant(tenantId, (tx) => tx.order.updateMany({ where: { id: p.id }, data: { courierSyncedAt: new Date() } })).catch(() => {});
    }
  }
  return sum;
}

/** The owner pressed "Refresh". Looks at one order now, whatever its last sync time. */
export async function refreshCourierStatus(tenantId: string, actor: StaffActor, orderId: string): Promise<SyncSummary> {
  assertCan(actor, "orders", "view");
  return syncCourierStatuses(tenantId, { orderIds: [orderId] });
}

/** For the scheduled job: every store that has parcels out. Runs one store after another; one store's failure does not stop the rest. */
export async function syncAllStores(): Promise<{ stores: number; checked: number; changed: number; failed: number }> {
  const rows = await getBasePrisma().$queryRaw<{ tenantId: string }[]>`SELECT "tenantId" FROM tenants_with_open_parcels()`;
  const total = { stores: rows.length, checked: 0, changed: 0, failed: 0 };
  for (const r of rows) {
    try {
      const s = await syncCourierStatuses(r.tenantId);
      total.checked += s.checked;
      total.changed += s.changed;
      total.failed += s.failed;
    } catch (e) {
      total.failed++;
      console.error("[courier sync] store failed", r.tenantId, e instanceof Error ? e.message : e);
    }
  }
  return total;
}
