"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteBlogPost, saveBlogPost, DomainError } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface BlogFormState {
  error?: string;
  field?: string;
  values?: Record<string, string>;
  noindex?: boolean;
}

const FIELDS = ["slug", "title", "description", "body", "ctaLabel", "ctaHref", "publishedAt", "seoTitle", "seoDescription", "coverImage", "coverAlt"] as const;

/** Saves a post. `intent` is "draft" or "publish"; the editor has one button for each. */
export async function saveBlogPostAction(id: string | null, _prev: BlogFormState, formData: FormData): Promise<BlogFormState> {
  const s = await requireAction("blog", "edit");
  const values = {} as Record<(typeof FIELDS)[number], string>;
  for (const f of FIELDS) values[f] = String(formData.get(f) ?? "");
  const noindex = formData.get("noindex") === "on";
  const publish = formData.get("intent") === "publish";

  let publishedAt: Date | null = null;
  if (values.publishedAt.trim()) {
    // The picker gives a wall-clock time with no zone; read it as Dhaka time (UTC+6) whatever zone the server runs in.
    publishedAt = new Date(`${values.publishedAt.trim()}:00+06:00`);
    if (Number.isNaN(publishedAt.getTime())) return { error: "That publish date is not valid", field: "publishedAt", values, noindex };
  }

  let savedId: string;
  try {
    const saved = await saveBlogPost(s.actor, id, {
      slug: values.slug, title: values.title, description: values.description, body: values.body,
      ctaLabel: values.ctaLabel, ctaHref: values.ctaHref, seoTitle: values.seoTitle, seoDescription: values.seoDescription,
      coverImage: values.coverImage, coverAlt: values.coverAlt, noindex, publishedAt, publish,
    });
    savedId = saved.id;
  } catch (err) {
    if (err instanceof DomainError) {
      const field = (err as { details?: { field?: string } }).details?.field;
      return { error: err.message, field, values, noindex };
    }
    throw err;
  }

  revalidatePath("/blog");
  redirect(`/blog/${savedId}?saved=${publish ? "published" : "draft"}`);
}

export async function deleteBlogPostAction(id: string) {
  const s = await requireAction("blog", "edit");
  await deleteBlogPost(s.actor, id);
  revalidatePath("/blog");
  redirect("/blog?deleted=1");
}
