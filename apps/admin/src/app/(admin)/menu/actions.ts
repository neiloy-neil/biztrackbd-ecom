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
  type UpsertCategoryInput,
  type UpsertMenuItemInput,
} from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";

export async function saveCategoryAction(input: UpsertCategoryInput) {
  const session = await getSession();
  const res = await upsertMenuCategory(session.tenantId, input);
  revalidatePath("/menu");
  return { ok: true, data: res };
}

export async function deleteCategoryAction(categoryId: string) {
  const session = await getSession();
  await deleteMenuCategory(session.tenantId, categoryId);
  revalidatePath("/menu");
  return { ok: true };
}

export async function saveMenuItemAction(input: UpsertMenuItemInput) {
  const session = await getSession();
  const res = await upsertMenuItem(session.tenantId, input);
  revalidatePath("/menu");
  return { ok: true, data: res };
}

export async function toggleAvailabilityAction(itemId: string, isAvailable: boolean) {
  const session = await getSession();
  await toggleMenuItemAvailability(session.tenantId, itemId, isAvailable);
  revalidatePath("/menu");
  return { ok: true };
}

export async function deleteMenuItemAction(itemId: string) {
  const session = await getSession();
  await deleteMenuItem(session.tenantId, itemId);
  revalidatePath("/menu");
  return { ok: true };
}

export async function generateMenuQrAction(tableNumber?: string) {
  const session = await getSession();
  const origin = storefrontOrigin(session.tenantSubdomain);
  const targetUrl = buildMenuUrl({ baseOrigin: origin, table: tableNumber });
  const [svg, dataUrl] = await Promise.all([
    generateMenuQrSvg(targetUrl),
    generateMenuQrDataUrl(targetUrl, 500),
  ]);

  return { ok: true, targetUrl, svg, dataUrl };
}
