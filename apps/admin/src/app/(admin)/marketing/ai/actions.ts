"use server";

import {
  generateSocialPost,
  generateSmsCampaignCopy,
  generateBannerCopy,
  generateWhatsAppBroadcast,
  type CopywriterOptions,
  type GeneratedSocialPost,
  type GeneratedSmsCampaign,
  type GeneratedBannerCopy,
  type GeneratedWhatsAppBroadcast,
  DomainError,
} from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function generateSocialPostAction(
  options: CopywriterOptions
): Promise<ActionResult<GeneratedSocialPost>> {
  const s = await requireAccess("marketing");
  try {
    const data = await generateSocialPost(s.tenantId, s.actor, options);
    return { success: true, data };
  } catch (err) {
    if (err instanceof DomainError) return { success: false, error: err.message };
    console.error("[generateSocialPostAction] error", err);
    return { success: false, error: "Failed to generate social post. Please try again." };
  }
}

export async function generateSmsCampaignAction(
  options: CopywriterOptions
): Promise<ActionResult<GeneratedSmsCampaign>> {
  const s = await requireAccess("marketing");
  try {
    const data = await generateSmsCampaignCopy(s.tenantId, s.actor, options);
    return { success: true, data };
  } catch (err) {
    if (err instanceof DomainError) return { success: false, error: err.message };
    console.error("[generateSmsCampaignAction] error", err);
    return { success: false, error: "Failed to generate SMS copy. Please try again." };
  }
}

export async function generateBannerCopyAction(
  options: CopywriterOptions
): Promise<ActionResult<GeneratedBannerCopy>> {
  const s = await requireAccess("marketing");
  try {
    const data = await generateBannerCopy(s.tenantId, s.actor, options);
    return { success: true, data };
  } catch (err) {
    if (err instanceof DomainError) return { success: false, error: err.message };
    console.error("[generateBannerCopyAction] error", err);
    return { success: false, error: "Failed to generate banner copy. Please try again." };
  }
}

export async function generateWhatsAppBroadcastAction(
  options: CopywriterOptions
): Promise<ActionResult<GeneratedWhatsAppBroadcast>> {
  const s = await requireAccess("marketing");
  try {
    const data = await generateWhatsAppBroadcast(s.tenantId, s.actor, options);
    return { success: true, data };
  } catch (err) {
    if (err instanceof DomainError) return { success: false, error: err.message };
    console.error("[generateWhatsAppBroadcastAction] error", err);
    return { success: false, error: "Failed to generate WhatsApp broadcast. Please try again." };
  }
}
