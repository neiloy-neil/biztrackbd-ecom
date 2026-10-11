"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/** The look of the admin on this device: light, dark, or follow the device. Not a store setting, so no permission is needed. */
export async function setThemeAction(formData: FormData): Promise<void> {
  const v = String(formData.get("theme") ?? "");
  const jar = await cookies();
  if (v === "light" || v === "dark") jar.set("bt_theme", v, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  else jar.delete("bt_theme");
  revalidatePath("/", "layout");
}
