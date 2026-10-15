"use server";

import {
  can,
  getWhatsAppConfig,
  saveWhatsAppConfig,
  getWhatsAppTemplates,
  saveWhatsAppTemplate,
  resetWhatsAppTemplate,
  startWhatsAppSession,
  disconnectWhatsAppSession,
  confirmWhatsAppPairing,
  sendWhatsAppNotification,
  getWhatsAppMessageLogs,
  type WhatsAppConfigView,
  type WhatsAppEventType,
} from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { requireAccess } from "@/lib/session";

export async function getWhatsAppManagerDataAction() {
  const s = await requireAccess("marketing");
  const [config, templates, logsData, tenant] = await Promise.all([
    getWhatsAppConfig(s.tenantId),
    getWhatsAppTemplates(s.tenantId),
    getWhatsAppMessageLogs(s.tenantId, { limit: 40 }),
    withTenant(s.tenantId, (tx) =>
      tx.tenant.findUnique({
        where: { id: s.tenantId },
        select: { planTier: true, trialEndsAt: true },
      })
    ),
  ]);

  const planTier = tenant?.planTier ?? "STARTER";
  const isTrialActive = Boolean(tenant?.trialEndsAt && new Date(tenant.trialEndsAt) > new Date());
  // 14-day trials receive full Pro access
  const isProOrHigher = planTier === "PRO" || planTier === "BUSINESS" || planTier === "ENTERPRISE" || isTrialActive;

  return {
    config,
    templates,
    logs: logsData.logs,
    totalLogs: logsData.total,
    planTier,
    isProOrHigher,
    isTrialActive,
  };
}

import { revalidatePath } from "next/cache";

export async function startWhatsAppSessionAction(phoneNumber?: string) {
  const s = await requireAccess("marketing");
  if (!can(s.user.role, "marketing", "edit")) {
    throw new Error("You do not have permission to modify WhatsApp settings.");
  }
  const result = await startWhatsAppSession(s.tenantId, { phoneNumber });
  revalidatePath("/marketing/whatsapp");
  revalidatePath("/settings/apps");
  return result;
}

export async function disconnectWhatsAppSessionAction() {
  const s = await requireAccess("marketing");
  if (!can(s.user.role, "marketing", "edit")) {
    throw new Error("You do not have permission to disconnect WhatsApp.");
  }
  await disconnectWhatsAppSession(s.tenantId);
  revalidatePath("/marketing/whatsapp");
  revalidatePath("/settings/apps");
  return { success: true };
}

export async function confirmWhatsAppPairingAction(phoneNumber: string) {
  const s = await requireAccess("marketing");
  if (!can(s.user.role, "marketing", "edit")) {
    throw new Error("You do not have permission to pair WhatsApp.");
  }
  const status = await confirmWhatsAppPairing(s.tenantId, phoneNumber);
  revalidatePath("/marketing/whatsapp");
  revalidatePath("/settings/apps");
  return { success: true, status };
}

export async function saveWhatsAppConfigAction(data: Partial<WhatsAppConfigView>) {
  const s = await requireAccess("marketing");
  if (!can(s.user.role, "marketing", "edit")) {
    throw new Error("You do not have permission to modify WhatsApp settings.");
  }
  const updated = await saveWhatsAppConfig(s.tenantId, data);
  return { success: true, config: updated };
}

export async function saveWhatsAppTemplateAction(
  event: WhatsAppEventType,
  data: { bodyEn: string; bodyBn?: string; isActive?: boolean }
) {
  const s = await requireAccess("marketing");
  if (!can(s.user.role, "marketing", "edit")) {
    throw new Error("You do not have permission to edit message templates.");
  }
  await saveWhatsAppTemplate(s.tenantId, event, data);
  return { success: true };
}

export async function resetWhatsAppTemplateAction(event: WhatsAppEventType) {
  const s = await requireAccess("marketing");
  if (!can(s.user.role, "marketing", "edit")) {
    throw new Error("You do not have permission to reset message templates.");
  }
  await resetWhatsAppTemplate(s.tenantId, event);
  return { success: true };
}

export async function sendTestWhatsAppMessageAction(phone: string, text: string) {
  const s = await requireAccess("marketing");
  if (!can(s.user.role, "marketing", "edit")) {
    throw new Error("You do not have permission to send test messages.");
  }
  const result = await sendWhatsAppNotification(s.tenantId, {
    phone,
    body: text,
    fallbackToSms: true,
  });
  return result;
}
