"use server";

import { revalidatePath } from "next/cache";
import {
  listContentItems,
  upsertContentItem,
  deleteContentItem,
  reorderContentItems,
  contentItemsCsv,
  type SiteContentKind,
  type UpsertContentItemInput,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

function revalidateAllContentPaths() {
  revalidatePath("/content-items");
  revalidatePath("/services");
  revalidatePath("/portfolio");
  revalidatePath("/team");
  revalidatePath("/credentials");
  revalidatePath("/publications");
  revalidatePath("/events");
  revalidatePath("/content");
}

export async function saveContentItemAction(input: UpsertContentItemInput) {
  const session = await requireAction("design", "edit");
  const res = await upsertContentItem(session.tenantId, input);
  revalidateAllContentPaths();
  return { ok: true, data: res };
}

export async function deleteContentItemAction(id: string) {
  const session = await requireAction("design", "edit");
  await deleteContentItem(session.tenantId, id);
  revalidateAllContentPaths();
  return { ok: true };
}

export async function reorderContentItemsAction(kind: SiteContentKind, itemIds: string[]) {
  const session = await requireAction("design", "edit");
  await reorderContentItems(session.tenantId, kind, itemIds);
  revalidateAllContentPaths();
  return { ok: true };
}

export async function exportContentItemsCsvAction(kind?: SiteContentKind) {
  const session = await requireAction("design", "edit");
  const items = await listContentItems(session.tenantId, kind ? { kind } : undefined);
  const csv = contentItemsCsv(items);
  return { ok: true, csv };
}
