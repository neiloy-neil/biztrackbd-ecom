import type { Metadata } from "next";
import { getModuleStatus } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { getWhatsAppManagerDataAction } from "./actions";
import { WhatsAppManagerClient } from "./whatsapp-manager-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Automated WhatsApp Commerce",
};

export default async function WhatsAppManagerPage() {
  const s = await requireAccess("marketing");
  const mod = await getModuleStatus(s.tenantId, "whatsapp_commerce");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="Automated WhatsApp Commerce Suite"
        appKey="whatsapp_commerce"
        planTier={mod.planTier}
        minPlan="PRO"
        description="Zero-Meta linked device QR session, 2-way bot, automated COD confirmations, out-for-delivery reminders, cart recovery, and live desk."
      />
    );
  }

  const data = await getWhatsAppManagerDataAction();

  return (
    <WhatsAppManagerClient
      initialConfig={data.config}
      initialTemplates={data.templates}
      initialLogs={data.logs}
      totalLogs={data.totalLogs}
      planTier={data.planTier}
      isProOrHigher={data.isProOrHigher}
      isTrialActive={data.isTrialActive}
    />
  );
}
