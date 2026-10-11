import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listCategories, loadPageData } from "@biztrackbd/core";
import { parsePage, parseSort } from "@/components/listing";
import { Sections } from "@/components/sections";
import { getLang, makeT } from "@/lib/i18n";
import { getPageLayout, loadCollectionCtx } from "@/lib/page-layout";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore();
  const cat = (await listCategories(store.id)).find((c) => c.slug === slug);
  return cat ? { title: cat.name, alternates: { canonical: `/c/${slug}` } } : { title: "Not found" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp, store] = await Promise.all([params, searchParams, getStore()]);
  const [collection, lang, layout] = await Promise.all([loadCollectionCtx(store.id, slug, parseSort(sp.sort), parsePage(sp.page)), getLang(store.locale), getPageLayout(store.id, "collection")]);
  if (!collection) notFound();
  const data = await loadPageData(store.id, layout);
  return <Sections page={layout} data={data} lang={lang} t={makeT(lang)} ctx={{ collection }} />;
}
