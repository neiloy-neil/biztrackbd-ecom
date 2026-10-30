import type { OrderStatus } from "@biztrackbd/db";
import { InvalidTransitionError } from "../errors";

/** doc 27 order state machine. Anything not listed is rejected. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED", "REFUNDED"],
  CANCELLED: ["PENDING"],
  RETURNED: ["REFUNDED"],
  REFUNDED: [],
};

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!TRANSITIONS[from]?.includes(to)) throw new InvalidTransitionError(from, to);
}

/** Statuses whose stock is returned to the shelf when entered. */
export const RESTOCKS_ON: OrderStatus[] = ["CANCELLED", "RETURNED"];
