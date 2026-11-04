"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, approveModulePurchase, approveSmsPurchase, approveSubscriptionPayment, approveThemePurchase, rejectModulePurchase, rejectSmsPurchase, rejectSubscriptionPayment, rejectThemePurchase } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function approveAction(id: string): Promise<void> {
  const s = await requireAction("payments", "edit");
  try {
    await approveSubscriptionPayment(s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/payments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/payments");
  redirect("/payments?done=approved");
}

export async function rejectAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("payments", "edit");
  try {
    await rejectSubscriptionPayment(s.actor, id, String(form.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/payments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/payments");
  redirect("/payments?done=rejected");
}

export async function approveThemeAction(id: string): Promise<void> {
  const s = await requireAction("payments", "edit");
  try {
    await approveThemePurchase(s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/payments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/payments");
  redirect("/payments?done=theme-approved");
}

export async function rejectThemeAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("payments", "edit");
  try {
    await rejectThemePurchase(s.actor, id, String(form.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/payments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/payments");
  redirect("/payments?done=theme-rejected");
}

export async function approveModuleAction(id: string): Promise<void> {
  const s = await requireAction("payments", "edit");
  try {
    await approveModulePurchase(s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/payments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/payments");
  redirect("/payments?done=module-approved");
}

export async function rejectModuleAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("payments", "edit");
  try {
    await rejectModulePurchase(s.actor, id, String(form.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/payments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/payments");
  redirect("/payments?done=module-rejected");
}

export async function approveSmsAction(id: string): Promise<void> {
  const s = await requireAction("payments", "edit");
  try {
    await approveSmsPurchase(s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/payments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/payments");
  redirect("/payments?done=sms-approved");
}

export async function rejectSmsAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("payments", "edit");
  try {
    await rejectSmsPurchase(s.actor, id, String(form.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/payments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/payments");
  redirect("/payments?done=sms-rejected");
}
