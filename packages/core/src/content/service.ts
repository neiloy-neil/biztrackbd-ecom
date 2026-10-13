import { Prisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { safeImage } from "../builder/registry";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { sanitizeProductHtml } from "../storefront/html";

/**
 * Pages (delivery policy, about us, size guide) and the blog (docs/06, AdmPagesBlog). Written by staff who can edit store
 * design, shown to everyone, so the text is cleaned on the way in with the same short allow-list as product descriptions.
 * Anything written without tags is turned into paragraphs, so a person who has never seen HTML can still write a page.
 */

export type ContentKind = "page" | "post";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TITLE = 140;
const MAX_BODY = 60_000;

export const slugOf = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain text becomes paragraphs (blank line between them, a single line break kept); anything with tags is cleaned and kept. */
export function bodyToHtml(raw: string): string {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!/<\/?[a-z][^>]*>/i.test(text)) {
    return text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("\n");
  }
  return sanitizeProductHtml(text);
}

export interface ContentInput {
  /** When it should appear, as typed in a date box: 2026-12-01T09:00, in Bangladesh time. Empty: as soon as it is switched on. */
  publishAt?: string;
  title: string;
  slug?: string;
  body: string;
  isPublished: boolean;
  summary?: string;
  coverImage?: string;
  authorName?: string;
  tags?: string;
}

export interface PageRow { id: string; title: string; slug: string; isPublished: boolean; updatedAt: Date; publishAt: Date | null }
export interface PostRow extends PageRow { summary: string | null; coverImage: string | null; authorName: string | null; tags: string[]; createdAt: Date }
export interface ContentDetail extends PostRow { contentHtml: string }

/** "2026-12-01T09:00" in Bangladesh time (UTC+6, no daylight saving) to a moment. Empty means no schedule. */
export function parsePublishAt(v: string | null | undefined): Date | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) throw new ValidationError("Choose a date and time", { field: "publishAt" });
  const d = new Date(`${t}:00+06:00`);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2020 || d.getFullYear() > 2100) throw new ValidationError("Choose a date and time", { field: "publishAt" });
  return d;
}

/** Visible to visitors: switched on, and not scheduled for later. */
const live = (now = new Date()) => ({ isPublished: true, OR: [{ publishAt: null }, { publishAt: { lte: now } }] });

function clean(kind: ContentKind, i: ContentInput) {
  const title = i.title.trim();
  if (title.length < 2 || title.length > MAX_TITLE) throw new ValidationError(`Give it a title of 2 to ${MAX_TITLE} characters`, { field: "title" });
  const slug = (i.slug?.trim() || slugOf(title)).toLowerCase();
  if (!SLUG.test(slug) || slug.length > 80) throw new ValidationError("The address can use small letters, numbers and dashes, like delivery-policy", { field: "slug" });
  if (i.body.length > MAX_BODY) throw new ValidationError("That is too long. Keep it under 60,000 characters.", { field: "body" });
  const contentHtml = bodyToHtml(i.body);
  if (!contentHtml) throw new ValidationError("Write something in the body", { field: "body" });
  const base = { title, slug, contentHtml, isPublished: i.isPublished, publishAt: parsePublishAt(i.publishAt) };
  if (kind === "page") return base;
  const cover = i.coverImage?.trim() ?? "";
  if (!safeImage(cover)) throw new ValidationError("The cover picture must be one you uploaded or an https:// address", { field: "coverImage" });
  const tags = [...new Set((i.tags ?? "").split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean))].slice(0, 8);
  if (tags.some((t) => t.length > 30)) throw new ValidationError("A tag can be up to 30 characters", { field: "tags" });
  return { ...base, summary: (i.summary ?? "").trim().slice(0, 300) || null, coverImage: cover || null, authorName: (i.authorName ?? "").trim().slice(0, 80) || null, tags };
}

type Row = { id: string; title: string; slug: string; isPublished: boolean; publishAt: Date | null; updatedAt: Date; createdAt: Date; contentHtml: string; summary?: string | null; coverImage?: string | null; authorName?: string | null; tags?: string[] };
const rowOf = (r: Row): ContentDetail => ({ id: r.id, title: r.title, slug: r.slug, isPublished: r.isPublished, publishAt: r.publishAt, updatedAt: r.updatedAt, createdAt: r.createdAt, contentHtml: r.contentHtml, summary: r.summary ?? null, coverImage: r.coverImage ?? null, authorName: r.authorName ?? null, tags: r.tags ?? [] });

export async function listContent(tenantId: string, actor: StaffActor, kind: ContentKind): Promise<PostRow[]> {
  assertCan(actor, "design", "view");
  return withTenant(tenantId, async (tx) => {
    const rows: Row[] = kind === "page" ? await tx.page.findMany({ where: { sectionsJson: { equals: Prisma.DbNull } }, orderBy: { updatedAt: "desc" }, take: 200 }) : await tx.blogPost.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return rows.map((r) => {
      const { contentHtml: _drop, ...rest } = rowOf(r);
      void _drop;
      return rest;
    });
  });
}

