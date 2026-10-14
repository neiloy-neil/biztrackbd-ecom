import type { Metadata } from "next";
import { getWhatsAppManagerDataAction } from "./actions";
import { WhatsAppManagerClient } from "./whatsapp-manager-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Automated WhatsApp Commerce",
};

export default async function WhatsAppManagerPage() {
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
