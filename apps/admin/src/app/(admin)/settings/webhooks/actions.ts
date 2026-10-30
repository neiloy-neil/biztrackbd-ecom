"use server";

import { revalidatePath } from "next/cache";
import {
  saveMerchantWebhookSubscription,
  deleteMerchantWebhookSubscription,
  toggleMerchantWebhookSubscription,
  rotateMerchantWebhookSecret,
  sendTestWebhookPing,
  retryFailedWebhookDeliveries,
  ValidationError,
  ForbiddenError,
  type WebhookAdapterType,
  type WebhookEventKey,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface WebhookFormState {
  ok?: boolean;
  error?: string;
  field?: string;
  message?: string;
}

export async function saveWebhookAction(
  _prev: WebhookFormState,
  formData: FormData
): Promise<WebhookFormState> {
  const s = await requireAction("design", "edit");

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const name = String(formData.get("name") ?? "").trim() || undefined;
  const adapter = (String(formData.get("adapter") ?? "").trim() || undefined) as
    | WebhookAdapterType
    | undefined;
  const targetUrl = String(formData.get("targetUrl") ?? "").trim();
  const isActive = formData.get("isActive") === "true" || formData.get("isActive") === "on";
  const events = formData.getAll("events").map((e) => String(e));
  const secretToken = String(formData.get("secretToken") ?? "").trim() || undefined;

  try {
    await saveMerchantWebhookSubscription(s.tenantId, s.actor, {
      id,
      name,
      adapter,
      targetUrl,
      events,
      isActive,
      secretToken,
    });

    revalidatePath("/settings/webhooks");
    return { ok: true, message: "Webhook endpoint configuration saved successfully." };
  } catch (err) {
    if (err instanceof ValidationError) {
      const field = typeof err.details?.field === "string" ? err.details.field : undefined;
      return { ok: false, error: err.message, field };
    }
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "You do not have permission to modify webhook integrations." };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save webhook settings." };
  }
}

export async function deleteWebhookEndpointAction(endpointId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const s = await requireAction("design", "edit");

  try {
    await deleteMerchantWebhookSubscription(s.tenantId, s.actor, endpointId);
    revalidatePath("/settings/webhooks");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete webhook endpoint.",
    };
  }
}

export async function toggleWebhookEndpointAction(
  endpointId: string,
  isActive: boolean
): Promise<{
  ok: boolean;
  error?: string;
}> {
  const s = await requireAction("design", "edit");

  try {
    await toggleMerchantWebhookSubscription(s.tenantId, s.actor, endpointId, isActive);
    revalidatePath("/settings/webhooks");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update webhook status.",
    };
  }
}

export async function rotateWebhookSecretAction(endpointId?: string): Promise<{
  ok: boolean;
  secretToken?: string;
  error?: string;
}> {
  const s = await requireAction("design", "edit");

  try {
    const result = await rotateMerchantWebhookSecret(s.tenantId, s.actor, endpointId);
    revalidatePath("/settings/webhooks");
    return { ok: true, secretToken: result.secretToken };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to rotate webhook secret.",
    };
  }
}

export async function sendTestWebhookPingAction(options?: {
  subscriptionId?: string;
  event?: WebhookEventKey | "ping";
}): Promise<{
  ok: boolean;
  httpStatus?: number | null;
  error?: string;
  message?: string;
}> {
  const s = await requireAction("design", "edit");

  try {
    const result = await sendTestWebhookPing(s.tenantId, s.actor, {
      subscriptionId: options?.subscriptionId,
      event: options?.event,
      adminOrigin:
        process.env.ADMIN_ORIGIN ||
        process.env.NEXT_PUBLIC_ADMIN_URL ||
        process.env.NEXT_PUBLIC_ADMIN_ORIGIN ||
        (process.env.NODE_ENV === "production" ? "https://admin.biztrack.bd" : "http://localhost:3001"),
    });
    revalidatePath("/settings/webhooks");
    return {
      ok: result.ok,
      httpStatus: result.httpStatus,
      error: result.error,
      message: result.ok
        ? `Test ping delivered successfully (HTTP ${result.httpStatus ?? 200})`
        : result.error || "Endpoint rejected webhook ping.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to dispatch test ping.",
    };
  }
}

export async function retryFailedWebhookDeliveriesAction(subscriptionId?: string): Promise<{
  ok: boolean;
  retriedCount?: number;
  error?: string;
  message?: string;
}> {
  const s = await requireAction("design", "edit");

  try {
    const result = await retryFailedWebhookDeliveries(s.tenantId, s.actor, subscriptionId);
    revalidatePath("/settings/webhooks");
    return {
      ok: true,
      retriedCount: result.retriedCount,
      message: `Successfully re-queued ${result.retriedCount} delivery job${result.retriedCount === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to retry delivery jobs.",
    };
  }
}
