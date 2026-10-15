"use server";

import { revalidatePath } from "next/cache";
import {
  DomainError,
  createDrop,
  updateDrop,
  deleteDrop,
  markDropStockReceived,
  notifyDropWaitlistSubscribers,
  listDropSubscribers,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface ActionResponse {
  ok: boolean;
  error?: string;
  data?: unknown;
}

export async function createDropAction(input: any): Promise<ActionResponse> {
  const s = await requireAction("marketing", "edit");
  try {
    const res = await createDrop(s.tenantId, input);
    revalidatePath("/marketing/drops");
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("createDropAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create drop" };
  }
}

export async function updateDropAction(id: string, input: any): Promise<ActionResponse> {
  const s = await requireAction("marketing", "edit");
  try {
    const res = await updateDrop(s.tenantId, id, input);
    revalidatePath("/marketing/drops");
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("updateDropAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update drop" };
  }
}

export async function deleteDropAction(id: string): Promise<ActionResponse> {
  const s = await requireAction("marketing", "edit");
  try {
    const res = await deleteDrop(s.tenantId, id);
    revalidatePath("/marketing/drops");
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("deleteDropAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete drop" };
  }
}

export async function markStockReceivedAction(dropId: string): Promise<ActionResponse> {
  const s = await requireAction("orders", "edit");
  try {
    const res = await markDropStockReceived(s.tenantId, dropId);
    revalidatePath("/marketing/drops");
    revalidatePath("/orders");
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("markStockReceivedAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mark stock received" };
  }
}

export async function notifySubscribersAction(dropId: string): Promise<ActionResponse> {
  const s = await requireAction("marketing", "edit");
  try {
    const res = await notifyDropWaitlistSubscribers(s.tenantId, dropId);
    revalidatePath("/marketing/drops");
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("notifySubscribersAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to notify subscribers" };
  }
}

export async function getDropSubscribersAction(dropId: string): Promise<ActionResponse> {
  const s = await requireAction("marketing", "view");
  try {
    const res = await listDropSubscribers(s.tenantId, dropId);
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("getDropSubscribersAction error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to fetch subscribers" };
  }
}
