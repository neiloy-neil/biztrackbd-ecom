"use server";

import { revalidatePath } from "next/cache";
import {
  lookupPhone,
  bookCourier,
  holdOrder,
  releaseHold,
  DomainError,
  type PhoneLookup,
} from "@biztrackbd/core";
import { requireAction, requireAccess } from "@/lib/session";

/**
 * Manual Phone Fraud Lookup Action
 * Queries the unified 5-courier engine (Steadfast, Pathao, RedX, CarryBee, Paperfly)
 * and returns full delivery track record and risk classification.
 */
export async function manualPhoneFraudLookupAction(phoneInput: string): Promise<{
  success: boolean;
  lookup?: PhoneLookup;
  error?: string;
}> {
  const s = await requireAccess("orders");
  try {
    const res = await lookupPhone(s.tenantId, s.actor, phoneInput);
    return { success: true, lookup: res };
  } catch (e: any) {
    return {
      success: false,
      error: e.message || "Failed to check courier fraud record",
    };
  }
}

/**
 * 1-Click Bulk Courier Booking Action
 * Books consignments for multiple orders in a single batch, assigning tracking codes.
 */
export async function bulkBookCourierOrdersAction(
  orderIds: string[],
  provider: string,
  weightKg: number = 0.5
): Promise<{
  success: boolean;
  bookedCount: number;
  results: { orderId: string; orderNumber: string; trackingCode?: string; error?: string }[];
}> {
  const s = await requireAction("orders", "edit");
  const weightGrams = Math.round((weightKg > 0 ? weightKg : 0.5) * 1000);
  const results: { orderId: string; orderNumber: string; trackingCode?: string; error?: string }[] = [];
  let bookedCount = 0;

  for (const id of orderIds) {
    try {
      const res = await bookCourier(s.tenantId, s.actor, id, {
        provider,
        weightGrams,
      });
      bookedCount++;
      results.push({
        orderId: id,
        orderNumber: id,
        trackingCode: res.trackingCode,
      });
    } catch (e: any) {
      results.push({
        orderId: id,
        orderNumber: id,
        error: e.message || "Booking failed",
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/orders");
  revalidatePath("/orders/ship");

  return {
    success: true,
    bookedCount,
    results,
  };
}

/**
 * Flags an order as HELD for review from the Dashboard Fraud Radar
 */
export async function holdDashboardOrderAction(orderId: string, note?: string) {
  const s = await requireAction("orders", "edit");
  await holdOrder(s.tenantId, s.actor, orderId, note || "Held via Live Fraud Radar on Dashboard");
  revalidatePath("/");
  revalidatePath("/orders");
  return { success: true };
}

/**
 * Releases a hold on an order and approves it for fulfillment
 */
export async function releaseDashboardOrderHoldAction(orderId: string, note?: string) {
  const s = await requireAction("orders", "edit");
  await releaseHold(s.tenantId, s.actor, orderId, note || "Approved via Live Fraud Radar on Dashboard");
  revalidatePath("/");
  revalidatePath("/orders");
  return { success: true };
}
