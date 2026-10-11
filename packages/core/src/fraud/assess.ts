import type { TenantTx } from "@biztrackbd/db";
import { lookupTrust, type TrustScore } from "./trust";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export const FLAG_LABELS: Record<string, string> = {
  FIRST_TIME_BUYER: "First-time buyer",
  LOW_DELIVERY_SUCCESS: "Low delivery success across stores",
  HIGH_VALUE_COD_NEW_NUMBER: "High-value cash on delivery from a new number",
  ADDRESS_INCOMPLETE: "Address looks incomplete",
  PHONE_MULTIPLE_ADDRESSES: "Same number used for different districts",
};

/** Cash on delivery above this, from a number nobody has delivered to, is flagged (docs/07 section 5). */
export const HIGH_VALUE_COD = 5000;
/** Points taken off the score for each risk flag. Informational flags cost nothing. */
const FLAG_PENALTY = 10;
const INFO_FLAGS = new Set(["FIRST_TIME_BUYER"]);

export interface RiskInput {
  phone: string;
  paymentMethod: string;
  total: number;
  address: string;
  district: string;
  /** Orders keyed in by staff were already confirmed by phone, so they are scored but never held. */
  customerFacing: boolean;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  flags: string[];
  /** Waits for the owner before a courier can be booked. */
  hold: boolean;
  trust: TrustScore;
}

/** A house, road or landmark usually has a number or several words. "Dhaka" alone is not an address. */
export function addressLooksIncomplete(address: string): boolean {
  const a = address.trim();
  if (a.length < 10) return true;
  return !/\d/.test(a) && a.split(/\s+/).length < 3;
}

/** Scores a new order. Runs inside the order's own transaction, so the score always matches the order that was saved. */
export async function assessOrderRisk(tx: TenantTx, input: RiskInput): Promise<RiskAssessment> {
  const trust = await lookupTrust(tx, input.phone);
  const flags: string[] = [];
  const isCod = input.paymentMethod === "COD";

  if (trust.level === "NEW") flags.push("FIRST_TIME_BUYER");
  if (trust.level === "MEDIUM" || trust.level === "HIGH") flags.push("LOW_DELIVERY_SUCCESS");
  if (isCod && input.total > HIGH_VALUE_COD && trust.delivered === 0) flags.push("HIGH_VALUE_COD_NEW_NUMBER");
  if (addressLooksIncomplete(input.address)) flags.push("ADDRESS_INCOMPLETE");

  const since = new Date(Date.now() - 30 * 86_400_000);
  const elsewhere = await tx.order.count({
    where: { customerPhone: input.phone, status: { not: "CANCELLED" }, createdAt: { gt: since }, shippingDistrict: { not: input.district } },
  });
  if (elsewhere > 0) flags.push("PHONE_MULTIPLE_ADDRESSES");

  // A number with no history starts at 85 (the doc's "normal processing"); a known number starts at its network score.
  const base = trust.score ?? 85;
  // The network score already explains LOW_DELIVERY_SUCCESS, so that flag does not cost points twice.
  const extra = flags.filter((f) => !INFO_FLAGS.has(f) && f !== "LOW_DELIVERY_SUCCESS").length;
  const score = Math.max(0, Math.min(100, base - FLAG_PENALTY * extra));
  let level: RiskLevel = score > 75 ? "LOW" : score >= 50 ? "MEDIUM" : "HIGH";
  // One failed parcel alone never reaches High (see computeTrust); the same rule holds after flag penalties.
  if (level === "HIGH" && trust.level !== "HIGH" && trust.delivered + trust.failed < 2) level = "MEDIUM";
  return { level, score, flags, hold: level === "HIGH" && isCod && input.customerFacing, trust };
}
