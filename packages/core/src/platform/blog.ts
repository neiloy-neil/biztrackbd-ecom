import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { NotFoundError, ValidationError } from "../errors";

export type BlogPostStatus = "DRAFT" | "PUBLISHED";

export interface BlogPostView {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  coverImage: string | null;
  coverAlt: string | null;
  noindex: boolean;
  status: BlogPostStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlogPostInput {
  slug: string;
  title: string;
  description: string;
  body: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  coverImage?: string | null;
  coverAlt?: string | null;
  noindex?: boolean;
  /** Used with publish: a future date schedules the post. Empty keeps the earlier date, or now for a first publish. */
  publishedAt?: Date | null;
  publish: boolean;
}

interface Deps {
  db?: PrismaClient;
}
const dbOf = (d?: Deps) => d?.db ?? getPlatformPrisma();

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set(["new", "page", "feed"]);

type Row = {
  id: string; slug: string; title: string; description: string; body: string; ctaLabel: string | null; ctaHref: string | null;
  seoTitle: string | null; seoDescription: string | null; coverImage: string | null; coverAlt: string | null; noindex: boolean;
  status: string; publishedAt: Date | null; createdAt: Date; updatedAt: Date;
};
const view = (r: Row): BlogPostView => ({
  id: r.id, slug: r.slug, title: r.title, description: r.description, body: r.body, ctaLabel: r.ctaLabel, ctaHref: r.ctaHref,
  seoTitle: r.seoTitle, seoDescription: r.seoDescription, coverImage: r.coverImage, coverAlt: r.coverAlt, noindex: r.noindex,
  status: r.status as BlogPostStatus, publishedAt: r.publishedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

/** A button link must stay on the site ("/pricing") or be a full https address. */
function cleanHref(href: string | null | undefined): string | null {
  const h = href?.trim();
  if (!h) return null;
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (/^https:\/\/\S+$/i.test(h)) return h;
  throw new ValidationError("Button link must start with / or https://", { field: "ctaHref" });
}

/** A cover must be a picture on the site ("/blog/cover.webp") or an https address. */
function cleanImage(src: string | null | undefined): string | null {
  const v = src?.trim();
  if (!v) return null;
  if (v.length > 500) throw new ValidationError("Cover image address is too long", { field: "coverImage" });
  if ((v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/\S+$/i.test(v)) return v;
  throw new ValidationError("Cover image must start with / or https://", { field: "coverImage" });
}

function validate(input: BlogPostInput) {
  const slug = input.slug.trim().toLowerCase();
  const title = input.title.trim();
  const description = input.description.trim();
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (!SLUG.test(slug) || RESERVED.has(slug)) {
    throw new ValidationError("Use a link name with lowercase letters, numbers and hyphens, like stop-cod-fraud", { field: "slug" });
  }
  if (title.length < 5 || title.length > 120) throw new ValidationError("Title must be 5 to 120 characters", { field: "title" });
  if (description.length < 30 || description.length > 170) {
    throw new ValidationError("Description must be 30 to 170 characters (it shows in Google)", { field: "description" });
  }
  if (body.length < 200) throw new ValidationError("Write at least a few paragraphs before saving", { field: "body" });
  const ctaLabel = input.ctaLabel?.trim() || null;
  const ctaHref = cleanHref(input.ctaHref);
  if (Boolean(ctaLabel) !== Boolean(ctaHref)) throw new ValidationError("Give the button both a label and a link, or neither", { field: "ctaLabel" });

  const seoTitle = input.seoTitle?.trim() || null;
  if (seoTitle && (seoTitle.length < 10 || seoTitle.length > 60)) {
    throw new ValidationError("SEO title must be 10 to 60 characters (the site adds | BizTrackBD after it)", { field: "seoTitle" });
  }
  const seoDescription = input.seoDescription?.trim() || null;
  if (seoDescription && (seoDescription.length < 30 || seoDescription.length > 170)) {
    throw new ValidationError("SEO description must be 30 to 170 characters", { field: "seoDescription" });
  }
  const coverImage = cleanImage(input.coverImage);
  const coverAlt = input.coverAlt?.trim() || null;
  if (coverAlt && coverAlt.length > 160) throw new ValidationError("Cover image description must be 160 characters or fewer", { field: "coverAlt" });
  if (coverImage && !coverAlt) throw new ValidationError("Describe the cover image in a few words (it is read aloud and shown if the picture fails)", { field: "coverAlt" });
  return { slug, title, description, body, ctaLabel, ctaHref, seoTitle, seoDescription, coverImage, coverAlt, noindex: Boolean(input.noindex) };
}

export async function listBlogPosts(actor: PlatformActor, deps?: Deps): Promise<BlogPostView[]> {
  assertPlatformCan(actor, "blog", "view");
  const rows = await dbOf(deps).platformBlogPost.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map(view);
}

export async function getBlogPostForEdit(actor: PlatformActor, id: string, deps?: Deps): Promise<BlogPostView> {
  assertPlatformCan(actor, "blog", "view");
  const row = await dbOf(deps).platformBlogPost.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Post not found");
  return view(row);
}

/** Creates a post (id null) or updates one. Saving without publish turns a live post back into a draft. */
export async function saveBlogPost(actor: PlatformActor, id: string | null, input: BlogPostInput, deps?: Deps): Promise<BlogPostView> {
  assertPlatformCan(actor, "blog", "edit");
  const db = dbOf(deps);
  const clean = validate(input);
  const taken = await db.platformBlogPost.findUnique({ where: { slug: clean.slug }, select: { id: true } });
  if (taken && taken.id !== id) throw new ValidationError("Another post already uses that link name", { field: "slug" });

  const existing = id ? await db.platformBlogPost.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new NotFoundError("Post not found");

  const status: BlogPostStatus = input.publish ? "PUBLISHED" : "DRAFT";
  const publishedAt = input.publish ? input.publishedAt ?? existing?.publishedAt ?? new Date() : null;

  const row = existing
    ? await db.platformBlogPost.update({ where: { id: existing.id }, data: { ...clean, status, publishedAt, updatedBy: actor.email } })
    : await db.platformBlogPost.create({ data: { ...clean, status, publishedAt, createdBy: actor.email } });

  await db.platformAuditLog.create({
    data: { actorId: actor.id, action: existing ? "BLOG_POST_UPDATED" : "BLOG_POST_CREATED", details: { slug: row.slug, status }, ipAddress: actor.ip },
  });
  return view(row);
}

export async function deleteBlogPost(actor: PlatformActor, id: string, deps?: Deps): Promise<void> {
  assertPlatformCan(actor, "blog", "edit");
  const db = dbOf(deps);
  const row = await db.platformBlogPost.findUnique({ where: { id }, select: { slug: true } });
  if (!row) throw new NotFoundError("Post not found");
  await db.platformBlogPost.delete({ where: { id } });
  await db.platformAuditLog.create({ data: { actorId: actor.id, action: "BLOG_POST_DELETED", details: { slug: row.slug }, ipAddress: actor.ip } });
}

// ---- Public reads (the marketing site) -------------------------------------------------------------------------------

export interface PublicBlogPost {
  slug: string;
  title: string;
  description: string;
  body: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  coverImage: string | null;
  coverAlt: string | null;
  noindex: boolean;
  publishedAt: Date;
  updatedAt: Date;
}

const publicWhere = () => ({ status: "PUBLISHED" as const, publishedAt: { lte: new Date() } });
const pub = (r: Row): PublicBlogPost => ({
  slug: r.slug, title: r.title, description: r.description, body: r.body, ctaLabel: r.ctaLabel, ctaHref: r.ctaHref,
  seoTitle: r.seoTitle, seoDescription: r.seoDescription, coverImage: r.coverImage, coverAlt: r.coverAlt, noindex: r.noindex,
  publishedAt: r.publishedAt ?? r.createdAt, updatedAt: r.updatedAt,
});

/** Published posts, newest first. Empty if the database cannot be read, so the site still renders. */
export async function listPublishedBlogPosts(deps?: Deps): Promise<PublicBlogPost[]> {
  try {
    const rows = await dbOf(deps).platformBlogPost.findMany({ where: publicWhere(), orderBy: { publishedAt: "desc" } });
    return rows.map(pub);
  } catch {
    return [];
  }
}

export async function getPublishedBlogPost(slug: string, deps?: Deps): Promise<PublicBlogPost | null> {
  try {
    const row = await dbOf(deps).platformBlogPost.findFirst({ where: { slug, ...publicWhere() } });
    return row ? pub(row) : null;
  } catch {
    return null;
  }
}
