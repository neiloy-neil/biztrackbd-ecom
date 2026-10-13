import Image from "next/image";
import Link from "next/link";
import { SwapIcon, TruckIcon, WalletIcon } from "@/components/icons";
import { money, num, productTitle, type Lang, type T } from "@/lib/i18n-core";
import type { CartCtx, CollectionCtx, PageCtx, ProductCtx } from "@/lib/page-ctx";
import { CartView } from "./cart-view";
import { mark } from "./edit-marks";
import { Listing } from "./listing";
import { ProductCard } from "./product-card";
import { tintFor } from "./product-image";
import { PurchasePanel } from "./purchase-panel";
import { ViewContent } from "./tracker";

/**
 * The blocks that make the product, collection and cart pages work (docs/39). They hold the markup these pages have always had, now
 * placed by the page's saved layout, so a store that never edits them looks the same. No server-only code: the live store and the
 * editor's preview draw them the same way.
 */

type S = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const on = (v: unknown, fallback = true) => (typeof v === "boolean" ? v : fallback);
const L = (s: S, key: string, lang: Lang) => (lang === "bn" && str(s[`${key}Bn`]) ? str(s[`${key}Bn`]) : str(s[key]));

export function ProductMain({ ctx, s, lang, t, id }: { ctx: ProductCtx; s: S; lang: Lang; t: T; id: string }) {
  const { p } = ctx;
  const title = productTitle(lang, p.title, p.titleBn);
  const onSale = p.compareAtPrice != null && p.compareAtPrice > p.price;
  const hasChoices = p.variants.length > 1 || (p.variants[0] !== undefined && p.variants[0].title.toLowerCase() !== "default");
  const prices = Object.fromEntries(p.variants.map((v) => [v.id, money(v.price, lang)]));
  return (
    <div className="wrap has-sticky" data-section={id}>
      {p.variants[0] && <ViewContent id={p.variants[0].id} />}
      <div className="pdp">
        <div className="gallery">
          <div className="track" tabIndex={0} role="region" aria-label={title}>
            {(p.images.length ? p.images : [{ url: "", alt: null }]).map((img, i) => (
              <div key={img.url || i} className="slide" style={{ background: tintFor(p.id) }}>
                {img.url ? (
                  <Image src={img.url} alt={img.alt ?? title} fill sizes="(max-width: 900px) 100vw, 50vw" priority={i === 0} quality={75} />
                ) : (
                  <div className="ph" aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><i style={{ width: "30%", aspectRatio: "9/11", background: "rgba(43,33,24,.14)", borderRadius: 14 }} /></div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pdp-info">
          {p.categoryName && <div className="crumb">{p.categoryName}</div>}
          <h1>{title}</h1>
          {on(s.showRating) && (
            <div className="stars">
              {p.rating ? (<><span className="s" aria-hidden="true">{"★".repeat(Math.round(p.rating.average))}</span><span>{num(p.rating.average, lang)} · {t("reviews", { n: num(p.rating.count, lang) })}</span></>) : <span>{t("noReviews")}</span>}
            </div>
          )}
          <div className="pdp-price">
            <span className="price" data-testid="pdp-price">{money(p.price, lang)}</span>
            {onSale && <><span className="was">{money(p.compareAtPrice!, lang)}</span><span className="save">{t("save", { amount: money(p.compareAtPrice! - p.price, lang) })}</span></>}
          </div>

          <PurchasePanel
            variants={p.variants.map((v) => ({ id: v.id, title: v.title, price: v.price, compareAtPrice: v.compareAtPrice, stock: v.stock }))}
            hasChoices={hasChoices}
            text={{ size: t("size"), chooseSize: t("chooseSize"), quantity: t("quantity"), addToCart: t("addToCart"), buyNow: t("buyNow"), added: t("added"), viewCart: t("viewCart"), soldOut: t("soldOut"), notifyTitle: t("notifyTitle"), notifyPhone: t("notifyPhone"), notifyButton: t("notifyButton"), notifySent: t("notifySent"), notifyWaiting: t("notifyWaiting"), notifyBad: t("notifyBad"), onlyLeft: t("onlyLeft", { n: "{n}", size: "{size}" }), priceLabel: prices }}
          />

          {on(s.showAssurance) && (
            <div className="assure">
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}><TruckIcon /><div><b>{t("assureDeliveryT")}</b> <span>{t("assureDeliveryS")}</span></div></div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}><WalletIcon /><div><b>{t("assurePayT")}</b><br /><span>{t("assurePayS")}</span></div></div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}><SwapIcon /><div><b>{t("assureExchangeT")}</b><br /><span>{t("assureExchangeS")}</span></div></div>
            </div>
          )}

          {on(s.showDescription) && (
            <div className="acc">
              <details open>
                <summary>{t("description")}</summary>
                <div className="body" dangerouslySetInnerHTML={{ __html: ctx.descriptionHtml }} />
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductReviews({ ctx, s, lang, t, id, editing }: { ctx: ProductCtx; s: S; lang: Lang; t: T; id: string; editing?: boolean }) {
  const { summary, reviews } = ctx;
  const ed = mark(editing);
  const heading = L(s, "title", lang) || t("reviewsTitle");
  return (
    <div className="wrap" data-section={id}>
      <section className="section" aria-labelledby={`revs-${id}`} data-testid="reviews">
        <div className="section-head"><h2 id={`revs-${id}`} {...ed("title")}>{heading}</h2>{summary.average !== null && <span className="muted" data-testid="reviews-average">{"★".repeat(Math.round(summary.average))} {t("reviewsAverage", { avg: num(summary.average, lang) })} · {t("reviews", { n: num(summary.count, lang) })}</span>}</div>
        {reviews.length === 0 ? <p className="muted">{t("noReviews")}</p> : (
          <div className="stack">
            {reviews.map((r) => (
              <article key={r.id} className="card" data-testid="review">
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span aria-label={t("starsN", { n: num(r.rating, lang) })} style={{ color: "var(--accent)" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>{r.title && <b>{r.title}</b>}</div>
                <p style={{ marginTop: 6, overflowWrap: "anywhere" }}>{r.body}</p>
                <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{r.author} · {t("verifiedBuyer")}</p>
                {r.reply && <p style={{ marginTop: 8, paddingLeft: 12, borderLeft: "3px solid var(--line)", fontSize: 14 }}><b>{t("storeReply")}:</b> {r.reply}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function ProductRelated({ ctx, s, lang, t, id, editing }: { ctx: ProductCtx; s: S; lang: Lang; t: T; id: string; editing?: boolean }) {
  const ed = mark(editing);
  const items = ctx.p.related.slice(0, Math.max(2, Math.min(8, Number(s.limit) || 4)));
  if (items.length === 0 && !editing) return null;
  return (
    <div className="wrap" data-section={id}>
      <section className="section" aria-labelledby={`rel-${id}`}>
        <div className="section-head"><h2 id={`rel-${id}`} {...ed("title")}>{L(s, "title", lang) || t("goesWith")}</h2><Link href="/search" className="link-accent">{t("viewAll")}</Link></div>
        <div className="grid grid-4">{items.map((r) => <ProductCard key={r.id} p={r} lang={lang} t={t} />)}</div>
      </section>
    </div>
  );
}

export function CollectionHeader({ ctx, s, lang, id }: { ctx: CollectionCtx; s: S; lang: Lang; id: string }) {
  const { category, result } = ctx;
  return (
    <div className="wrap" data-section={id}>
      <h1 className="page-title">{category.name}</h1>
      {on(s.showDescription) && category.description && <p className="muted" style={{ marginBottom: 12 }}>{category.description}</p>}
      {on(s.showCount, false) && <p className="muted" style={{ marginBottom: 12 }}>{num(result.total, lang)} {lang === "bn" ? "টি পণ্য" : result.total === 1 ? "product" : "products"}</p>}
    </div>
  );
}

export function CollectionProducts({ ctx, lang, t, id }: { ctx: CollectionCtx; s: S; lang: Lang; t: T; id: string }) {
  return (
    <div className="wrap" data-section={id}>
      <Listing result={ctx.result} lang={lang} t={t} basePath={ctx.basePath} params={{}} sort={ctx.sort} />
    </div>
  );
}

/** Two example lines for the editor's preview, because a visitor's real cart lives in their own browser. */
function SampleCart({ cart }: { cart: CartCtx }) {
  const { s } = cart;
  return (
    <div className="empty" style={{ textAlign: "left" }} data-testid="cart-sample">
      <p><b>{s.yourCart}</b></p>
      <p className="muted" style={{ marginTop: 8 }}>This is a preview. Your customers' own items appear here, with their totals and the checkout button.</p>
    </div>
  );
}

export function CartMain({ ctx, s, lang, id, preview, editing }: { ctx: CartCtx; s: S; lang: Lang; id: string; preview?: boolean; editing?: boolean }) {
  const ed = mark(editing);
  return (
    <div className="wrap" style={{ paddingBottom: 48 }} data-section={id}>
      <h1 className="page-title" {...ed("title")}>{L(s, "title", lang) || ctx.s.yourCart}</h1>
      {preview ? <SampleCart cart={ctx} /> : <CartView lang={lang} s={ctx.s} freeOver={ctx.freeOver} />}
    </div>
  );
}

/** Draws one of the page blocks, or null when this page has no data for it. */
export function renderPageBlock(type: string, id: string, s: S, ctx: PageCtx | undefined, lang: Lang, t: T, editing?: boolean): React.ReactNode {
  if (!ctx) return null;
  switch (type) {
    case "product-main": return ctx.product ? <ProductMain key={id} id={id} ctx={ctx.product} s={s} lang={lang} t={t} /> : null;
    case "product-reviews": return ctx.product ? <ProductReviews key={id} id={id} ctx={ctx.product} s={s} lang={lang} t={t} editing={editing} /> : null;
    case "product-related": return ctx.product ? <ProductRelated key={id} id={id} ctx={ctx.product} s={s} lang={lang} t={t} editing={editing} /> : null;
    case "collection-header": return ctx.collection ? <CollectionHeader key={id} id={id} ctx={ctx.collection} s={s} lang={lang} /> : null;
    case "collection-products": return ctx.collection ? <CollectionProducts key={id} id={id} ctx={ctx.collection} s={s} lang={lang} t={t} /> : null;
    case "cart-main": return ctx.cart ? <CartMain key={id} id={id} ctx={ctx.cart} s={s} lang={lang} preview={ctx.preview} editing={editing} /> : null;
    default: return null;
  }
}
