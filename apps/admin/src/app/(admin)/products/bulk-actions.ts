"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, bulkProductAction, importProductsCsv } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const ACTIONS = new Set(["publish", "unpublish", "archive", "unarchive", "delete"]);

/** Publish, unpublish or archive the ticked products. Returns to the list with a short result in the address. */
export async function bulkProductsAction(action: string, form: FormData): Promise<void> {
  const s = await requireAction("products", "edit");
  const ids = form.getAll("ids").map(String).filter(Boolean);
  const back = String(form.get("back") ?? "/products");
  const safeBack = back.startsWith("/products") ? back : "/products";
  const sep = safeBack.includes("?") ? "&" : "?";
  if (ids.length === 0 || !ACTIONS.has(action)) redirect(`${safeBack}${sep}msg=none`);
  const r = await bulkProductAction(s.tenantId, s.actor, ids, action as "publish" | "unpublish" | "archive" | "unarchive" | "delete");
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/");
  redirect(`${safeBack}${sep}msg=${action}-${r.done}-${r.skipped}`);
}

export type ImportState = {
  ok: true;
  created: number;
  totalVariants: number;
  platform: string;
  failed: { line: number; title: string; reason: string }[];
  stoppedByPlan: boolean;
} | { ok: false; error: string } | null;

/** Reads the chosen CSV file and adds products. Supports Shopify, WooCommerce, and standard CSV. */
export async function importProductsAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const s = await requireAction("products", "edit");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file first." };
  if (file.size > 5_000_000) return { ok: false, error: "That file is too big. Split it into files of 500 products or fewer." };
  try {
    const r = await importProductsCsv(s.tenantId, s.actor, await file.text());
    revalidatePath("/products");
    revalidatePath("/inventory");
    revalidatePath("/");
    return {
      ok: true,
      created: r.created,
      totalVariants: r.totalVariants,
      platform: r.platform,
      failed: r.failed,
      stoppedByPlan: r.stoppedByPlan,
    };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("importProductsAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Something went wrong. Nothing was imported." };
  }
}