export async function getContent(tenantId: string, actor: StaffActor, kind: ContentKind, id: string): Promise<ContentDetail> {
  assertCan(actor, "design", "view");
  return withTenant(tenantId, async (tx) => {
    const r: Row | null = kind === "page" ? await tx.page.findFirst({ where: { id } }) : await tx.blogPost.findFirst({ where: { id } });
    if (!r) throw new NotFoundError(kind === "page" ? "Page" : "Post");
    return rowOf(r);
  });
}

export async function saveContent(tenantId: string, actor: StaffActor, kind: ContentKind, id: string | null, input: ContentInput): Promise<{ id: string }> {
  assertCan(actor, "design", "edit");
  const data = clean(kind, input);
  return withTenant(tenantId, async (tx) => {
    try {
      let saved: { id: string };
      if (kind === "page") saved = id ? await tx.page.update({ where: { id }, data }) : await tx.page.create({ data: { tenantId, ...data } });
      else saved = id ? await tx.blogPost.update({ where: { id }, data }) : await tx.blogPost.create({ data: { ...(data as Omit<Prisma.BlogPostUncheckedCreateInput, "tenantId">), tenantId } });
      await audit(tx, tenantId, actor, `${kind === "page" ? "page" : "blog"}.${id ? "saved" : "created"}`, { slug: data.slug, published: data.isPublished });
      return { id: saved.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") throw new ValidationError("You already have one at that address", { field: "slug" });
        if (e.code === "P2025") throw new NotFoundError(kind === "page" ? "Page" : "Post");
      }
      throw e;
    }
  });
}

export async function deleteContent(tenantId: string, actor: StaffActor, kind: ContentKind, id: string): Promise<void> {
  assertCan(actor, "design", "edit");
  await withTenant(tenantId, async (tx) => {
    const gone = kind === "page" ? await tx.page.deleteMany({ where: { id } }) : await tx.blogPost.deleteMany({ where: { id } });
    if (gone.count === 0) throw new NotFoundError(kind === "page" ? "Page" : "Post");
    await audit(tx, tenantId, actor, `${kind === "page" ? "page" : "blog"}.deleted`, { id });
  });
}

// ---- What visitors see --------------------------------------------------------------------------------------------------

export interface PublicPage { title: string; slug: string; contentHtml: string; updatedAt: Date }
export interface PublicPost extends PublicPage { summary: string | null; coverImage: string | null; authorName: string | null; tags: string[]; createdAt: Date }

export async function getPublishedPage(tenantId: string, slug: string): Promise<PublicPage | null> {
  return withTenant(tenantId, (tx) => tx.page.findFirst({ where: { slug, ...live() }, select: { title: true, slug: true, contentHtml: true, updatedAt: true } }));
}
export async function listFooterPages(tenantId: string): Promise<{ title: string; slug: string }[]> {
  return withTenant(tenantId, (tx) => tx.page.findMany({ where: live(), orderBy: { title: "asc" }, take: 8, select: { title: true, slug: true } }));
}
export async function listPublishedPosts(tenantId: string, opts: { page?: number; pageSize?: number } = {}): Promise<{ items: PublicPost[]; total: number }> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 12, 1), 50);
  const skip = (Math.max(opts.page ?? 1, 1) - 1) * pageSize;
  return withTenant(tenantId, async (tx) => {
    const where = live();
    const [rows, total] = await Promise.all([tx.blogPost.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }), tx.blogPost.count({ where })]);
    return { items: rows.map((r) => ({ title: r.title, slug: r.slug, contentHtml: r.contentHtml, updatedAt: r.updatedAt, summary: r.summary, coverImage: r.coverImage, authorName: r.authorName, tags: r.tags, createdAt: r.createdAt })), total };
  });
}
export async function getPublishedPost(tenantId: string, slug: string): Promise<PublicPost | null> {
  return withTenant(tenantId, async (tx) => {
    const r = await tx.blogPost.findFirst({ where: { slug, ...live() } });
    return r ? { title: r.title, slug: r.slug, contentHtml: r.contentHtml, updatedAt: r.updatedAt, summary: r.summary, coverImage: r.coverImage, authorName: r.authorName, tags: r.tags, createdAt: r.createdAt } : null;
  });
}
export async function listContentSlugs(tenantId: string): Promise<{ pages: { slug: string; updatedAt: Date }[]; posts: { slug: string; updatedAt: Date }[] }> {
  return withTenant(tenantId, async (tx) => ({
    pages: await tx.page.findMany({ where: live(), select: { slug: true, updatedAt: true } }),
    posts: await tx.blogPost.findMany({ where: live(), select: { slug: true, updatedAt: true } }),
  }));
}
