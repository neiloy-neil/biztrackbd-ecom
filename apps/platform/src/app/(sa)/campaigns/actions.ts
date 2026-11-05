"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError, createMerchantCampaign, deleteMerchantCampaign, editMerchantCampaign, sendMerchantCampaign, sendMerchantCampaignTest, setAutomation,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

type Actor = Awaited<ReturnType<typeof requireAction>>["actor"];

/** Runs one step, then returns to the page with a message. A refused step comes back as a red message, not an error page. */
async function step(path: string, fn: (a: Actor) => Promise<unknown>, done: string): Promise<never> {
  const s = await requireAction("tenants", "edit");
  try {
    await fn(s.actor);
  } catch (e) {
    if (e instanceof DomainError) redirect(`${path}?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/campaigns");
  redirect(`${path}?done=${done}`);
}

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function createCampaignAction(form: FormData): Promise<void> {
  const s = await requireAction("tenants", "edit");
  let id: string;
  try {
    ({ id } = await createMerchantCampaign(s.actor, { name: text(form, "name"), channel: text(form, "channel"), segmentId: text(form, "segmentId") || null, subject: text(form, "subject") || null, body: text(form, "body") }));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/campaigns?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/campaigns");
  redirect(`/campaigns/${id}?done=created`);
}

export async function editCampaignAction(id: string, form: FormData): Promise<void> {
  await step(`/campaigns/${id}`, (a) => editMerchantCampaign(a, id, { subject: text(form, "subject") || null, body: text(form, "body") }), "edited");
}

export async function testCampaignAction(id: string, form: FormData): Promise<void> {
  await step(`/campaigns/${id}`, (a) => sendMerchantCampaignTest(a, id, text(form, "to")), "tested");
}

export async function sendCampaignAction(id: string, form: FormData): Promise<void> {
  const raw = text(form, "confirmCount").trim();
  await step(`/campaigns/${id}`, (a) => sendMerchantCampaign(a, id, { confirmCount: raw === "" ? undefined : Number(raw) }), "sent");
}

export async function deleteCampaignAction(id: string): Promise<void> {
  const s = await requireAction("tenants", "edit");
  try {
    await deleteMerchantCampaign(s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/campaigns/${id}?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/campaigns");
  redirect("/campaigns?done=deleted");
}

export async function toggleAutomationAction(key: string, enabled: boolean): Promise<void> {
  await step("/campaigns", (a) => setAutomation(a, key, enabled), enabled ? "automation-on" : "automation-off");
}
