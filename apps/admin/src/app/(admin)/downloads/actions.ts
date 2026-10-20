"use server";

import { revalidatePath } from "next/cache";
import {
  listDownloads,
  upsertDownload,
  deleteDownload,
  reorderDownloads,
  downloadsCsv,
  type UpsertDownloadInput,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

function revalidateDownloadPaths() {
  revalidatePath("/downloads");
  revalidatePath("/content");
  revalidatePath("/settings");
}

export async function saveDownloadAction(input: UpsertDownloadInput) {
  const session = await requireAction("design", "edit");
  const res = await upsertDownload(session.tenantId, input);
  revalidateDownloadPaths();
  return { ok: true, data: res };
}

export async function deleteDownloadAction(id: string) {
  const session = await requireAction("design", "edit");
  await deleteDownload(session.tenantId, id);
  revalidateDownloadPaths();
  return { ok: true };
}

export async function reorderDownloadsAction(itemIds: string[]) {
  const session = await requireAction("design", "edit");
  await reorderDownloads(session.tenantId, itemIds);
  revalidateDownloadPaths();
  return { ok: true };
}

export async function exportDownloadsCsvAction() {
  const session = await requireAction("design", "edit");
  const items = await listDownloads(session.tenantId);
  const csv = downloadsCsv(items);
  return { ok: true, csv };
}
