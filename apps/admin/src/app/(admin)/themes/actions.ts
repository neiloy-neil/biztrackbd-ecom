"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, activateTheme, applyTemplateToStore, isThemeId, platformOriginFor, startThemeCheckout, submitThemePurchase } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";
import { resolveAdminOrigin } from "@/lib/origin";

export interface BuyState { error?: string }

/** Switches the store to a theme it can use: any free theme, or a premium one it owns. The core refuses anything else. */
export async function applyThemeAction(form: FormData): Promise<void> {
  const s = await requireAction("design", "edit");
  try {
    const themeId = String(form.get("themeId") ?? "");
    // A built-in look switches at once. An uploaded theme is a template: it brings its pages and style, and goes live straight away because the owner chose it here.
    if (isThemeId(themeId)) await activateTheme(s.tenantId, s.actor, themeId);
    else await applyTemplateToStore(s.tenantId, s.actor, themeId, [], true, "publish");
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

/** Pay online with UddoktaPay (bKash, Nagad, Rocket, cards). The theme unlocks as soon as the gateway confirms, with nothing to check by hand. */
export async function payThemeOnlineAction(themeId: string): Promise<{ paymentUrl?: string; error?: string }> {
  const s = await requireAction("billing", "edit", { allowReadOnly: true });
  try {
    const h = await headers();
    const jar = await cookies();
    return await startThemeCheckout(s.tenantId, s.actor, themeId, {
      adminOrigin: resolveAdminOrigin(h, 3001),
      platformOrigin: platformOriginFor(process.env.NEXT_PUBLIC_ROOT_DOMAIN),
      fbp: jar.get("_fbp")?.value, fbc: jar.get("_fbc")?.value,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(), ua: h.get("user-agent") ?? undefined,
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("payThemeOnlineAction error", e);
    return { error: "Could not start the online payment. Please try again or pay by bKash or Nagad." };
  }
}
