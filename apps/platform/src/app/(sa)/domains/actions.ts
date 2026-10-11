"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, checkPlatformDomain } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function checkDomainAction(id: string): Promise<void> {
  const s = await requireAction("tenants", "view");
  try {
    await checkPlatformDomain(s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/domains?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/domains");
  redirect("/domains?done=checked");
}
