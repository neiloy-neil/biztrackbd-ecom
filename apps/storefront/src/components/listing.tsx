import Link from "next/link";
import type { ProductSort, listProducts } from "@biztrackbd/core";
import type { Lang, T } from "@/lib/i18n-core";
import { num } from "@/lib/i18n-core";
import { ProductCard } from "./product-card";

type Page = Awaited<ReturnType<typeof listProducts>>;

/** The grid, sort control and pager shared by category and search pages. Plain links and a GET form: no client JavaScript. */
export function Listing({ result, lang, t, basePath, params, sort }: { result: Page; lang: Lang; t: T; basePath: string; params: Record<string, string>; sort: ProductSort }) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (page: number) => {
    const q = new URLSearchParams({ ...params, ...(sort !== "newest" ? { sort } : {}), ...(page > 1 ? { page: String(page) } : {}) });
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <>
      <form action={basePath} className="toolbar" method="get">
        {Object.entries(params).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <span className="muted">{num(result.total, lang)} {lang === "bn" ? "টি পণ্য" : result.total === 1 ? "product" : "products"}</span>
        <label>
          <span className="sr-only">{t("sortBy")}</span>
          <select className="select" name="sort" defaultValue={sort} aria-label={t("sortBy")}>
            <option value="newest">{t("sortNewest")}</option>
            <option value="price_asc">{t("sortPriceAsc")}</option>
            <option value="price_desc">{t("sortPriceDesc")}</option>
          </select>
        </label>
        <noscript><button className="btn btn-ghost" type="submit" style={{ minHeight: 44 }}>{t("sortBy")}</button></noscript>
      </form>
      {result.items.length === 0 ? (
        <div className="empty">{t("noProducts")}</div>
      ) : (
        <div className="grid grid-4">
          {result.items.map((p, i) => <ProductCard key={p.id} p={p} lang={lang} t={t} priority={i < 2} />)}
        </div>
      )}
      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          {result.page > 1 ? <Link className="btn btn-ghost" href={href(result.page - 1)} rel="prev">{t("previous")}</Link> : <span />}
          <span className="muted">{t("page", { n: num(result.page, lang), total: num(pages, lang) })}</span>
          {result.page < pages ? <Link className="btn btn-ghost" href={href(result.page + 1)} rel="next">{t("next")}</Link> : <span />}
        </nav>
      )}
    </>
  );
}

export const parseSort = (v: string | undefined): ProductSort => (v === "price_asc" || v === "price_desc" ? v : "newest");
export const parsePage = (v: string | undefined) => Math.min(Math.max(parseInt(v ?? "1", 10) || 1, 1), 500);
