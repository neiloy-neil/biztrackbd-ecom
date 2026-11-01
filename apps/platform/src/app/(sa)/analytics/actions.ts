"use server";

import { revalidatePath } from "next/cache";
import { purgeKnownNoiseErrors, updateErrorStatus } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function resolveErrorAction(formData: FormData) {
  await requireAction("tenants", "edit");
  const errorId = String(formData.get("errorId") || "");
  const status = formData.get("status") === "IGNORED" ? "IGNORED" : "RESOLVED";
  if (!errorId) return;

  await updateErrorStatus(errorId, status);
  revalidatePath("/analytics");
}

export async function purgeNoiseAction() {
  await requireAction("tenants", "edit");
  await purgeKnownNoiseErrors();
  revalidatePath("/analytics");
}
