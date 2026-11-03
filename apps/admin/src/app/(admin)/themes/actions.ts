"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, activateTheme, submitThemePurchase } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface BuyState { error?: string }

/** Switches the store to a theme it can use: any free theme, or a premium one it owns. The core refuses anything else. */
export async function applyThemeAction(form: FormData): Promise<void> {
  const s = await requireAction("design", "edit");
  try {
    await activateTheme(s.tenantId, s.actor, form.get("themeId"));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/themes?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/themes");
  revalidatePath("/design");
  revalidatePath("/", "layout");
  redirect("/themes?applied=1");
}

/** The owner says they have sent the 49 taka. The platform checks the TrxID and then unlocks the theme for good. */
export async function buyThemeAction(_prev: BuyState, form: FormData): Promise<BuyState> {
  const s = await requireAction("billing", "edit", { allowReadOnly: true });
  try {
    await submitThemePurchase(s.tenantId, s.actor, {
      themeId: String(form.get("themeId") ?? ""), provider: String(form.get("provider") ?? ""),
      senderNumber: String(form.get("senderNumber") ?? ""), trxId: String(form.get("trxId") ?? ""),
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  revalidatePath("/themes");
  redirect("/themes?sent=1");
}
