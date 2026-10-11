"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, createLandingPage, deleteLandingPage, setLandingLive, updateLandingPage } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const back = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);

export async function createLandingAction(f: FormData): Promise<void> {
  const s = await requireAction("design", "edit");
  let created: { id: string } | null = null;
  try {
    created = await createLandingPage(s.tenantId, s.actor, { title: String(f.get("title") ?? ""), slug: String(f.get("slug") ?? "") || undefined, productId: String(f.get("productId") ?? "") });
  } catch (e) {
    if (e instanceof DomainError) back("/landing", { err: e.message });
    throw e;
  }
  revalidatePath("/landing");
  redirect(`/landing/${created!.id}`);
}

export async function saveLandingMetaAction(id: string, f: FormData): Promise<void> {
  const s = await requireAction("design", "edit");
  try {
    await updateLandingPage(s.tenantId, s.actor, id, { title: String(f.get("title") ?? ""), productId: String(f.get("productId") ?? ""), pixelId: String(f.get("pixelId") ?? "") });
  } catch (e) {
    if (e instanceof DomainError) back(`/landing/${id}`, { err: e.message });
    throw e;
  }
  revalidatePath(`/landing/${id}`);
  back(`/landing/${id}`, { done: "saved" });
}

export async function setLandingLiveAction(id: string, live: boolean): Promise<void> {
  const s = await requireAction("design", "edit");
  try {
    await setLandingLive(s.tenantId, s.actor, id, live);
  } catch (e) {
    if (e instanceof DomainError) back(`/landing/${id}`, { err: e.message });
    throw e;
  }
  revalidatePath("/landing");
  back(`/landing/${id}`, { done: live ? "live" : "offline" });
}

export async function deleteLandingAction(id: string): Promise<void> {
  const s = await requireAction("design", "edit");
  await deleteLandingPage(s.tenantId, s.actor, id);
  revalidatePath("/landing");
  back("/landing", { done: "deleted" });
}
