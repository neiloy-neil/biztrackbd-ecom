"use server";

import { revalidatePath } from "next/cache";
import { customerRequestReturn } from "@biztrackbd/core";
import { getCustomerSession } from "@/lib/session";
import { getStore } from "@/lib/tenant";

export interface SubmitReturnResponse {
  ok: boolean;
  code?: string;
  error?: string;
}

export async function submitCustomerReturnAction(
  orderId: string,
  rawInput: unknown,
  token?: string,
): Promise<SubmitReturnResponse> {
  try {
    const store = await getStore();
    const session = await getCustomerSession(store.id);
    const res = await customerRequestReturn(
      store.id,
      rawInput,
      { customerId: session?.customerId, token: token ?? null },
    );
    revalidatePath(`/order/${orderId}`);
    return { ok: true, code: res.code };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not submit return request";
    return { ok: false, error: message };
  }
}
