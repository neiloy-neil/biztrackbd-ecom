import { coverUrlFor, getBlogPosts, plainText } from "@/lib/blog";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const revalidate = 3600;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RSS feed of the published guides, so readers and aggregators can follow new posts. */
export async function GET() {
  const posts = await getBlogPosts();
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${siteUrl}/blog/${p.slug}</link>
      <guid isPermaLink="true">${siteUrl}/blog/${p.slug}</guid>
      <pubDate>${p.publishedAt.toUTCString()}</pubDate>
      <description>${esc(p.description)}</description>
      <enclosure url="${esc(coverUrlFor(p, siteUrl))}" length="0" type="${p.coverImage ? (/\.webp$/i.test(p.coverImage) ? "image/webp" : /\.png$/i.test(p.coverImage) ? "image/png" : "image/jpeg") : "image/png"}" />
      <content:encoded><![CDATA[${plainText(p.body).replace(/]]>/g, "]]&gt;")}]]></content:encoded>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>BizTrackBD Guides</title>
    <link>${siteUrl}/blog</link>
    <description>Practical guides for Bangladesh online sellers.</description>
    <language>en</language>
    <atom:link href="${siteUrl}/blog/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
