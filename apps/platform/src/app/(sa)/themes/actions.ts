"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, TEMPLATE_CATEGORIES, listTenants, publishTemplateFromStore, setTemplateStatus, type TemplateStatus } from "@biztrackbd/core";
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
      tenantId, id: get("id"), name: get("name"), blurb: get("blurb"), audience: get("audience"), category: (TEMPLATE_CATEGORIES as readonly string[]).includes(category) ? category : "other",
      tags: get("tags").split(",").map((t) => t.trim()).filter(Boolean), moduleLabel: get("moduleLabel") || null,
    });
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/themes");
  back({ done: `Published ${get("id").toLowerCase()}. Stores using an older version are offered this one; new stores start from it.` });
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
