"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { processPendingNotificationJobs } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function sweepPlatformOutboxAction(): Promise<void> {
  await requireAction("settings", "edit");
  const result = await processPendingNotificationJobs({ limit: 50 });
  revalidatePath("/diagnostics/tracking");
  redirect(
    `/diagnostics/tracking?done=swept&processed=${result.processed}&succeeded=${result.succeeded}&failed=${result.failed}`
  );
}
