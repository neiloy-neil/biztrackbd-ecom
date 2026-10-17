"use server";

import { revalidatePath } from "next/cache";
import {
  saveMerchantWebhookSubscription,
  rotateMerchantWebhookSecret,
  sendTestWebhookPing,
  ValidationError,
  ForbiddenError,
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

  const targetUrl = String(formData.get("targetUrl") ?? "").trim();
  const isActive = formData.get("isActive") === "true" || formData.get("isActive") === "on";
  const events = formData.getAll("events").map((e) => String(e));
  const secretToken = String(formData.get("secretToken") ?? "").trim() || undefined;

  try {
    await saveMerchantWebhookSubscription(s.tenantId, s.actor, {
      targetUrl,
      events,
      isActive,
      secretToken,
    });

    revalidatePath("/settings/webhooks");
    return { ok: true, message: "Webhook configuration saved successfully." };
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

export async function rotateWebhookSecretAction(): Promise<{
  ok: boolean;
  secretToken?: string;
  error?: string;
}> {
  const s = await requireAction("design", "edit");

  try {
    const result = await rotateMerchantWebhookSecret(s.tenantId, s.actor);
    revalidatePath("/settings/webhooks");
    return { ok: true, secretToken: result.secretToken };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to rotate webhook secret.",
    };
  }
}

export async function sendTestWebhookPingAction(): Promise<{
  ok: boolean;
  httpStatus?: number | null;
  error?: string;
  message?: string;
}> {
  const s = await requireAction("design", "edit");

  try {
    const result = await sendTestWebhookPing(s.tenantId, s.actor);
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
