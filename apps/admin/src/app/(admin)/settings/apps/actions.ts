"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError,
  PROVIDER_KEYS,
  PROVIDERS,
  removeIntegration,
  saveIntegration,
  saveLoyaltySettings,
  saveTrackingConfig,
  setModule,
  testCourierConnection,
  type ProviderKey,
} from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { requireAction } from "@/lib/session";

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

export async function setModuleAction(key: string, enabled: boolean): Promise<void> {
  const s = await requireAction("billing", "edit");
  try {
    await setModule(s.tenantId, s.actor, key, enabled);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/settings/apps?${new URLSearchParams({ err: e.message })}`);
    throw e;
  }
  revalidatePath("/", "layout");
  redirect("/settings/apps?done=saved");
}

export async function saveCourierAction(
  provider: ProviderKey,
  mode: "TEST" | "LIVE",
  values: Record<string, string>,
): Promise<ActionResult> {
  const s = await requireAction("billing", "edit");
  const spec = PROVIDERS[provider];
  if (!spec) return { error: "Unknown courier provider" };

  const config: Record<string, string> = {};
  const secrets: Record<string, string> = {};

  for (const k of spec.config) {
    if (values[k] !== undefined) config[k] = values[k]!.trim();
  }
  for (const k of spec.secrets) {
    if (values[k] !== undefined && values[k]!.trim() !== "") {
      secrets[k] = values[k]!.trim();
    }
  }

  try {
    await saveIntegration(
      s.tenantId,
      { provider, mode, config, secrets },
      undefined,
      s.actor,
    );
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("saveCourierAction failed", e);
    return { error: "Could not save courier credentials." };
  }

  revalidatePath("/settings/apps");
  return { ok: true };
}

export async function testCourierAction(
  provider: ProviderKey,
  mode: "TEST" | "LIVE",
): Promise<ActionResult> {
  const s = await requireAction("billing", "edit");
  try {
    const r = await testCourierConnection(s.tenantId, s.actor, provider, mode);
    revalidatePath("/settings/apps");
    return r.ok ? { ok: true } : { error: r.error };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("testCourierAction failed", e);
    return { error: "Could not test connection." };
  }
}

export async function removeIntegrationAction(
  provider: ProviderKey,
  mode: string,
): Promise<ActionResult> {
  const s = await requireAction("billing", "edit");
  try {
    await removeIntegration(s.tenantId, provider, mode, s.actor);
    revalidatePath("/settings/apps");
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    return { error: "Could not remove integration." };
  }
}

export async function saveTrackingPixelsAction(input: {
  metaPixelId?: string;
  capiAccessToken?: string;
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  tiktokPixelId?: string;
  metaDomainVerification?: string;
}): Promise<ActionResult> {
  const s = await requireAction("marketing", "edit");
  try {
    await saveTrackingConfig(s.tenantId, s.actor, {
      pixelId: input.metaPixelId ?? "",
      googleAnalyticsId: input.googleAnalyticsId ?? "",
      googleTagManagerId: input.googleTagManagerId ?? "",
      tiktokPixelId: input.tiktokPixelId ?? "",
      metaDomainVerification: input.metaDomainVerification ?? "",
    });

    if (input.capiAccessToken?.trim()) {
      await saveIntegration(
        s.tenantId,
        {
          provider: "META_CAPI",
          mode: "LIVE",
          config: { pixelId: input.metaPixelId?.trim() ?? "" },
          secrets: { accessToken: input.capiAccessToken.trim() },
        },
        undefined,
        s.actor,
      );
    }

    revalidatePath("/settings/apps");
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("saveTrackingPixelsAction failed", e);
    return { error: "Could not save marketing tracking pixels." };
  }
}

export async function saveWhatsAppWidgetAction(input: {
  whatsappNumber: string;
}): Promise<ActionResult> {
  const s = await requireAction("design", "edit");
  const raw = input.whatsappNumber?.trim() || "";
  let phone: string | null = null;
  if (raw) {
    const clean = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (clean.length < 10 || clean.length > 15) {
      return { error: "Please enter a valid WhatsApp mobile number (e.g. 01712345678)" };
    }
    phone = clean.startsWith("880") ? clean.slice(2) : clean;
  }

  try {
    await withTenant(s.tenantId, async (tx) => {
      await tx.storeSettings.updateMany({ data: { whatsappNumber: phone } });
    });
    revalidatePath("/settings/apps");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("saveWhatsAppWidgetAction failed", e);
    return { error: "Could not save WhatsApp widget." };
  }
}

export async function saveLoyaltyAction(input: Record<string, unknown>): Promise<ActionResult> {
  const s = await requireAction("marketing", "edit");
  try {
    await saveLoyaltySettings(s.tenantId, s.actor, input);
    revalidatePath("/settings/apps");
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("saveLoyaltyAction failed", e);
    return { error: "Could not save loyalty settings." };
  }
}

export async function saveSmsGatewayAction(input: {
  apiKey: string;
  senderId?: string;
  provider?: string;
}): Promise<ActionResult> {
  const s = await requireAction("billing", "edit");
  try {
    await saveIntegration(
      s.tenantId,
      {
        provider: "SMS_BYO",
        mode: "LIVE",
        config: { senderId: input.senderId?.trim() ?? "", provider: input.provider ?? "greenweb" },
        secrets: { apiKey: input.apiKey.trim() },
      },
      undefined,
      s.actor,
    );
    revalidatePath("/settings/apps");
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("saveSmsGatewayAction failed", e);
    return { error: "Could not save SMS gateway credentials." };
  }
}

export async function savePaymentGatewayAction(
  provider: "SSLCOMMERZ" | "UDDOKTAPAY",
  mode: "TEST" | "LIVE",
  values: Record<string, string>,
): Promise<ActionResult> {
  const s = await requireAction("billing", "edit");
  const spec = PROVIDERS[provider];
  if (!spec) return { error: "Unknown payment gateway" };

  const config: Record<string, string> = {};
  const secrets: Record<string, string> = {};

  for (const k of spec.config) {
    if (values[k] !== undefined) config[k] = values[k]!.trim();
  }
  for (const k of spec.secrets) {
    if (values[k] !== undefined && values[k]!.trim() !== "") {
      secrets[k] = values[k]!.trim();
    }
  }

  try {
    await saveIntegration(
      s.tenantId,
      { provider, mode, config, secrets },
      undefined,
      s.actor,
    );
    revalidatePath("/settings/apps");
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("savePaymentGatewayAction failed", e);
    return { error: "Could not save payment gateway credentials." };
  }
}
