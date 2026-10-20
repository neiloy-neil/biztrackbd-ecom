"use server";

import { revalidatePath } from "next/cache";
import {
  upsertMenuCategory,
  deleteMenuCategory,
  upsertMenuItem,
  toggleMenuItemAvailability,
  deleteMenuItem,
  buildMenuUrl,
  generateMenuQrSvg,
  generateMenuQrDataUrl,
  generateBatchTableQrs,
  type UpsertCategoryInput,
  type UpsertMenuItemInput,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";

export async function saveCategoryAction(input: UpsertCategoryInput) {
  const session = await requireAction("design", "edit");
  const res = await upsertMenuCategory(session.tenantId, input);
  revalidatePath("/menu");
  return { ok: true, data: res };
}

export async function deleteCategoryAction(categoryId: string) {
  const session = await requireAction("design", "edit");
  await deleteMenuCategory(session.tenantId, categoryId);
  revalidatePath("/menu");
  return { ok: true };
}

export async function saveMenuItemAction(input: UpsertMenuItemInput) {
  const session = await requireAction("design", "edit");
  const res = await upsertMenuItem(session.tenantId, input);
  revalidatePath("/menu");
  return { ok: true, data: res };
}

export async function toggleAvailabilityAction(itemId: string, isAvailable: boolean) {
  const session = await requireAction("design", "edit");
  await toggleMenuItemAvailability(session.tenantId, itemId, isAvailable);
  revalidatePath("/menu");
  return { ok: true };
}

export async function deleteMenuItemAction(itemId: string) {
  const session = await requireAction("design", "edit");
  await deleteMenuItem(session.tenantId, itemId);
  revalidatePath("/menu");
  return { ok: true };
}

export async function generateMenuQrAction(tableNumber?: string) {
  const session = await requireAction("design", "edit");
  const origin = storefrontOrigin(session.tenantSubdomain);
  const targetUrl = buildMenuUrl({ baseOrigin: origin, table: tableNumber });
  const [svg, dataUrl] = await Promise.all([
    generateMenuQrSvg(targetUrl),
    generateMenuQrDataUrl(targetUrl, 500),
  ]);

  return { ok: true, targetUrl, svg, dataUrl };
}

export async function generateBatchTableQrsAction(options: {
  mode: "range" | "custom";
  rangeStart?: number;
  rangeEnd?: number;
  customTables?: string[];
}) {
  const session = await requireAction("design", "edit");
  const origin = storefrontOrigin(session.tenantSubdomain);
  const items = await generateBatchTableQrs({
    baseOrigin: origin,
    mode: options.mode,
    rangeStart: options.rangeStart,
    rangeEnd: options.rangeEnd,
    customTables: options.customTables,
  });

  return { ok: true, origin, items };
}
