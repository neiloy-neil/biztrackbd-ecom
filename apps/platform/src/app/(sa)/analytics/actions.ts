"use server";

import { revalidatePath } from "next/cache";
import { updateErrorStatus } from "@biztrackbd/core";

export async function resolveErrorAction(formData: FormData) {
  const errorId = String(formData.get("errorId") || "");
  const status = formData.get("status") === "IGNORED" ? "IGNORED" : "RESOLVED";
  if (!errorId) return;

  await updateErrorStatus(errorId, status);
  revalidatePath("/analytics");
}
