import type { Metadata } from "next";
import { requireAccess } from "@/lib/session";
import {
  getPlatformAiConfig,
  getPlatformSmsConfig,
  getPlatformCourierConfig,
  getPlatformUddoktaPayConfig,
  getPlatformMailConfig,
} from "@biztrackbd/core";
import { PlatformSettingsClient } from "./platform-settings-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Platform Settings | Super Admin",
  description: "Manage system-wide environment variables, gateway credentials, and platform defaults.",
};

export default async function PlatformSettingsPage() {
  await requireAccess("audit");

  const [aiConfig, smsConfig, courierConfig, uddoktaConfig, mailConfig] = await Promise.all([
    getPlatformAiConfig(),
    getPlatformSmsConfig(),
    getPlatformCourierConfig(),
    getPlatformUddoktaPayConfig(),
    getPlatformMailConfig(),
  ]);

  return (
    <PlatformSettingsClient
      initialAiConfig={aiConfig}
      initialSmsConfig={smsConfig}
      initialCourierConfig={courierConfig}
      initialUddoktaConfig={uddoktaConfig}
      initialMailConfig={mailConfig}
    />
  );
}
