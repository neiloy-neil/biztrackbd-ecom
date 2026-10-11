import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPage } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore();
  const page = await getPublishedPage(store.id, slug);
  return page ? { title: page.title, alternates: { canonical: `/p/${slug}` } } : { title: "Not found", robots: { index: false } };
}

/** A store page such as the delivery policy. The text was cleaned when it was saved. */
export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore();
  const page = await getPublishedPage(store.id, slug);
  if (!page) notFound();
  return (
    <article className="wrap" style={{ padding: "28px var(--gutter) 56px" }} data-testid="store-page">
      <h1 className="page-title" style={{ paddingTop: 0 }}>{page.title}</h1>
      <div className="prose" dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
    </article>
  );
}
