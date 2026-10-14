"use server";

import { revalidatePath } from "next/cache";
import {
  getPlatformAiConfig,
  savePlatformAiConfig,
  testPlatformGeminiApiKey,
  getPlatformSmsConfig,
  savePlatformSmsConfig,
  testPlatformSms,
  getPlatformCourierConfig,
  savePlatformCourierConfig,
  testPlatformCouriers,
  getPlatformUddoktaPayConfig,
  savePlatformUddoktaPayConfig,
  testPlatformUddoktaPay,
  getPlatformMailConfig,
  savePlatformMailConfig,
  savePlatformFraudConfig,
  testPlatformFraudChecker,
  DomainError,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

// 1. AI Actions
export async function getPlatformAiConfigAction() {
  await requireAction("audit");
  return getPlatformAiConfig();
}

export async function savePlatformAiConfigAction(input: {
  apiKey?: string;
  defaultModel?: string;
}) {
  const s = await requireAction("audit");
  try {
    await savePlatformAiConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformAiConfigAction error", err);
    return { ok: false as const, error: "Failed to save platform AI configuration." };
  }
}

export async function testPlatformAiConnectionAction(apiKey?: string, model?: string) {
  await requireAction("audit");
  return testPlatformGeminiApiKey(apiKey, model);
}

// 2. SMS Actions
export async function savePlatformSmsConfigAction(input: {
  provider: "smsnetbd" | "greenweb" | "bulksmsbd";
  apiKey?: string;
  senderId?: string;
}) {
  const s = await requireAction("audit");
  try {
    await savePlatformSmsConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    return { ok: false as const, error: "Failed to save SMS gateway settings." };
  }
}

export async function testPlatformSmsAction(phoneNumber: string) {
  await requireAction("audit");
  return testPlatformSms(phoneNumber);
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
  const s = await requireAction("audit");
  try {
    await savePlatformCourierConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    return { ok: false as const, error: "Failed to save courier credentials." };
  }
}

export async function testPlatformCouriersAction() {
  await requireAction("audit");
  return testPlatformCouriers();
}

// 4. UddoktaPay Actions
export async function savePlatformUddoktaPayConfigAction(input: {
  baseUrl?: string;
  apiKey?: string;
  webhookSecret?: string;
}) {
  const s = await requireAction("audit");
  try {
    await savePlatformUddoktaPayConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    return { ok: false as const, error: "Failed to save UddoktaPay settings." };
  }
}

export async function testPlatformUddoktaPayAction() {
  await requireAction("audit");
  return testPlatformUddoktaPay();
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
  const s = await requireAction("audit");
  try {
    await savePlatformMailConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    return { ok: false as const, error: "Failed to save platform mail configuration." };
  }
}

// 6. Fraud checker
export async function savePlatformFraudConfigAction(input: { apiKey?: string; endpoint?: string }) {
  const s = await requireAction("audit");
  try {
    await savePlatformFraudConfig(s.actor, input);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof DomainError) return { ok: false as const, error: err.message };
    console.error("savePlatformFraudConfigAction error", err instanceof Error ? err.name : "unknown");
    return { ok: false as const, error: "Failed to save the fraud checker settings." };
  }
}

export async function testPlatformFraudCheckerAction(apiKey?: string) {
  await requireAction("audit");
  return testPlatformFraudChecker(apiKey);
}
