"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, activateTheme, applyTemplateToStore, isThemeId, platformOriginFor, quoteThemeCheckout, startThemeCheckout, submitThemePurchase, type ThemeQuoteView } from "@biztrackbd/core";
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
      themeId: String(form.get("themeId") ?? ""), bundleId: String(form.get("bundleId") ?? ""), code: String(form.get("code") ?? ""), provider: String(form.get("provider") ?? ""),
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
export async function payThemeOnlineAction(themeId: string, bundleId = "", code = ""): Promise<{ paymentUrl?: string; error?: string }> {
  const s = await requireAction("billing", "edit", { allowReadOnly: true });
  try {
    const h = await headers();
    const jar = await cookies();
    return await startThemeCheckout(s.tenantId, s.actor, themeId, {
      adminOrigin: resolveAdminOrigin(h, 3001),
      platformOrigin: platformOriginFor(process.env.NEXT_PUBLIC_ROOT_DOMAIN),
      fbp: jar.get("_fbp")?.value, fbc: jar.get("_fbc")?.value,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(), ua: h.get("user-agent") ?? undefined,
    }, { bundleId, code });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("payThemeOnlineAction error", e);
    return { error: "Could not start the online payment. Please try again or pay by bKash or Nagad." };
  }
}

/** What the theme or bundle costs with this code, worked out on the server, so the owner sees the real price before paying. */
export async function quoteThemeAction(themeId: string, bundleId: string, code: string): Promise<{ quote?: ThemeQuoteView; error?: string }> {
  const s = await requireAction("billing", "edit", { allowReadOnly: true });
  try {
    return { quote: await quoteThemeCheckout(s.tenantId, s.actor, { themeId, bundleId, code }) };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("quoteThemeAction error", e);
    return { error: "Could not check the code. Please try again." };
  }
}
