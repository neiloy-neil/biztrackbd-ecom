"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, replyToReview, setReviewPublished, setReviewsAutoPublish } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

async function run(tab: string, fn: (s: Awaited<ReturnType<typeof requireAction>>) => Promise<unknown>, done: string): Promise<never> {
  const s = await requireAction("marketing", "edit");
  try {
    await fn(s);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/reviews?tab=${tab}&err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/reviews");
  redirect(`/reviews?tab=${tab}&done=${done}`);
}

export const publishAction = async (id: string, tab: string): Promise<void> => run(tab, (s) => setReviewPublished(s.tenantId, s.actor, id, true), "published");
export const hideAction = async (id: string, tab: string): Promise<void> => run(tab, (s) => setReviewPublished(s.tenantId, s.actor, id, false), "hidden");
export async function replyAction(id: string, tab: string, form: FormData): Promise<void> {
  await run(tab, (s) => replyToReview(s.tenantId, s.actor, id, String(form.get("reply") ?? "")), "replied");
}
export async function autoPublishAction(tab: string, form: FormData): Promise<void> {
  await run(tab, (s) => setReviewsAutoPublish(s.tenantId, s.actor, form.get("on") === "on"), "saved");
}
