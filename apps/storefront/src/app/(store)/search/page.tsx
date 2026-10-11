import type { Metadata } from "next";
import { listProducts } from "@biztrackbd/core";
import { Listing, parsePage, parseSort } from "@/components/listing";
import { getLang, makeT } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; sort?: string; page?: string; sale?: string }> };

// Search result pages are thin content and endless variations: keep them out of search engines.
export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: Props) {
  const [sp, store] = await Promise.all([searchParams, getStore()]);
  const lang = await getLang(store.locale);
  const t = makeT(lang);
  const q = (sp.q ?? "").trim().slice(0, 80);
  const sort = parseSort(sp.sort);
  const onSale = sp.sale === "1";
  const result = await listProducts(store.id, { query: q || undefined, sort, page: parsePage(sp.page), limit: 24, onSale });
  return (
    <div className="wrap">
      <h1 className="page-title">{q ? t("resultsFor", { q }) : onSale ? t("sale") : t("all")}</h1>
      <Listing result={result} lang={lang} t={t} basePath="/search" params={{ ...(q ? { q } : {}), ...(onSale ? { sale: "1" } : {}) }} sort={sort} />
    </div>
  );
}
