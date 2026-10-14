"use server";

import { revalidatePath } from "next/cache";
import {
  saveAiSettings,
  testGeminiApiKey,
  type SaveAiSettingsInput,
  DomainError,
} from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export interface AiActionState {
  error?: string;
  success?: string;
}

export async function saveAiSettingsAction(
  _prev: AiActionState,
  form: FormData
): Promise<AiActionState> {
  const s = await requireAccess("design");

  const customKeyRaw = form.get("customGeminiApiKey");
  const chatbotEnabled = form.get("aiChatbotEnabled") === "on";
  const chatbotName = String(form.get("aiChatbotName") ?? "শপ অ্যাসিস্ট্যান্ট");
  const chatbotWelcome = String(form.get("aiChatbotWelcome") ?? "");
  const chatbotEscalatePhone = String(form.get("aiChatbotEscalatePhone") ?? "");

  const input: SaveAiSettingsInput = {
    customGeminiApiKey: customKeyRaw !== null ? String(customKeyRaw) : undefined,
    aiChatbotEnabled: chatbotEnabled,
    aiChatbotName: chatbotName,
    aiChatbotWelcome: chatbotWelcome || null,
    aiChatbotEscalatePhone: chatbotEscalatePhone || null,
  };

  try {
    await saveAiSettings(s.tenantId, s.actor, input);
    revalidatePath("/settings/ai");
    return { success: "AI settings and chatbot preferences updated successfully." };
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    console.error("[saveAiSettingsAction] error", err);
    return { error: "Failed to update AI settings. Please check your inputs." };
  }
}

export async function testGeminiKeyAction(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  await requireAccess("design");
  if (!apiKey.trim()) {
    return { valid: false, error: "Please enter a valid Gemini API key first." };
  }
  return testGeminiApiKey(apiKey.trim());
}
