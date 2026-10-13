"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, createCustomPage, deleteCustomPage, setCustomPageLive, updateCustomPage } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const back = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);

export async function createPageAction(f: FormData): Promise<void> {
  const s = await requireAction("design", "edit");
  let created: { id: string } | null = null;
  try {
    created = await createCustomPage(s.tenantId, s.actor, { title: String(f.get("title") ?? ""), slug: String(f.get("slug") ?? "") || undefined, templateId: String(f.get("templateId") ?? "") || undefined });
  } catch (e) {
    if (e instanceof DomainError) back("/pages", { err: e.message });
    throw e;
  }
  revalidatePath("/pages");
  redirect(`/pages/${created!.id}`);
}

export async function savePageMetaAction(id: string, f: FormData): Promise<void> {
  const s = await requireAction("design", "edit");
  try {
    await updateCustomPage(s.tenantId, s.actor, id, { title: String(f.get("title") ?? ""), seoTitle: String(f.get("seoTitle") ?? ""), seoDescription: String(f.get("seoDescription") ?? "") });
  } catch (e) {
    if (e instanceof DomainError) back(`/pages/${id}`, { err: e.message });
    throw e;
  }
  revalidatePath(`/pages/${id}`);
  back(`/pages/${id}`, { done: "saved" });
}

export async function setPageLiveAction(id: string, live: boolean): Promise<void> {
  const s = await requireAction("design", "edit");
  try {
    await setCustomPageLive(s.tenantId, s.actor, id, live);
  } catch (e) {
    if (e instanceof DomainError) back(`/pages/${id}`, { err: e.message });
    throw e;
  }
  revalidatePath("/pages");
  back(`/pages/${id}`, { done: live ? "live" : "offline" });
}

export async function deletePageAction(id: string): Promise<void> {
  const s = await requireAction("design", "edit");
  await deleteCustomPage(s.tenantId, s.actor, id);
  revalidatePath("/pages");
  back("/pages", { done: "deleted" });
}
