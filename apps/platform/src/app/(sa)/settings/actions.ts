"use server";

import { revalidatePath } from "next/cache";
import {
  getPlatformAiConfig,
  savePlatformAiConfig,
  testPlatformGeminiApiKey,
  getPlatformSmsConfig,
  savePlatformSmsConfig,
  testPlatformSms,
  getPlatformSmsBalance,
  getPlatformCourierConfig,
  savePlatformCourierConfig,
  testPlatformCouriers,
  getPlatformUddoktaPayConfig,
  savePlatformUddoktaPayConfig,
  savePlatformContactConfig,
  testPlatformUddoktaPay,
  getPlatformMailConfig,
  savePlatformMailConfig,
  savePlatformFraudConfig,
  testPlatformFraudChecker,
  savePlatformGoogleConfig,
  testPlatformGoogleConnection,
  getPlatformSeoConfig,
  savePlatformSeoConfig,
  DomainError,
  ForbiddenError,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

// 1. AI Actions
export async function getPlatformAiConfigAction() {
  await requireAction("settings", "view");
  return getPlatformAiConfig();
}

export async function savePlatformAiConfigAction(input: {
  apiKey?: string;
  defaultModel?: string;
}) {
  try {
    const s = await requireAction("settings", "edit");
    await savePlatformAiConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false as const, error: "Access denied: Platform Owner or Support Lead role required." };
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformAiConfigAction error", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed to save platform AI configuration." };
  }
}

export async function testPlatformAiConnectionAction(apiKey?: string, model?: string) {
  try {
    await requireAction("settings", "view");
    return await testPlatformGeminiApiKey(apiKey, model);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, latencyMs: 0, model: model ?? "gemini-2.5-flash", error: "Access denied to test platform AI." };
    return { ok: false, latencyMs: 0, model: model ?? "gemini-2.5-flash", error: err instanceof Error ? err.message : "Test connection failed." };
  }
}

// 2. SMS Actions
export async function savePlatformSmsConfigAction(input: {
  provider: "smsnetbd" | "greenweb" | "bulksmsbd";
  apiKey?: string;
  senderId?: string;
}) {
  try {
    const s = await requireAction("settings", "edit");
    await savePlatformSmsConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false as const, error: "Access denied: Platform Owner or Support Lead role required." };
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformSmsConfigAction error", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed to save SMS gateway settings." };
  }
}

export async function testPlatformSmsAction(phoneNumber: string) {
  try {
    await requireAction("settings", "view");
    return await testPlatformSms(phoneNumber);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, latencyMs: 0, message: "Access denied to test SMS gateway." };
    return { ok: false, latencyMs: 0, message: err instanceof Error ? err.message : "SMS test failed." };
  }
}

export async function getPlatformSmsBalanceAction() {
  try {
    await requireAction("settings", "view");
    return await getPlatformSmsBalance();
  } catch (err) {
    return { ok: false, balance: null, provider: "bulksmsbd" as const, error: err instanceof Error ? err.message : "Failed to fetch SMS balance." };
  }
}

// 3. Courier Logistics Actions
export async function savePlatformCourierConfigAction(input: {
  steadfastApiKey?: string;
  steadfastSecretKey?: string;
  pathaoClientId?: string;
  pathaoClientSecret?: string;
  pathaoUsername?: string;
  redxApiKey?: string;
  carrybeeApiKey?: string;
  paperflyApiKey?: string;
}) {
  try {
    const s = await requireAction("settings", "edit");
    await savePlatformCourierConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false as const, error: "Access denied: Platform Owner or Support Lead role required." };
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformCourierConfigAction error", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed to save courier credentials." };
  }
}

export async function testPlatformCouriersAction() {
  try {
    await requireAction("settings", "view");
    return await testPlatformCouriers();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, overallLatencyMs: 0, providers: {} };
    }
    return { ok: false, overallLatencyMs: 0, providers: {} };
  }
}

