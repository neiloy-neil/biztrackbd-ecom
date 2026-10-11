"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, setModule } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function setModuleAction(key: string, enabled: boolean): Promise<void> {
  const s = await requireAction("billing", "edit");
  try {
    await setModule(s.tenantId, s.actor, key, enabled);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/settings/apps?${new URLSearchParams({ err: e.message })}`);
    throw e;
  }
  revalidatePath("/", "layout");
  redirect("/settings/apps?done=saved");
}
