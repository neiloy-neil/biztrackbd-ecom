"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE } from "@/lib/i18n";

/** The language of the admin on this device. Not a store setting, so no permission is needed. */
export async function setLangAction(formData: FormData): Promise<void> {
  const v = String(formData.get("lang") ?? "");
  (await cookies()).set(LANG_COOKIE, v === "bn" ? "bn" : "en", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
}
