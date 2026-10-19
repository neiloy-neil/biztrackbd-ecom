"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError,
  TEMPLATE_CATEGORIES,
  listTenants,
  publishTemplateFromStore,
  importTemplateBundle,
  MAX_TEMPLATE_BUNDLE_BYTES,
  setTemplateStatus,
  toggleGlobalModuleMaintenance,
  setModulePlanOverride,
  type TemplateStatus,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const back = (params: Record<string, string>): never => redirect(`/themes?${new URLSearchParams(params)}`);

/** Publishes a workshop store's live design as a template (or a new version of one). */
export async function publishTemplateAction(form: FormData): Promise<void> {
  const s = await requireAction("plans", "edit");
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const address = get("store").toLowerCase().replace(/\.[a-z0-9.-]+$/, "");
  let tenantId = "";
  try {
    const found = await listTenants(s.actor, { q: address, pageSize: 20 });
    tenantId = found.rows.find((r) => r.subdomain === address)?.id ?? "";
    if (!tenantId) back({ err: `No store has the address "${address}". Use the first part of its web address.` });
    const category = get("category");
    await publishTemplateFromStore(s.actor, {
      tenantId,
      id: get("id"),
      name: get("name"),
      blurb: get("blurb"),
      audience: get("audience"),
      category: (TEMPLATE_CATEGORIES as readonly string[]).includes(category) ? category : "other",
      tags: get("tags").split(",").map((t) => t.trim()).filter(Boolean),
      moduleLabel: get("moduleLabel") || null,
    });
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/themes");
  back({ done: `Published ${get("id").toLowerCase()}. Stores using an older version are offered this one; new stores start from it.` });
}

/** Uploads a template file: it is checked part by part, saved, and (unless "save as draft" is ticked) goes live in the gallery, signup and every store's picker. */
export async function uploadTemplateFileAction(form: FormData): Promise<void> {
  const s = await requireAction("plans", "edit");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return back({ err: "Choose a template .json file to upload." });
  if (file.size > MAX_TEMPLATE_BUNDLE_BYTES) return back({ err: "The template file is too large (1 MB at most)." });
  const publish = form.get("draft") !== "on";
  let msg = "";
  try {
    const { template, created } = await importTemplateBundle(s.actor, await file.text(), { publish });
    msg = `${created ? "Added" : "Updated"} ${template.id} (v${template.version}). ${publish ? "It is live: the marketing gallery, signup and every store's template picker show it now." : "Saved as a draft. Press Publish to show it."}`;
  } catch (e) {
    if (e instanceof DomainError) return back({ err: e.message });
    throw e;
  }
  revalidatePath("/themes");
  back({ done: msg });
}

export async function setTemplateStatusAction(id: string, status: string): Promise<void> {
  const s = await requireAction("plans", "edit");
  try {
    await setTemplateStatus(s.actor, id, status as TemplateStatus);
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/themes");
  back({ done: status === "ARCHIVED" ? `${id} is hidden from new stores and the public gallery.` : `${id} is ${status === "PUBLISHED" ? "shown" : "set aside"}.` });
}

/** Global Module Maintenance Kill-Switch */
export async function toggleModuleMaintenanceAction(form: FormData): Promise<void> {
  const s = await requireAction("plans", "edit");
  const moduleKey = String(form.get("moduleKey") ?? "").trim();
  const isUnderMaintenance = form.get("isUnderMaintenance") === "true";
  const reason = String(form.get("reason") ?? "").trim();

  try {
    await toggleGlobalModuleMaintenance(s.actor, moduleKey, isUnderMaintenance, reason);
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/themes");
  back({ done: isUnderMaintenance ? `Emergency maintenance enabled for ${moduleKey}.` : `Maintenance lifted for ${moduleKey}.` });
}

/** Global Module Min Plan Override */
export async function setModulePlanOverrideAction(form: FormData): Promise<void> {
  const s = await requireAction("plans", "edit");
  const moduleKey = String(form.get("moduleKey") ?? "").trim();
  const minPlan = String(form.get("minPlan") ?? "").trim() as "STARTER" | "PRO" | "BUSINESS" | "DEFAULT";

  try {
    await setModulePlanOverride(s.actor, moduleKey, minPlan);
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/themes");
  back({ done: `Plan tier requirement updated for ${moduleKey}.` });
}
