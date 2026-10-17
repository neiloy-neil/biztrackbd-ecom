"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  executeModeTransition,
  validateModeTransitionDryRun,
  type ModeTransitionDryRunResult,
  type SiteMode,
  type BusinessVertical,
  DomainError,
  ForbiddenError,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface FormState {
  error?: string;
  field?: string;
  ok?: boolean;
}

export async function getModeDryRunAction(
  targetMode: string,
  targetVertical?: string | null
): Promise<ModeTransitionDryRunResult | null> {
  const s = await requireAction("design", "view");
  try {
    return await validateModeTransitionDryRun(
      s.tenantId,
      targetMode as SiteMode,
      targetVertical ? (targetVertical as BusinessVertical) : null
    );
  } catch (e) {
    console.error("Dry run error:", e);
    return null;
  }
}

export async function executeMerchantModeTransitionAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const s = await requireAction("design", "edit");

  // Only store owner or store manager may change operational mode
  if (s.user.role !== "STORE_OWNER" && s.user.role !== "STORE_MANAGER") {
    throw new ForbiddenError();
  }

  const targetMode = String(formData.get("targetMode") ?? "PORTFOLIO") as SiteMode;
  const targetVerticalRaw = formData.get("targetVertical");
  const targetVertical = targetVerticalRaw ? (String(targetVerticalRaw) as BusinessVertical) : null;
  const reason = String(formData.get("reason") ?? "").trim();
  const confirmedConsent =
    formData.get("confirmedConsent") === "on" || formData.get("confirmedConsent") === "true";

  try {
    await executeModeTransition(s.tenantId, s.actor, {
      targetMode,
      targetVertical,
      reason,
      confirmedConsent,
    });
  } catch (e) {
    if (e instanceof DomainError) {
      return {
        error: e.message,
        field: typeof e.details?.field === "string" ? e.details.field : undefined,
      };
    }
    throw e;
  }

  revalidatePath("/settings/mode");
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath("/orders");

  redirect("/settings/mode?done=mode_transitioned");
}
