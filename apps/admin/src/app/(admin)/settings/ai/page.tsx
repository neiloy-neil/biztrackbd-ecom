import type { Metadata } from "next";
import { getAiSettings, getModuleStatus } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { AiSettingsForm } from "./ai-settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI & Chatbot Settings" };

export default async function AiSettingsPage() {
  const s = await requireAccess("design");
  const mod = await getModuleStatus(s.tenantId, "ai_suite");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="Gemini AI Merchant & Chatbot Suite"
        appKey="ai_suite"
        planTier={mod.planTier}
        minPlan="PRO"
        description="Access AI copywriters, chat address parsers, and the storefront 24/7 sales chatbot."
      />
    );
  }

  const aiSettings = await getAiSettings(s.tenantId, s.actor);

  return (
    <>
      <div className="page-head">
        <h1>AI &amp; Chatbot Settings</h1>
      </div>
      <p className="page-sub">
        Configure Google Gemini AI settings, bring your own API key for unlimited generation, and customize the storefront shopping assistant.
      </p>

      <AiSettingsForm initial={aiSettings} />
    </>
  );
}
