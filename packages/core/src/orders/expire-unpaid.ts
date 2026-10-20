import { getBasePrisma, withTenant } from "@biztrackbd/db";
import { transitionOrder } from "./service";

/** How long an online-payment order may wait for its payment before it is cancelled and its stock goes back on the shelf. */
export const GATEWAY_PAYMENT_WINDOW_MINUTES = 60;

/**
 * Cancels online-payment orders (UddoktaPay, SSLCommerz, bKash) that were never paid, so abandoned payment pages do not hold stock.
 * Only PENDING + UNPAID gateway orders are touched; a paid order never is. Safe to run often.
 */
export async function expireUnpaidGatewayOrders(opts: { olderThanMinutes?: number } = {}): Promise<{ stores: number; cancelled: number; failed: number }> {
  const minutes = opts.olderThanMinutes ?? GATEWAY_PAYMENT_WINDOW_MINUTES;
  const stores = await getBasePrisma().$queryRaw<{ tenantId: string }[]>`SELECT "tenantId" FROM tenants_with_stale_gateway_orders(${minutes}::int)`;
  const out = { stores: stores.length, cancelled: 0, failed: 0 };
  const cutoff = new Date(Date.now() - minutes * 60_000);
  for (const s of stores) {
    try {
      const stale = await withTenant(s.tenantId, (tx) =>
        tx.order.findMany({
          where: { deletedAt: null, status: "PENDING", paymentStatus: "UNPAID", paymentMethod: { in: ["GATEWAY_UDDOKTAPAY", "GATEWAY_SSLCOMMERZ", "GATEWAY_BKASH"] }, createdAt: { lt: cutoff } },
          select: { id: true },
          take: 100,
        }),
      );
      for (const o of stale) {
        try {
          await transitionOrder(s.tenantId, o.id, "CANCELLED", { type: "SYSTEM_CRON", id: "expire-unpaid", name: "Payment expiry" }, "Online payment was not completed in time");
          out.cancelled++;
        } catch (e) {
          out.failed++;
          console.error("[expire-unpaid] order failed", o.id, e instanceof Error ? e.name : "unknown");
        }
      }
    } catch (e) {
      out.failed++;
      console.error("[expire-unpaid] store failed", s.tenantId, e instanceof Error ? e.name : "unknown");
    }
  }
  return out;
}