// 4. UddoktaPay Actions
export async function savePlatformUddoktaPayConfigAction(input: {
  baseUrl?: string;
  apiKey?: string;
  webhookSecret?: string;
}) {
  try {
    const s = await requireAction("settings", "edit");
    await savePlatformUddoktaPayConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false as const, error: "Access denied: Platform Owner or Support Lead role required." };
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformUddoktaPayConfigAction error", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed to save UddoktaPay settings." };
  }
}

export async function testPlatformUddoktaPayAction() {
  try {
    await requireAction("settings", "view");
    return await testPlatformUddoktaPay();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, latencyMs: 0, message: "Access denied to test UddoktaPay." };
    return { ok: false, latencyMs: 0, message: err instanceof Error ? err.message : "Test failed." };
  }
}

// 5. Mail Actions
export async function savePlatformMailConfigAction(input: {
  fromEmail?: string;
  fromName?: string;
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
}) {
  try {
    const s = await requireAction("settings", "edit");
    await savePlatformMailConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false as const, error: "Access denied: Platform Owner or Support Lead role required." };
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformMailConfigAction error", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed to save platform mail configuration." };
  }
}

// 6. Fraud checker
export async function savePlatformFraudConfigAction(input: { apiKey?: string; endpoint?: string }) {
  try {
    const s = await requireAction("settings", "edit");
    await savePlatformFraudConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false as const, error: "Access denied: Platform Owner or Support Lead role required." };
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformFraudConfigAction error", err instanceof Error ? err.name : "unknown");
    return { ok: false as const, error: "Failed to save the fraud checker settings." };
  }
}

export async function testPlatformFraudCheckerAction(apiKey?: string) {
  try {
    await requireAction("settings", "view");
    return await testPlatformFraudChecker(apiKey);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, latencyMs: 0, message: "Access denied to test fraud checker." };
    return { ok: false, latencyMs: 0, message: err instanceof Error ? err.message : "Fraud test failed." };
  }
}

// 7. Google Cloud Console Suite
export async function savePlatformGoogleConfigAction(input: {
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthEnabled?: boolean;
  gcsBucketName?: string;
  gcsProjectId?: string;
  gcsServiceAccountKey?: string;
  gcsEnabled?: boolean;
  merchantCenterId?: string;
  siteVerificationCode?: string;
}) {
  try {
    const s = await requireAction("settings", "edit");
    await savePlatformGoogleConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false as const, error: "Access denied: Platform Owner or Support Lead role required." };
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformGoogleConfigAction error", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed to save Google Cloud Console settings." };
  }
}

export async function testPlatformGoogleConnectionAction() {
  try {
    await requireAction("settings", "view");
    return await testPlatformGoogleConnection();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, latencyMs: 0, message: "Access denied." };
    return { ok: false, latencyMs: 0, message: err instanceof Error ? err.message : "Google Cloud test failed." };
  }
}

// 8. Platform SEO & Sitemaps for biztrack.bd
export async function getPlatformSeoConfigAction() {
  await requireAction("settings", "view");
  return getPlatformSeoConfig();
}

export async function savePlatformSeoConfigAction(input: {
  title?: string;
  description?: string;
  keywords?: string;
  ogImageUrl?: string;
  siteVerificationCode?: string;
}) {
  try {
    const s = await requireAction("settings", "edit");
    await savePlatformSeoConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false as const, error: "Access denied: Platform Owner or Support Lead role required." };
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformSeoConfigAction error", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed to save platform SEO settings." };
  }
}

export async function savePlatformContactConfigAction(input: {
  email?: string;
  phone?: string;
  whatsapp?: string;
  facebookUrl?: string;
  instagramUrl?: string;
}) {
  try {
    const s = await requireAction("settings", "edit");
    await savePlatformContactConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false as const, error: "Access denied: Platform Owner or Support Lead role required." };
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformContactConfigAction error", err);
    return { ok: false as const, error: err instanceof Error ? err.message : "Failed to save contact details." };
  }
}
