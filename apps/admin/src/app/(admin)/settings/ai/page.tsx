import type { Metadata } from "next";
import { getAiSettings, getModuleStatus } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { AiSettingsForm } from "./ai-settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store Assistant & Content Tools" };

export default async function AiSettingsPage() {
  const s = await requireAccess("design");
  const [mod, aiSettings] = await Promise.all([
    getModuleStatus(s.tenantId, "ai_suite"),
    getAiSettings(s.tenantId, s.actor),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Store Assistant &amp; Content Tools</h1>
      </div>
      <p className="page-sub">
        Configure automated description generation, custom API keys, and storefront chat assistant options.
      </p>

      <AiSettingsForm initial={aiSettings} />
    </>
  );
}
