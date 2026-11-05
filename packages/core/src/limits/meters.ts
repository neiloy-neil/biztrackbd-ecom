import { withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import { PLAN_AI_QUOTAS, getDhakaMonthStr } from "../ai/gateway";
import { getSmsBalance } from "../messaging/sms-credits";
import { TRIAL_CAPS, isOnTrial, withTrialCap } from "../platform/trial";
import { getEffectivePlan, productState, readUsage, type UsageState } from "./plan";

/**
 * Everything a store is metered on, in one list for the usage screen and the near-the-limit banner: products, orders, staff,
 * photo storage, SMS and AI drafts. Each row says how much is used, what the plan allows, and where to go when it runs short.
 */

export type MeterKey = "products" | "orders" | "staff" | "storage" | "sms" | "ai";

export interface UsageMeterRow {
  key: MeterKey;
  label: string;
  used: number;
  /** null means no limit. */
  limit: number | null;
  /** Shown after the numbers, for example "MB". */
  unit: string | null;
  percent: number | null;
  state: UsageState;
  /** A sentence when the store is close to or at the limit, else null. */
  note: string | null;
  /** Where to fix it. */
  action: { label: string; href: string } | null;
  /** The note is about to bite: close to the limit, or past it. */
  needsAttention: boolean;
}

export interface UsageMeters {
  tier: string;
  onTrial: boolean;
  rows: UsageMeterRow[];
  /** Rows that are close to or at their limit, worst first. */
  attention: UsageMeterRow[];
}

const GB = 1024 ** 3;
const MB = 1024 ** 2;

/** Used against limit, with the same 80 percent warning line the product and order meters use. */
export function meterState(used: number, limit: number | null): UsageState {
  return productState(used, limit);
}

const pct = (used: number, limit: number | null): number | null => (limit ? Math.floor((used / limit) * 100) : null);
const ORDER_RANK: Record<UsageState, number> = { exceeded: 5, at_limit: 4, over: 3, warning: 2, ok: 1, unlimited: 0 };

export async function getUsageMeters(tenantId: string, actor: StaffActor, now: Date = new Date()): Promise<UsageMeters> {
  assertCan(actor, "billing", "view");
  const base = await withTenant(tenantId, async (tx) => {
    const plan = await getEffectivePlan(tx);
    const usage = await readUsage(tx, now);
    const t = await tx.tenant.findFirstOrThrow({ select: { storageBytesUsed: true, planTier: true } });
    const staff = await tx.tenantUser.count({ where: { isActive: true } });
    const ai = await tx.tenantAiUsage.findUnique({ where: { tenantId_periodMonth: { tenantId, periodMonth: getDhakaMonthStr() } }, select: { generationCount: true } });
    const trial = await isOnTrial(tx, now);
    return { plan, usage, storageBytes: Number(t.storageBytesUsed), staff, ai: ai?.generationCount ?? 0, trial, tier: t.planTier };
  });
  const sms = await getSmsBalance(tenantId, actor, now);

  const rows: UsageMeterRow[] = [];
  const add = (r: Omit<UsageMeterRow, "percent" | "needsAttention"> & { percent?: number | null }) =>
    rows.push({ ...r, percent: r.percent !== undefined ? r.percent : pct(r.used, r.limit), needsAttention: r.state === "warning" || r.state === "at_limit" || r.state === "over" || r.state === "exceeded" });

  const p = base.usage.products;
  add({ key: "products", label: "Products", used: p.used, limit: p.limit, unit: null, state: p.state, note: p.state === "at_limit" ? `You have reached your plan's ${p.limit} products. Upgrade to add more.` : p.state === "warning" ? `You have used ${p.percent}% of your product limit.` : null, action: p.state === "warning" || p.state === "at_limit" ? { label: "Upgrade plan", href: "/billing" } : null });

  const o = base.usage.orders;
  add({ key: "orders", label: "Orders this month", used: o.used, limit: o.limit, unit: null, state: o.state,
    note: o.state === "warning" ? `You have used ${o.percent}% of this month's orders. Customers can keep ordering.` : o.state === "over" ? "You are over this month's order limit. Customers can keep ordering, but upgrade soon." : o.state === "exceeded" ? `You are well over this month's limit (grace ends at ${o.graceLimit}). Orders still go through. Upgrade to stay on plan.` : null,
    action: o.state === "ok" || o.state === "unlimited" ? null : { label: "Upgrade plan", href: "/billing" } });

  const staffState = meterState(base.staff, base.plan.staff);
  add({ key: "staff", label: "Staff accounts", used: base.staff, limit: base.plan.staff, unit: null, state: staffState, note: staffState === "at_limit" ? `All ${base.plan.staff} staff places are used. Upgrade to invite more people.` : staffState === "warning" ? "You are close to your staff limit." : null, action: staffState === "warning" || staffState === "at_limit" ? { label: "Upgrade plan", href: "/billing" } : null });

  const storageLimit = base.plan.storageGb === null ? null : Math.round((base.plan.storageGb * GB) / MB);
  const storageUsed = Math.round(base.storageBytes / MB);
  const storageState = meterState(base.storageBytes, base.plan.storageGb === null ? null : base.plan.storageGb * GB);
  add({ key: "storage", label: "Photo storage", used: storageUsed, limit: storageLimit, unit: "MB", state: storageState, percent: pct(base.storageBytes, base.plan.storageGb === null ? null : base.plan.storageGb * GB), note: storageState === "at_limit" ? "Your photo storage is full. New photos cannot be added until you upgrade." : storageState === "warning" ? "Your photo storage is nearly full." : null, action: storageState === "warning" || storageState === "at_limit" ? { label: "Upgrade plan", href: "/billing" } : null });

  // SMS: out of free SMS is fine while there are bought ones left; a problem only when both are gone.
  const smsLimit = sms.monthlyLimit;
  let smsState: UsageState = meterState(sms.monthlyUsed, smsLimit);
  if ((smsState === "at_limit" || smsState === "warning") && !sms.onTrial && sms.prepaid > 0) smsState = "ok";
  if (smsLimit !== null && sms.totalLeft === 0) smsState = "at_limit";
  add({ key: "sms", label: sms.onTrial ? "SMS on your free trial" : "Free SMS this month", used: sms.monthlyUsed, limit: smsLimit, unit: null, state: smsState,
    note: smsState === "at_limit" ? (sms.onTrial ? `You have used all ${smsLimit} trial SMS. Customer messages stop until you pay for a plan.` : "You are out of SMS, so customer messages are not being sent. Buy more SMS.") : smsState === "warning" ? "You are close to your free SMS for this month." : null,
    action: smsState === "at_limit" || smsState === "warning" ? (sms.onTrial ? { label: "Choose a plan", href: "/billing" } : { label: "Buy SMS", href: "/settings/notifications" }) : null });

  const aiQuota = withTrialCap(PLAN_AI_QUOTAS[base.tier] ?? PLAN_AI_QUOTAS.STARTER ?? 50, base.trial, TRIAL_CAPS.aiGenerations);
  const aiState = meterState(base.ai, aiQuota);
  add({ key: "ai", label: "AI drafts this month", used: base.ai, limit: aiQuota, unit: null, state: aiState, note: aiState === "at_limit" ? "You have used all your AI drafts this month. Add your own free Gemini key to keep going." : aiState === "warning" ? "You are close to this month's AI drafts." : null, action: aiState === "warning" || aiState === "at_limit" ? { label: "AI settings", href: "/settings/apps?open=ai_suite" } : null });

  const attention = rows.filter((r) => r.needsAttention).sort((a, b) => ORDER_RANK[b.state] - ORDER_RANK[a.state]);
  return { tier: base.tier, onTrial: base.trial, rows, attention };
}
