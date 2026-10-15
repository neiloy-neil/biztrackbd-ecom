"use server";

import { revalidatePath } from "next/cache";
import { requestAffiliatePayout, DomainError } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export interface PayoutActionState {
  ok: boolean;
  message?: string;
  error?: string;
}

export async function submitPartnerPayoutAction(
  token: string,
  _prev: PayoutActionState,
  formData: FormData
): Promise<PayoutActionState> {
  try {
    const store = await getStore();
    const amountStr = formData.get("amount") as string;
    const method = formData.get("method") as "BKASH" | "NAGAD" | "ROCKET" | "BANK";
    const accountNumber = (formData.get("accountNumber") as string)?.trim();
    const bankDetails = (formData.get("bankDetails") as string)?.trim();

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { ok: false, error: "Please enter a valid payout amount." };
    }

    if (!accountNumber) {
      return { ok: false, error: "Please enter your wallet or account number." };
    }

    if (!["BKASH", "NAGAD", "ROCKET", "BANK"].includes(method)) {
      return { ok: false, error: "Please select a supported payment method." };
    }

    await requestAffiliatePayout(store.id, token, {
      amount,
      method,
      accountNumber,
      bankDetails,
    });

    revalidatePath(`/partner/${token}`);
    return { ok: true, message: `Payout request of ৳${amount.toLocaleString()} submitted successfully.` };
  } catch (err: unknown) {
    if (err instanceof DomainError) {
      return { ok: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to submit payout request.";
    return { ok: false, error: message };
  }
}
