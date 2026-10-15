"use server";

import { applyWholesaleCustomer, type WholesaleRegistrationInput } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export type WholesaleRegisterResult =
  | { ok: true; status: "PENDING" | "APPROVED"; message: string }
  | { ok: false; error: string };

export async function submitWholesaleApplicationAction(
  input: WholesaleRegistrationInput
): Promise<WholesaleRegisterResult> {
  const store = await getStore();
  try {
    const result = await applyWholesaleCustomer(store.id, input);
    return {
      ok: true,
      status: result.status,
      message: result.message,
    };
  } catch (e: any) {
    console.error("submitWholesaleApplicationAction failed", e);
    return {
      ok: false,
      error: e.message || "Failed to submit wholesale application. Please check your details and try again.",
    };
  }
}
