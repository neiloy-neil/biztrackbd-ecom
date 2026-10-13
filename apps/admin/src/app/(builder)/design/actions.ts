"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, DraftConflictError, activateTheme, applyTemplateUpdate, discardChromeDraft, publishChrome, rollbackChrome, saveChromeDraft, discardDraft, publish, rollback, saveDraft } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export type EditResult = { ok: true; version?: number; stamp?: string } | { ok: false; error: string; conflict?: { stamp: string | null } };

const fail = (e: unknown): EditResult => {
  if (e instanceof DraftConflictError) return { ok: false, error: e.message, conflict: { stamp: e.stamp } };
  if (e instanceof DomainError) return { ok: false, error: e.message };
  console.error("design action failed", e instanceof Error ? e.name : "unknown");
  return { ok: false, error: "Something went wrong. Your change was not saved." };
};

/** Autosave from the editor. The page is checked again on the server, so a draft is always publishable. */
export async function saveDraftAction(pageKey: string, page: unknown, theme: unknown, stamp?: string | null): Promise<EditResult> {
  const s = await requireAction("design", "edit");
  try {
    const saved = await saveDraft(s.tenantId, s.actor, pageKey, page, pageKey === "home" ? theme : undefined, stamp === undefined ? undefined : { stamp });
    return { ok: true, stamp: saved.stamp };
  } catch (e) {
    return fail(e);
  }
}

export async function publishAction(pageKey: string, label: string): Promise<EditResult> {
  const s = await requireAction("design", "edit");
  try {
    const version = await publish(s.tenantId, s.actor, pageKey, label);
    revalidatePath("/design");
    revalidatePath("/landing");
    return { ok: true, version };
  } catch (e) {
    return fail(e);
  }
}

export async function discardDraftAction(pageKey: string): Promise<EditResult> {
  const s = await requireAction("design", "edit");
  try {
    await discardDraft(s.tenantId, s.actor, pageKey);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function rollbackAction(pageKey: string, version: number): Promise<EditResult> {
  const s = await requireAction("design", "edit");
  try {
    return { ok: true, version: await rollback(s.tenantId, s.actor, pageKey, version) };
  } catch (e) {
    return fail(e);
  }
}

export async function activateThemeAction(form: FormData): Promise<void> {
  const s = await requireAction("design", "edit");
  await activateTheme(s.tenantId, s.actor, form.get("themeId"));
  revalidatePath("/design");
  revalidatePath("/", "layout");
}

/** Takes the newer version of the store's template as drafts. Nothing goes live until the owner publishes each page from the editor. */
export async function applyTemplateUpdateAction(): Promise<void> {
  const s = await requireAction("design", "edit");
  try {
    await applyTemplateUpdate(s.tenantId, s.actor);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/design?note=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/design");
  redirect("/design?note=applied");
}

// ---- The header and footer (docs/47 part C): the same draft, publish and go-back steps as a page.

/** Autosave from the header and footer editor. The record is checked again on the server, so a draft is always publishable. */
export async function saveChromeAction(chrome: unknown, stamp?: string | null): Promise<EditResult> {
  const s = await requireAction("design", "edit");
  try {
    const saved = await saveChromeDraft(s.tenantId, s.actor, chrome, stamp === undefined ? undefined : { stamp });
    return { ok: true, stamp: saved.stamp };
  } catch (e) {
    return fail(e);
  }
}

export async function publishChromeAction(label: string): Promise<EditResult> {
  const s = await requireAction("design", "edit");
  try {
    const version = await publishChrome(s.tenantId, s.actor, label);
    revalidatePath("/design");
    return { ok: true, version };
  } catch (e) {
    return fail(e);
  }
}

export async function discardChromeAction(): Promise<EditResult> {
  const s = await requireAction("design", "edit");
  try {
    await discardChromeDraft(s.tenantId, s.actor);
    revalidatePath("/design");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function rollbackChromeAction(version: number): Promise<EditResult> {
  const s = await requireAction("design", "edit");
  try {
    const next = await rollbackChrome(s.tenantId, s.actor, version);
    revalidatePath("/design");
    return { ok: true, version: next };
  } catch (e) {
    return fail(e);
  }
}
