"use server";

import { revalidatePath } from "next/cache";
import { getBasePrisma } from "@biztrackbd/db";
import {
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  type CreateApiKeyResult,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface CreateKeyActionState {
  ok: boolean;
  error?: string;
  result?: CreateApiKeyResult;
}

export async function createApiKeyAction(
  _prev: CreateKeyActionState,
  formData: FormData
): Promise<CreateKeyActionState> {
  const s = await requireAction("billing", "edit");
  const name = String(formData.get("name") || "").trim();
  const environment = String(formData.get("environment") || "LIVE") === "TEST" ? "TEST" : "LIVE";
  const scopes = formData.getAll("scopes").map(String);

  if (!name) {
    return { ok: false, error: "API key name is required." };
  }

  if (scopes.length === 0) {
    return { ok: false, error: "Please select at least one permission scope." };
  }

  try {
    const result = await createApiKey(getBasePrisma(), {
      tenantId: s.tenantId,
      name,
      environment,
      scopes,
    });

    revalidatePath("/settings/developer");
    return { ok: true, result };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to create API key." };
  }
}

export async function revokeApiKeyAction(apiKeyId: string): Promise<{ ok: boolean; error?: string }> {
  const s = await requireAction("billing", "edit");
  try {
    const success = await revokeApiKey(getBasePrisma(), s.tenantId, apiKeyId);
    revalidatePath("/settings/developer");
    return { ok: success };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to revoke API key." };
  }
}

export async function deleteApiKeyAction(apiKeyId: string): Promise<{ ok: boolean; error?: string }> {
  const s = await requireAction("billing", "edit");
  try {
    const success = await deleteApiKey(getBasePrisma(), s.tenantId, apiKeyId);
    revalidatePath("/settings/developer");
    return { ok: success };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to delete API key." };
  }
}
