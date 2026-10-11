import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listCategories, listProducts } from "@biztrackbd/core";
import { Listing, parsePage, parseSort } from "@/components/listing";
import { getLang, makeT } from "@/lib/i18n";
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
  const cat = (await listCategories(store.id)).find((c) => c.slug === slug);
  if (!cat) notFound();
  const lang = await getLang(store.locale);
  const sort = parseSort(sp.sort);
  const result = await listProducts(store.id, { categorySlug: slug, sort, page: parsePage(sp.page) });
  return (
    <div className="wrap">
      <h1 className="page-title">{cat.name}</h1>
      <Listing result={result} lang={lang} t={makeT(lang)} basePath={`/c/${slug}`} params={{}} sort={sort} />
    </div>
  );
}
