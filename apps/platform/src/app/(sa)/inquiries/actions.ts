"use server";

import { revalidatePath } from "next/cache";
import { updateInquiryStatus, type InquiryStatus } from "@biztrackbd/core";
import { getSession } from "@/lib/session";

export async function updateInquiryStatusAction(formData: FormData) {
  const s = await getSession();
  const id = formData.get("id") as string;
  const status = formData.get("status") as InquiryStatus;
  const notes = formData.get("notes") as string | undefined;

  if (!id || !status) return;

  await updateInquiryStatus(s.actor, id, status, notes ?? undefined);
  revalidatePath("/inquiries");
}
