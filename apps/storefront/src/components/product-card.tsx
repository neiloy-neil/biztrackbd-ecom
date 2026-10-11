import Link from "next/link";
import type { ProductCard as Card } from "@biztrackbd/core";
import { money, productTitle, type Lang, type T } from "@/lib/i18n-core";
import { ProductImage } from "./product-image";

export function ProductCard({ p, lang, t, priority = false }: { p: Card; lang: Lang; t: T; priority?: boolean }) {
  const onSale = p.compareAtPrice != null && p.compareAtPrice > p.price;
  const title = productTitle(lang, p.title, p.titleBn);
  return (
    <Link href={`/products/${p.slug}`} className="pcard">
      <div style={{ position: "relative" }}>
        {!p.inStock ? <span className="tag out">{t("soldOut")}</span> : onSale ? <span className="tag">{t("sale")}</span> : null}
        <ProductImage src={p.imageUrl} alt={p.imageAlt ?? title} seed={p.id} sizes="(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw" priority={priority} />
      </div>
      <div className="pname">{title}</div>
      <div className="price-row">
        <span className="price">{money(p.price, lang)}</span>
        {onSale && <span className="was">{money(p.compareAtPrice!, lang)}</span>}
      </div>
    </Link>
  );
}
