import type { Metadata } from "next";
import { getModuleStatus } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { getWhatsAppManagerDataAction } from "./actions";
import { WhatsAppManagerClient } from "./whatsapp-manager-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "WhatsApp Commerce & Notifications",
};

export default async function WhatsAppManagerPage() {
  const s = await requireAccess("marketing");
  const mod = await getModuleStatus(s.tenantId, "whatsapp_commerce");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="WhatsApp Commerce & Notifications"
        appKey="whatsapp_commerce"
        planTier={mod.planTier}
        minPlan="PRO"
        description="Connect your store's WhatsApp number to send automated COD confirmations, delivery tracking updates, and customer support."
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
      initialCampaigns={data.campaigns}
      planTier={data.planTier}
      isProOrHigher={data.isProOrHigher}
      isTrialActive={data.isTrialActive}
    />
  );
}
