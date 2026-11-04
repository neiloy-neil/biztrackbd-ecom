"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, saveThemeBundle, saveThemeDiscount, setThemeBundleActive, setThemeDiscountActive } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const back = (params: Record<string, string>): never => redirect(`/themes/offers?${new URLSearchParams(params)}`);

/** Makes a discount code, or changes the one whose id is in the form. */
export async function saveDiscountAction(form: FormData): Promise<void> {
  const s = await requireAction("plans", "edit");
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const id = get("id") || null;
  try {
    await saveThemeDiscount(s.actor, {
      code: get("code"), kind: get("kind"), value: get("value"), expiresAt: get("expiresAt"), maxUses: get("maxUses"),
      themeIds: form.getAll("themeIds").map(String), note: get("note"),
    }, id);
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/themes/offers");
  back({ done: `Code ${get("code").toUpperCase()} saved.` });
}

export async function setDiscountActiveAction(id: string, active: boolean): Promise<void> {
  const s = await requireAction("plans", "edit");
  try {
    await setThemeDiscountActive(s.actor, id, active);
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/themes/offers");
  back({ done: active ? "Code switched on." : "Code switched off. Stores can no longer use it." });
}

/** Makes a bundle, or changes the one with the same id. */
export async function saveBundleAction(form: FormData): Promise<void> {
  const s = await requireAction("plans", "edit");
  const get = (k: string) => String(form.get(k) ?? "").trim();
  try {
    await saveThemeBundle(s.actor, {
      id: get("id"), name: get("name"), blurb: get("blurb"), themeIds: form.getAll("themeIds").map(String),
      priceModel: get("priceModel") || "ONE_TIME", priceBdt: get("priceBdt"), active: form.get("active") === "on",
    });
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/themes/offers");
  back({ done: `Bundle ${get("name")} saved.` });
}

export async function setBundleActiveAction(id: string, active: boolean): Promise<void> {
  const s = await requireAction("plans", "edit");
  try {
    await setThemeBundleActive(s.actor, id, active);
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/themes/offers");
  back({ done: active ? "Bundle is on sale." : "Bundle hidden from stores." });
}
