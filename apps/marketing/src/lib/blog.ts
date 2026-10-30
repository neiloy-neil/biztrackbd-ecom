import { cache } from "react";
import { STARTER_BLOG_POSTS, listPublishedBlogPosts, type PublicBlogPost } from "@biztrackbd/core";

export type BlogPost = PublicBlogPost;

const STARTED = new Date("2026-10-30T00:00:00.000Z");

/**
 * The starter guides are also saved in the database, where staff edit them. This copy only shows when the database has no published
 * post or cannot be read, so the blog is never empty.
 */
const FALLBACK_POSTS: BlogPost[] = STARTER_BLOG_POSTS.map((p) => ({
  ...p,
  seoTitle: null,
  seoDescription: null,
  coverImage: null,
  coverAlt: null,
  noindex: false,
  publishedAt: STARTED,
  updatedAt: STARTED,
}));

/** Every published post, including ones hidden from Google, newest first; the starter guides if there are none. Cached per request. */
const getAllPosts = cache(async (): Promise<BlogPost[]> => {
  const posts = await listPublishedBlogPosts();
  return posts.length > 0 ? posts : FALLBACK_POSTS;
});

/** The posts the site lists, links to and puts in its sitemap and feed: everything except guides marked noindex. */
export const getBlogPosts = cache(async (): Promise<BlogPost[]> => (await getAllPosts()).filter((p) => !p.noindex));

/** One guide by link name. A noindex guide still opens by its link; it is just not listed or promoted. */
export async function getBlogPost(slug: string): Promise<BlogPost | undefined> {
  return (await getAllPosts()).find((p) => p.slug === slug);
}

/** The picture for a guide: the one staff uploaded, or the cover the site draws from its title. Always an absolute address. */
export function coverUrlFor(post: BlogPost, siteUrl: string): string {
  if (!post.coverImage) return `${siteUrl}/blog/${post.slug}/opengraph-image`;
  return post.coverImage.startsWith("/") ? `${siteUrl}${post.coverImage}` : post.coverImage;
}

/** Other guides to link from the bottom of a post: internal links that keep readers and crawlers moving. */
export async function getRelatedPosts(slug: string, limit = 3): Promise<BlogPost[]> {
  return (await getBlogPosts()).filter((p) => p.slug !== slug).slice(0, limit);
}

export type InlineNode = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };
export type BlogBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; nodes: InlineNode[] }
  | { kind: "img"; alt: string; src: string };

/** Only site links and https links are allowed in an article. Anything else stays as plain text. */
const safeHref = (href: string) => (href.startsWith("/") && !href.startsWith("//")) || /^https:\/\/\S+$/i.test(href);

/** Splits a paragraph into text and [label](link) pieces. Nothing is treated as HTML. */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const re = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!safeHref(m[2] ?? "")) continue;
    if (m.index > last) nodes.push({ kind: "text", text: text.slice(last, m.index) });
    nodes.push({ kind: "link", text: m[1] ?? "", href: m[2] ?? "" });
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push({ kind: "text", text: text.slice(last) });
  return nodes;
}

/** Plain text to blocks: a blank line ends a paragraph, "## " and "### " start headings, a line that is only ![alt](src) is a picture. */
export function parseBlogBody(body: string): BlogBlock[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): BlogBlock => {
      if (chunk.startsWith("## ")) return { kind: "h2", text: chunk.slice(3).trim() };
      if (chunk.startsWith("### ")) return { kind: "h3", text: chunk.slice(4).trim() };
      const img = chunk.match(/^!\[([^\]\n]*)\]\(([^)\s]+)\)$/);
      if (img && safeHref(img[2] ?? "")) return { kind: "img", alt: img[1] ?? "", src: img[2] ?? "" };
      return { kind: "p", nodes: parseInline(chunk) };
    });
}

/** The article as plain words, for counting and for the structured data. */
export function plainText(body: string): string {
  return body
    .replace(/!\[[^\]\n]*\]\([^)\s]+\)\n*/g, "")
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
    .replace(/^#{2,3} /gm, "");
}

export function wordCount(body: string): number {
  return plainText(body).split(/\s+/).filter(Boolean).length;
}

/** About 200 words a minute, never below one. */
export const readingMinutes = (body: string) => Math.max(1, Math.round(wordCount(body) / 200));
