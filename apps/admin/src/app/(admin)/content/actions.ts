"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, deleteContent, saveContent, type ContentKind } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const tabOf = (kind: ContentKind) => (kind === "page" ? "pages" : "posts");
const back = (kind: ContentKind, params: Record<string, string>): never => redirect(`/content?${new URLSearchParams({ tab: tabOf(kind), ...params })}`);
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function saveContentAction(kind: ContentKind, id: string | null, f: FormData): Promise<void> {
  const s = await requireAction("design", "edit");
  let saved: { id: string };
  try {
    saved = await saveContent(s.tenantId, s.actor, kind, id, {
      title: str(f, "title"), slug: str(f, "slug") || undefined, body: str(f, "body"), isPublished: f.get("isPublished") === "on", publishAt: str(f, "publishAt"),
      summary: str(f, "summary"), coverImage: str(f, "coverImage"), authorName: str(f, "authorName"), tags: str(f, "tags"),
    });
  } catch (e) {
    if (e instanceof DomainError) return back(kind, { edit: id ?? "new", err: e.message });
    throw e;
  }
  revalidatePath("/content");
  back(kind, { edit: saved.id, done: "saved" });
}

export async function deleteContentAction(kind: ContentKind, id: string): Promise<void> {
  const s = await requireAction("design", "edit");
  try {
    await deleteContent(s.tenantId, s.actor, kind, id);
  } catch (e) {
    if (e instanceof DomainError) return back(kind, { err: e.message });
    throw e;
  }
  revalidatePath("/content");
  back(kind, { done: "deleted" });
}
