import { money } from "./pricing";

/**
 * Advance payment before a cash-on-delivery order is accepted.
 *
 * The store sets one rule (settings). At checkout, when the customer picks cash on delivery and the order total reaches the rule's
 * minimum, the customer pays the advance first (bKash/Nagad with a TrxID, or the online gateway). The rest stays on the order and the
 * courier collects it on delivery. Paying by bKash, Nagad or the gateway for the whole order already is a full prepayment, so the rule
 * never applies to it.
 */
export type AdvanceMode = "OFF" | "FIXED" | "PERCENT" | "FULL";
export type AdvancePayVia = "MANUAL" | "GATEWAY" | "BOTH";
export type AdvanceMethod = "MANUAL_BKASH" | "MANUAL_NAGAD" | "GATEWAY_UDDOKTAPAY";

export const ADVANCE_MODES: readonly AdvanceMode[] = ["OFF", "FIXED", "PERCENT", "FULL"];
export const ADVANCE_PAY_VIA: readonly AdvancePayVia[] = ["MANUAL", "GATEWAY", "BOTH"];
export const ADVANCE_METHODS: readonly AdvanceMethod[] = ["MANUAL_BKASH", "MANUAL_NAGAD", "GATEWAY_UDDOKTAPAY"];
export const ADVANCE_DEFAULT_WINDOW_HOURS = 24;
export const ADVANCE_MAX_WINDOW_HOURS = 24 * 14;

export interface AdvanceRule {
  mode: AdvanceMode;
  /** Taka for FIXED, percent of the total for PERCENT. Unused for OFF and FULL. */
  value: number;
  /** The rule applies only to orders at or above this total. */
  minOrder: number;
  payVia: AdvancePayVia;
  windowHours: number;
}

/** The store settings columns the rule reads. */
export interface AdvanceSettingsRow {
  advanceMode?: string | null;
  advanceValue?: unknown;
  advanceMinOrder?: unknown;
  advancePayVia?: string | null;
  advanceWindowHours?: number | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function advanceRuleFrom(s: AdvanceSettingsRow | null | undefined): AdvanceRule {
  const mode = ADVANCE_MODES.includes(s?.advanceMode as AdvanceMode) ? (s!.advanceMode as AdvanceMode) : "OFF";
  const payVia = ADVANCE_PAY_VIA.includes(s?.advancePayVia as AdvancePayVia) ? (s!.advancePayVia as AdvancePayVia) : "MANUAL";
  const hours = Math.round(num(s?.advanceWindowHours));
  return {
    mode,
    value: Math.max(0, num(s?.advanceValue)),
    minOrder: Math.max(0, num(s?.advanceMinOrder)),
    payVia,
    windowHours: hours >= 1 ? Math.min(hours, ADVANCE_MAX_WINDOW_HOURS) : ADVANCE_DEFAULT_WINDOW_HOURS,
  };
}

/** True when the rule asks the customer to pay the whole total up front (cash on delivery fee is then not charged). */
export function isFullPrepayment(rule: AdvanceRule, totalBeforeCodFee: number): boolean {
  return rule.mode === "FULL" && totalBeforeCodFee >= rule.minOrder && totalBeforeCodFee > 0;
}

/**
 * The advance for an order total, in taka. 0 means none is needed. Never more than the total; a rule that works out to the whole total
 * is a full prepayment. Amounts under 1 taka are ignored so a 0.4 advance cannot block an order.
 */
export function computeAdvance(rule: AdvanceRule, total: number): number {
  if (rule.mode === "OFF" || !(total > 0) || total < rule.minOrder) return 0;
  let amount = 0;
  if (rule.mode === "FULL") amount = total;
  else if (rule.mode === "FIXED") amount = rule.value;
  else if (rule.mode === "PERCENT") amount = (total * Math.min(rule.value, 100)) / 100;
  amount = money(Math.min(amount, total));
  return amount >= 1 ? amount : 0;
}

export interface AdvanceChannels {
  bkashReady: boolean;
  nagadReady: boolean;
  /** The store has its own UddoktaPay keys. */
  gatewayReady: boolean;
}

/** The ways this store lets a customer pay the advance, in the order they are shown. */
export function advanceMethodsAvailable(rule: AdvanceRule, c: AdvanceChannels): AdvanceMethod[] {
  const out: AdvanceMethod[] = [];
  if (rule.payVia !== "GATEWAY") {
    if (c.bkashReady) out.push("MANUAL_BKASH");
    if (c.nagadReady) out.push("MANUAL_NAGAD");
  }
  if (rule.payVia !== "MANUAL" && c.gatewayReady) out.push("GATEWAY_UDDOKTAPAY");
  return out;
}

/** An order that still owes its advance: the rule asked for one and it has not been confirmed as received. */
export function awaitingAdvance(o: { advanceRequiredAmount: unknown; advancePaidAmount: unknown; status: string }): boolean {
  return num(o.advanceRequiredAmount) > 0 && num(o.advancePaidAmount) + 0.005 < num(o.advanceRequiredAmount) && o.status !== "CANCELLED";
}
