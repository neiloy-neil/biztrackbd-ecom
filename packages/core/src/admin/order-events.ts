import type { TenantTx } from "@biztrackbd/db";

export type OrderEventType = "PLACED" | "PAYMENT_SUBMITTED" | "PAYMENT_VERIFIED" | "PAYMENT_REJECTED" | "STATUS" | "NOTE" | "PRINTED" | "ADDRESS_CHANGED" | "COURIER_BOOKED" | "COURIER_STATUS" | "COURIER_FAILED" | "FRAUD" | "RETURN" | "SETTLEMENT" | "SMS" | "TAGS" | "CALL_NOTE" | "ITEMS_CHANGED";

export interface EventActor {
  id?: string;
  /** Shown on the timeline: a staff member's name, "Customer" or "System". */
  name: string;
}

/**
 * Adds a line to an order's timeline. Pass the transaction of the change itself so the timeline and the change
 * commit together. Messages are plain words for the shop owner; structured detail goes in `data`.
 */
export async function recordOrderEvent(
  tx: TenantTx,
  tenantId: string,
  orderId: string,
  e: { type: OrderEventType; message: string; actor: EventActor; data?: Record<string, unknown> },
): Promise<void> {
  await tx.orderEvent.create({
    data: { tenantId, orderId, type: e.type, message: e.message.slice(0, 500), actorId: e.actor.id, actorName: e.actor.name, data: (e.data ?? {}) as object },
  });
}
