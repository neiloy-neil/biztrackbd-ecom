"use server";

import { revalidatePath } from "next/cache";
import {
  DomainError,
  createBundle,
  updateBundle,
  deleteBundle,
  createOrderBump,
  updateOrderBump,
  deleteOrderBump,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface ActionResponse {
  ok: boolean;
  error?: string;
  data?: unknown;
}

export async function createBundleAction(input: unknown): Promise<ActionResponse> {
  const s = await requireAction("marketing", "edit");
  try {
    const res = await createBundle(s.tenantId, input);
    revalidatePath("/marketing/bundles");
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("createBundleAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create bundle" };
  }
}

export async function updateBundleAction(id: string, input: unknown): Promise<ActionResponse> {
  const s = await requireAction("marketing", "edit");
  try {
    const res = await updateBundle(s.tenantId, id, input);
    revalidatePath("/marketing/bundles");
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("updateBundleAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update bundle" };
  }
}

export async function deleteBundleAction(id: string): Promise<ActionResponse> {
  const s = await requireAction("marketing", "edit");
  try {
    await deleteBundle(s.tenantId, id);
    revalidatePath("/marketing/bundles");
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("deleteBundleAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete bundle" };
  }
}

export async function createOrderBumpAction(input: unknown): Promise<ActionResponse> {
  const s = await requireAction("marketing", "edit");
  try {
    const res = await createOrderBump(s.tenantId, input);
    revalidatePath("/marketing/bundles");
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("createOrderBumpAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create order bump" };
  }
}

export async function updateOrderBumpAction(id: string, input: unknown): Promise<ActionResponse> {
  const s = await requireAction("marketing", "edit");
  try {
    const res = await updateOrderBump(s.tenantId, id, input);
    revalidatePath("/marketing/bundles");
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("updateOrderBumpAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update order bump" };
  }
}

export async function deleteOrderBumpAction(id: string): Promise<ActionResponse> {
  const s = await requireAction("marketing", "edit");
  try {
    await deleteOrderBump(s.tenantId, id);
    revalidatePath("/marketing/bundles");
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("deleteOrderBumpAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete order bump" };
  }
}
