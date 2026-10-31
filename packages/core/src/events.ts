/**
 * Domain events. Phase 0 ships the seam only: handlers are registered in-process and the default is a no-op.
 * Phase 1 swaps `setEventPublisher` for Inngest (docs/16) without touching the order code.
 * Handlers must be idempotent: delivery is at-least-once once a real queue sits behind this.
 */
export interface DomainEvents {
  "order/created": { tenantId: string; orderId: string; orderNumber: string; totalAmount: number };
  /** Fired once when a store's monthly order count reaches 80%, 100% or 110% of its plan. Orders are never blocked. */
  /** A store started connecting a custom domain. The Phase 7 worker polls DNS and calls confirmDomainVerified. */
  "domain/registered": { tenantId: string; domainId: string; host: string };
  /** Pushing routes to the edge failed. Postgres is still correct; a sweep should retry. */
  "routing/sync-failed": { tenantId: string };
  /** A store signed itself up. */
  "store/created": { tenantId: string; subdomain: string; plan: string };
  /** A store changed its default subdomain address. */
  "tenant/subdomain-changed": { tenantId: string; from: string; to: string };
  /** The platform approved a subscription payment: the plan is live. */
  "billing/payment-approved": { tenantId: string; plan: string; interval: string; periodEnd: string };
  /** A store is at a billing milestone worth a message (Bangla and English SMS/email once messaging ships). */
  "billing/reminder": { tenantId: string; kind: "TRIAL_ENDING" | "RENEWAL_DUE" | "PAYMENT_OVERDUE" | "READ_ONLY_STARTED" | "LOCKED"; daysLeft: number | null };
  "usage/threshold-crossed": { tenantId: string; metric: "orders"; percent: 80 | 100 | 110; used: number; limit: number };
}

export type EventName = keyof DomainEvents;
export type EventPublisher = <N extends EventName>(name: N, data: DomainEvents[N]) => Promise<void>;

let publisher: EventPublisher = async () => {};

export function setEventPublisher(p: EventPublisher): void {
  publisher = p;
}

/** Publishing never fails the caller: the order is already committed. Failures are logged for the retry sweep. */
export async function publishEvent<N extends EventName>(name: N, data: DomainEvents[N]): Promise<void> {
  try {
    await publisher(name, data);
  } catch (e) {
    console.error(`[events] failed to publish ${name}`, e);
  }
}
