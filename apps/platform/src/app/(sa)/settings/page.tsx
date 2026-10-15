import type { Metadata } from "next";
import { requireAccess } from "@/lib/session";
import {
  getPlatformAiConfig,
  getPlatformSmsConfig,
  getPlatformCourierConfig,
  getPlatformUddoktaPayConfig,
  getPlatformMailConfig,
  getPlatformFraudConfig,
  getPlatformGoogleConfig,
  getPlatformSeoConfig,
} from "@biztrackbd/core";
import { PlatformSettingsClient } from "./platform-settings-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Platform Settings | Super Admin",
  description: "Manage system-wide environment variables, gateway credentials, and platform defaults.",
};

export default async function PlatformSettingsPage() {
  await requireAccess("settings");

  const [aiConfig, smsConfig, courierConfig, uddoktaConfig, mailConfig, fraudConfig, googleConfig, seoConfig] = await Promise.all([
    getPlatformAiConfig(),
    getPlatformSmsConfig(),
    getPlatformCourierConfig(),
    getPlatformUddoktaPayConfig(),
    getPlatformMailConfig(),
    getPlatformFraudConfig(),
    getPlatformGoogleConfig(),
    getPlatformSeoConfig(),
  ]);

  return (
    <PlatformSettingsClient
      initialAiConfig={aiConfig}
      initialSmsConfig={smsConfig}
      initialCourierConfig={courierConfig}
      initialUddoktaConfig={uddoktaConfig}
      initialMailConfig={mailConfig}
      initialFraudConfig={fraudConfig}
      initialGoogleConfig={googleConfig}
      initialSeoConfig={seoConfig}
    />
  );
}
