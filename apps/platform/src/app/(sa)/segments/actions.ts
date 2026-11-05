"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, ValidationError, deleteSegment, saveSegment } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function saveSegmentAction(form: FormData): Promise<void> {
  const s = await requireAction("tenants", "edit");
  let id: string;
  try {
    let filter: unknown;
    try { filter = JSON.parse(String(form.get("filter") ?? "{}")); } catch { throw new ValidationError("The filter could not be read. Build it again."); }
    ({ id } = await saveSegment(s.actor, String(form.get("name") ?? ""), filter));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/segments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/segments");
  redirect(`/segments?run=${id}&saved=1`);
}

export async function deleteSegmentAction(id: string): Promise<void> {
  const s = await requireAction("tenants", "edit");
  await deleteSegment(s.actor, id);
  revalidatePath("/segments");
  redirect("/segments?deleted=1");
}
