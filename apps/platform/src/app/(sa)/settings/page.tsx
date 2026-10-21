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
  getPlatformContactConfig,
  uddoktaPayPlanUrls,
  platformOriginFor,
} from "@biztrackbd/core";
import { PlatformSettingsClient } from "./platform-settings-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Platform Settings | Super Admin",
  description: "Manage system-wide environment variables, gateway credentials, and platform defaults.",
};

export default async function PlatformSettingsPage() {
  await requireAccess("settings");

  const [aiConfig, smsConfig, courierConfig, uddoktaConfig, mailConfig, fraudConfig, googleConfig, seoConfig, contactConfig] = await Promise.all([
    getPlatformAiConfig(),
    getPlatformSmsConfig(),
    getPlatformCourierConfig(),
    getPlatformUddoktaPayConfig(),
    getPlatformMailConfig(),
    getPlatformFraudConfig(),
    getPlatformGoogleConfig(),
    getPlatformSeoConfig(),
    getPlatformContactConfig(),
  ]);

  const adminOrigin = (process.env.NEXT_PUBLIC_ADMIN_URL || process.env.ADMIN_ORIGIN || "https://admin.biztrack.bd").replace(/\/+$/, "");
  const platformOrigin = platformOriginFor(process.env.NEXT_PUBLIC_ROOT_DOMAIN);

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
      initialContactConfig={contactConfig}
      planPaymentUrls={uddoktaPayPlanUrls(adminOrigin, platformOrigin)}
    />
  );
}
