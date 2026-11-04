import type { TenantTx } from "@biztrackbd/db";
import { accessState } from "./lifecycle";

/**
 * What a store gets to use while it is still on its free trial, whatever plan it picked. These are the costly things
 * (a text message, an AI draft, a cross-store fraud lookup) that a throwaway signup could otherwise burn through.
 * Everything else follows the plan's full limits. Per month, and only until the store pays.
 */
export const TRIAL_CAPS = { smsCredits: 10, aiGenerations: 15, fraudLookups: 30 } as const;

/** Is this store on its free trial right now (not paying, not demo, not locked or lapsed)? */
export async function isOnTrial(tx: TenantTx, now: Date = new Date()): Promise<boolean> {
  const t = await tx.tenant.findFirstOrThrow({ select: { status: true, trialEndsAt: true, suspendedReason: true, isDemo: true } });
  const sub = await tx.subscription.findFirst({ select: { amount: true, currentPeriodEnd: true } });
  const a = accessState({ status: t.status, trialEndsAt: t.trialEndsAt, suspendedReason: t.suspendedReason, isDemo: t.isDemo, subscription: sub ? { amount: Number(sub.amount), currentPeriodEnd: sub.currentPeriodEnd } : null }, now);
  return a.state === "TRIAL";
}

/** A plan's own allowance, held down to the trial cap while the store is on trial. null means unlimited. */
export function withTrialCap(planLimit: number | null, trial: boolean, cap: number): number | null {
  return trial ? Math.min(planLimit ?? Infinity, cap) : planLimit;
}
