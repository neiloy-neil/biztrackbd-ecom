import type { TenantStatus } from "@biztrackbd/db";

/**
 * What a store may do, from its dates (docs/12 section 4, docs/07 section 21).
 *
 *   TRIAL      free trial running
 *   ACTIVE     paid up
 *   GRACE      unpaid, days 1 to 3: everything works, a banner asks for payment
 *   READ_ONLY  unpaid, days 4 to 14: the store shows its offline page; the admin can look and export but not change
 *   LOCKED     unpaid from day 15, cancelled, or switched off by the platform: only the billing page opens
 *
 * Worked out from dates every time, never from a stored flag alone, so a late or failed sweep cannot leave a store open.
 */
export type AccessState = "TRIAL" | "ACTIVE" | "GRACE" | "READ_ONLY" | "LOCKED";

export const GRACE_DAYS = 3;
export const READ_ONLY_UNTIL_DAY = 14;
const DAY = 86_400_000;

export interface AccessInput {
  status: TenantStatus;
  trialEndsAt: Date;
  suspendedReason?: string | null;
  /** `amount` is 0 for a trial and the price paid for a paid period. */
  subscription?: { amount: number; currentPeriodEnd: Date } | null;
}

export interface Access {
  state: AccessState;
  /** The date the paid or trial time ran, or runs, out. */
  paidThrough: Date;
  /** Days left while TRIAL or ACTIVE, rounded up (a fresh 14-day trial says 14; the last day says 1); null otherwise. */
  daysLeft: number | null;
  /** Days since it ran out, from 1, while overdue; null otherwise. */
  overdueDays: number | null;
  /** Switched off by the platform rather than by an unpaid bill. */
  suspendedByPlatform: boolean;
  /** When the next stage starts, for the countdown banner. */
  nextStageAt: Date | null;
}

export function accessState(input: AccessInput, now: Date = new Date()): Access {
  const sub = input.subscription ?? null;
  const paying = sub !== null && sub.amount > 0;
  const paidThrough = sub ? sub.currentPeriodEnd : input.trialEndsAt;
  const base = { paidThrough, daysLeft: null as number | null, overdueDays: null as number | null, suspendedByPlatform: false, nextStageAt: null as Date | null };

  if (input.suspendedReason) return { ...base, state: "LOCKED", suspendedByPlatform: true };
  if (input.status === "CANCELLED") return { ...base, state: "LOCKED" };

  const elapsed = now.getTime() - paidThrough.getTime();
  if (elapsed <= 0) {
    return { ...base, state: paying ? "ACTIVE" : "TRIAL", daysLeft: Math.ceil(-elapsed / DAY), nextStageAt: paidThrough };
  }
  const overdue = Math.ceil(elapsed / DAY);
  const at = (d: number) => new Date(paidThrough.getTime() + d * DAY);
  if (overdue <= GRACE_DAYS) return { ...base, state: "GRACE", overdueDays: overdue, nextStageAt: at(GRACE_DAYS) };
  if (overdue <= READ_ONLY_UNTIL_DAY) return { ...base, state: "READ_ONLY", overdueDays: overdue, nextStageAt: at(READ_ONLY_UNTIL_DAY) };
  return { ...base, state: "LOCKED", overdueDays: overdue };
}

/** The tenant status the sweep stores for an access state, because the storefront router reads the status (offline page). */
export function statusFor(state: AccessState, current: TenantStatus): TenantStatus {
  if (current === "CANCELLED") return "CANCELLED";
  switch (state) {
    case "TRIAL": return "TRIAL";
    case "ACTIVE": return "ACTIVE";
    case "GRACE": return "PAST_DUE";
    case "READ_ONLY": case "LOCKED": return "SUSPENDED";
  }
}

export const ACCESS_LABELS: Record<AccessState, string> = {
  TRIAL: "Free trial", ACTIVE: "Active", GRACE: "Payment overdue", READ_ONLY: "Read-only", LOCKED: "Locked",
};

/** Adds whole calendar months or years, keeping the day of the month (31 Jan plus one month is 28 or 29 Feb). */
export function addPeriod(from: Date, interval: "MONTHLY" | "YEARLY"): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + (interval === "YEARLY" ? 12 : 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}
