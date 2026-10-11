import { createHash, createHmac } from "node:crypto";
import type { TenantTx } from "@biztrackbd/db";

/**
 * Delivery trust (docs/12 section 1). The network keeps only hashes and outcomes: no names, addresses or store ids.
 * Everything here runs through two SECURITY DEFINER functions, because the app role cannot read the tables.
 */

export type TrustKind = "DELIVERED" | "RETURNED" | "REFUSED";
export type TrustLevel = "TRUSTED" | "MEDIUM" | "HIGH" | "NEW";

export interface TrustCounts {
  delivered30: number; delivered90: number; deliveredOld: number;
  failed30: number; failed90: number; failedOld: number;
  refused60: number;
  stores: number;
}

export interface TrustScore {
  level: TrustLevel;
  /** null for a number nobody has shipped to yet. */
  score: number | null;
  delivered: number;
  failed: number;
  refused: number;
  stores: number;
}

const EMPTY: TrustCounts = { delivered30: 0, delivered90: 0, deliveredOld: 0, failed30: 0, failed90: 0, failedOld: 0, refused60: 0, stores: 0 };

/** Weights from the doc: the last 30 days count fully, 31 to 90 days at 0.8, older at 0.5. */
const W30 = 1, W90 = 0.8, WOLD = 0.5;
const REFUSAL_PENALTY = 10;
/** One bad parcel is not enough to call a number High Risk; it needs a second outcome to back it up. */
const MIN_OUTCOMES_FOR_HIGH = 2;

/** Pure: counts in, score out. Weighted delivery ratio times 100, minus 10 per door refusal in the last 60 days. */
export function computeTrust(c: TrustCounts): TrustScore {
  const delivered = c.delivered30 + c.delivered90 + c.deliveredOld;
  const failed = c.failed30 + c.failed90 + c.failedOld;
  const base = { delivered, failed, refused: c.refused60, stores: c.stores };
  if (delivered + failed === 0) return { ...base, level: "NEW", score: null };
  const wd = c.delivered30 * W30 + c.delivered90 * W90 + c.deliveredOld * WOLD;
  const wf = c.failed30 * W30 + c.failed90 * W90 + c.failedOld * WOLD;
  const raw = (wd / (wd + wf)) * 100 - REFUSAL_PENALTY * c.refused60;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  let level: TrustLevel = score > 75 ? "TRUSTED" : score >= 50 ? "MEDIUM" : "HIGH";
  if (level === "HIGH" && delivered + failed < MIN_OUTCOMES_FOR_HIGH) level = "MEDIUM";
  return { ...base, level, score };
}

export const TRUST_LABELS: Record<TrustLevel, string> = { TRUSTED: "Trusted", MEDIUM: "Medium risk", HIGH: "High risk", NEW: "First-time buyer" };

const DEV_SALT = "dev-only-phone-trust-salt";

/**
 * The salt is platform-wide on purpose: every store must hash a number to the same value for the network to match it.
 * It is a secret, so a leaked table cannot be reversed by trying every Bangladeshi mobile number.
 */
function salt(): string {
  const s = process.env.PHONE_TRUST_SALT || process.env.CUSTOMER_AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("PHONE_TRUST_SALT is not set");
  return DEV_SALT;
}

export const phoneHash = (phone: string): string => createHmac("sha256", salt()).update(`phone:${phone}`).digest("hex");
const orderKey = (tenantId: string, orderId: string) => createHash("sha256").update(`order:${tenantId}:${orderId}`).digest("hex");
const storeKey = (tenantId: string) => createHash("sha256").update(`store:${tenantId}`).digest("hex");

export async function lookupTrust(tx: TenantTx, phone: string): Promise<TrustScore> {
  const rows = await tx.$queryRaw<TrustCounts[]>`
    SELECT delivered30, delivered90, "deliveredOld", failed30, failed90, "failedOld", refused60, stores FROM phone_trust_lookup(${phoneHash(phone)})`;
  return computeTrust(rows[0] ?? EMPTY);
}

/** Records (or corrects) what happened to one order's parcel. Safe to call twice: one outcome per order. */
export async function recordOutcome(tx: TenantTx, tenantId: string, orderId: string, phone: string, kind: TrustKind, at: Date = new Date()): Promise<void> {
  await tx.$executeRaw`SELECT phone_trust_record(${phoneHash(phone)}, ${orderKey(tenantId, orderId)}, ${storeKey(tenantId)}, ${kind}, ${at}::timestamptz)`;
}
