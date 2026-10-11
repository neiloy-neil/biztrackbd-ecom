"use server";

import { revalidatePath } from "next/cache";
import { DomainError, PROVIDERS, removeIntegration, saveIntegration, testCourierConnection, type ProviderKey } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface SaveState {
  ok?: boolean;
  error?: string;
}

/** Secret fields arrive from the form and go straight to the vault. They are never echoed back in the state. */
export async function saveIntegrationAction(provider: ProviderKey, _prev: SaveState, form: FormData): Promise<SaveState> {
  const s = await requireAction("billing", "edit");
  const spec = PROVIDERS[provider];
  const pick = (names: readonly string[]) => Object.fromEntries(names.map((n) => [n, String(form.get(n) ?? "")]));
  try {
    await saveIntegration(s.tenantId, {
      provider,
      mode: String(form.get("mode") ?? "LIVE"),
      secrets: pick(spec.secrets),
      config: pick(spec.config),
    }, undefined, s.actor);
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("saveIntegration failed", e instanceof Error ? e.name : "unknown");
    return { error: "Could not save. Nothing was changed." };
  }
  revalidatePath("/settings/integrations");
  return { ok: true };
}

export async function removeIntegrationAction(provider: ProviderKey, mode: string): Promise<void> {
  const s = await requireAction("billing", "edit");
  await removeIntegration(s.tenantId, provider, mode, s.actor);
  revalidatePath("/settings/integrations");
}

export interface TestState {
  ok?: boolean;
  error?: string;
}

/** Calls the courier with the saved keys and records whether they were accepted. The keys never leave the server. */
export async function testConnectionAction(provider: ProviderKey, mode: "TEST" | "LIVE", _prev: TestState): Promise<TestState> {
  const s = await requireAction("billing", "edit");
  try {
    const r = await testCourierConnection(s.tenantId, s.actor, provider, mode);
    revalidatePath("/settings/integrations");
    return r.ok ? { ok: true } : { error: r.error };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("test connection failed", e instanceof Error ? e.name : "unknown");
    return { error: "The test could not run." };
  }
}
