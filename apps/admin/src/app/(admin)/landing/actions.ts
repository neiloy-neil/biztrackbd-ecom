"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, createLandingPage, deleteLandingLead, deleteLandingPage, setLandingLive, updateLandingOffers, updateLandingPage } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const back = (path: string, params: Record<string, string>): never => redirect(`${path}?${new URLSearchParams(params)}`);

export async function createLandingAction(f: FormData): Promise<void> {
  const s = await requireAction("design", "edit");
  let created: { id: string } | null = null;
  try {
    created = await createLandingPage(s.tenantId, s.actor, { title: String(f.get("title") ?? ""), slug: String(f.get("slug") ?? "") || undefined, productId: String(f.get("productId") ?? ""), templateId: String(f.get("templateId") ?? "") || undefined });
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
    await updateLandingPage(s.tenantId, s.actor, id, { title: String(f.get("title") ?? ""), productId: String(f.get("productId") ?? "") || undefined, pixelId: String(f.get("pixelId") ?? "") });
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

/** What the page sells: up to six offers (a product, pieces, a deal) and one optional extra item above the button. Empty rows are ignored. */
export async function saveLandingOffersAction(id: string, f: FormData): Promise<void> {
  const s = await requireAction("design", "edit");
  const get = (k: string) => String(f.get(k) ?? "").trim();
  const options: unknown[] = [];
  for (let i = 0; i < 6; i++) {
    const productId = get(`o${i}-product`);
    if (!productId) continue;
    const kind = get(`o${i}-deal`) || "none";
    const quantity = Number(get(`o${i}-qty`));
    options.push({
      id: `o${i + 1}`, label: get(`o${i}-label`) || `Offer ${i + 1}`, labelBn: get(`o${i}-labelBn`) || undefined, productId,
      quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : undefined,
      deal: { kind, value: kind === "none" ? 0 : Number(get(`o${i}-value`)) || 0 },
    });
  }
  const bumpVariant = get("bump-variant");
  const bump = bumpVariant ? { productId: get("bump-variant").split(":")[0], variantId: bumpVariant.split(":")[1] ?? "", label: get("bump-label") || "Add this", labelBn: get("bump-labelBn") || undefined, percentOff: Number(get("bump-off")) || 0 } : null;
  try {
    await updateLandingOffers(s.tenantId, s.actor, id, { options, bump });
  } catch (e) {
    if (e instanceof DomainError) back(`/landing/${id}`, { err: e.message });
    throw e;
  }
  revalidatePath(`/landing/${id}`);
  back(`/landing/${id}`, { done: "saved" });
}

export async function deleteLandingLeadAction(pageId: string, leadId: string): Promise<void> {
  const s = await requireAction("design", "edit");
  try {
    await deleteLandingLead(s.tenantId, s.actor, leadId);
  } catch (e) {
    if (e instanceof DomainError) back(`/landing/${pageId}`, { err: e.message });
    throw e;
  }
  revalidatePath(`/landing/${pageId}`);
  back(`/landing/${pageId}`, { done: "lead" });
}
