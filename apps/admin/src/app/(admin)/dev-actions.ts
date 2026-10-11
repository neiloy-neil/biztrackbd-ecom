"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DEV_USER_COOKIE } from "@/lib/session";

/** Development only. Does nothing unless DEV_AUTH=1 outside production. */
export async function switchDevUser(form: FormData): Promise<void> {
  if (process.env.DEV_AUTH !== "1" || process.env.NODE_ENV === "production") return;
  (await cookies()).set(DEV_USER_COOKIE, String(form.get("email") ?? ""), { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
