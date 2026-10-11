"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, blockPhone, unblockPhone } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const back = (qs: string) => redirect(`/fraud?tab=blocked${qs}`);

export async function blockNumberAction(form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await blockPhone(s.tenantId, s.actor, String(form.get("phone") ?? ""), String(form.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) back(`&err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/fraud");
  back("&done=blocked");
}

export async function unblockNumberAction(id: string): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await unblockPhone(s.tenantId, s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) back(`&err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/fraud");
  back("&done=unblocked");
}
