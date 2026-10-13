"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, deleteCategory, saveCategory } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const PAGE = "/products/categories";

/** Creates or updates a category from the form. A refusal goes back to the form with the reason shown on top. */
export async function saveCategoryAction(form: FormData): Promise<void> {
  const s = await requireAction("products", "edit");
  const id = String(form.get("id") ?? "") || undefined;
  const back = id ? `${PAGE}?edit=${encodeURIComponent(id)}` : `${PAGE}?new=1`;
  try {
    await saveCategory(
      s.tenantId, s.actor,
      {
        name: String(form.get("name") ?? ""), description: String(form.get("description") ?? ""), imageUrl: String(form.get("imageUrl") ?? "") || null,
        parentId: String(form.get("parentId") ?? "") || null, sortOrder: Number(form.get("sortOrder") ?? 0) || 0, isActive: form.get("isActive") === "on",
      },
      id,
    );
  } catch (e) {
    if (e instanceof DomainError) redirect(`${back}${back.includes("?") ? "&" : "?"}err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath(PAGE);
  revalidatePath("/products");
  redirect(`${PAGE}?saved=1`);
}

export async function deleteCategoryAction(id: string): Promise<void> {
  const s = await requireAction("products", "edit");
  try {
    await deleteCategory(s.tenantId, s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`${PAGE}?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath(PAGE);
  revalidatePath("/products");
  redirect(`${PAGE}?deleted=1`);
}
