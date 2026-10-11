"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DomainError, RateLimitError, SESSION_TTL_SECONDS, getStoreInfo, requestOtp, signCustomerSession, verifyOtp } from "@biztrackbd/core";
import { clientIp } from "@/lib/ip";
import { SESSION_COOKIE } from "@/lib/session";
import { getStore } from "@/lib/tenant";

export type StepResult = { ok: true } | { ok: false; error: string; retryAfterSeconds?: number };

const GENERIC = "Something went wrong. Please try again.";

export async function requestCodeAction(phone: string): Promise<StepResult> {
  const store = await getStore();
  try {
    const info = await getStoreInfo(store.id);
    await requestOtp(store.id, phone, { ip: await clientIp(), storeName: info.storeName });
    return { ok: true };
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message, retryAfterSeconds: e.retryAfterSeconds };
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("requestCodeAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: GENERIC };
  }
}

export async function verifyCodeAction(phone: string, code: string): Promise<StepResult> {
  const store = await getStore();
  try {
    const who = await verifyOtp(store.id, phone, code);
    (await cookies()).set(SESSION_COOKIE, signCustomerSession({ tenantId: store.id, customerId: who.customerId }), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_SECONDS,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("verifyCodeAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: GENERIC };
  }
}
