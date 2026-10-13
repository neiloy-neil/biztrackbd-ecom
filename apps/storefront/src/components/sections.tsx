import Link from "next/link";
import type { PageData, PageJson, PageSection } from "@biztrackbd/core";
import { parseEndsAt, productKey, youtubeId } from "@biztrackbd/core/builder-client";
import { money, type Lang, type T } from "@/lib/i18n-core";
import { Countdown } from "./countdown";
import type { PageCtx } from "@/lib/page-ctx";
import { renderPageBlock } from "./page-blocks";
import { ProductCard } from "./product-card";
import { tintFor } from "./product-image";

/**
 * Draws a page built in the editor. It has no server-only code, so the live store (server) and the editor's preview
 * (browser, updating as the owner types) use the very same component and cannot drift apart.
 * Every value was validated when the page was saved; text is rendered as text, never as markup.
 */

type S = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
/** The Bangla twin when the visitor reads Bangla and the owner wrote one, else the English text. */
const L = (s: S, key: string, lang: Lang) => (lang === "bn" && str(s[`${key}Bn`]) ? str(s[`${key}Bn`]) : str(s[key]));

function Img({ src, alt = "", className }: { src: string; alt?: string; className?: string }) {
  // A plain tag on purpose: the address was checked at save time, and an owner's picture host need not be known to the image optimiser.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}

function Cta({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (!href) return null;
  return href.startsWith("/") ? <Link href={href} className={className}>{children}</Link> : <a href={href} className={className} rel="noopener noreferrer">{children}</a>;
}

/** What a landing page knows about its offers, for the sections that show a price or the stock. */
export interface LandingInfo {
  /** Pieces left across the first offer's options; null when unknown. */
  stock: number | null;
  /** Show the stock line even when stock is plentiful (the editor's preview). */
  alwaysShowStock?: boolean;
  /** The lowest price a customer pays for the first offer, and the crossed-out price when the product has one. */
  price: number | null;
  was: number | null;
}

function Section({ section, data, lang, t, orderForm, ctx, landing }: { section: PageSection; data: PageData; lang: Lang; t: T; orderForm?: React.ReactNode; ctx?: PageCtx; landing?: LandingInfo }) {
  const s = section.settings as S;
  const id = section.id;
  switch (section.type) {
    case "announcement-bar": {
      const text = L(s, "text", lang);
      if (!text) return null;
      const style = { background: str(s.bgColor), color: str(s.textColor) };
      const inner = <span>{text}</span>;
      return <div className="b-announce" style={style} data-section={id}>{str(s.link) ? <Cta href={str(s.link)} className="b-announce-link">{inner}</Cta> : inner}</div>;
    }
    case "hero": {
      const img = str(s.image);
      return (
        <section className={`hero${s.align === "center" ? " hero-center" : ""}`} data-section={id}>
          <div className="wrap">
            <div>
              {L(s, "eyebrow", lang) && <div className="eyebrow">{L(s, "eyebrow", lang)}</div>}
              <h1>{L(s, "title", lang)}</h1>
              {L(s, "text", lang) && <p>{L(s, "text", lang)}</p>}
              <div className="ctas"><Cta href={str(s.ctaLink)} className="btn btn-primary">{L(s, "ctaText", lang)}</Cta></div>
            </div>
            {img && <div className="b-hero-img"><Img src={img} /></div>}
          </div>
        </section>
      );
    }
    case "featured-products": {
      const items = (data.products[productKey(s as { source: string; categorySlug?: string })] ?? []).slice(0, Number(s.limit) || 8);
      if (items.length === 0) return null;
      const cols = s.columns === "3" ? "grid-3" : "grid-4";
      return (
        <div className="wrap" data-section={id}>
          <section className="section">
            <div className="section-head">
              <h2>{L(s, "title", lang)}</h2>
              <Link href={s.source === "sale" ? "/search?sale=1" : s.source === "category" && str(s.categorySlug) ? `/c/${encodeURIComponent(str(s.categorySlug))}` : "/search?sort=newest"} className="link-accent">{t("viewAll")}</Link>
            </div>
            <div className={`grid ${cols}`}>{items.map((p, i) => <ProductCard key={p.id} p={p} lang={lang} t={t} priority={i < 2} />)}</div>
          </section>
        </div>
      );
    }
    case "category-grid": {
      const cats = data.categories.slice(0, Number(s.limit) || 3);
      if (cats.length === 0) return null;
      return (
        <div className="wrap" data-section={id}>
          <section className="section">
            <div className="section-head"><h2>{L(s, "title", lang)}</h2></div>
            <div className="cats">{cats.map((c) => <Link key={c.id} href={`/c/${c.slug}`} className="cat" style={{ background: tintFor(c.id) }}>{c.name}</Link>)}</div>
          </section>
        </div>
      );
    }
    case "banner": {
      const img = str(s.image);
      return (
        <div className="wrap" data-section={id}>
          <section className={`section b-banner b-banner-${s.height === "tall" ? "tall" : "short"}${img ? " has-img" : ""}`} style={img ? { backgroundImage: `url("${img.replace(/"/g, "%22")}")` } : undefined}>
            <div className="b-banner-text">
              <h2>{L(s, "heading", lang)}</h2>
              {L(s, "text", lang) && <p>{L(s, "text", lang)}</p>}
              <Cta href={str(s.ctaLink)} className="btn btn-primary">{L(s, "ctaText", lang)}</Cta>
            </div>
          </section>
        </div>
      );
    }
    case "rich-text":
      return (
        <div className="wrap" data-section={id}>
          <section className="section b-text">
            {L(s, "heading", lang) && <h2>{L(s, "heading", lang)}</h2>}
            {L(s, "body", lang).split(/\n{2,}/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </section>
        </div>
      );
    case "trust-strip":
      return (
        <div className="wrap" data-section={id}>
          <section className="section">
            <div className="trust">
              <div><b>{t("trustCodT")}</b><span>{t("trustCodS")}</span></div>
              <div><b>{t("trustMfsT")}</b><span>{t("trustMfsS")}</span></div>
              <div><b>{t("trustDeliveryT")}</b><span>{t("trustDeliveryS")}</span></div>
              <div><b>{t("trustExchangeT")}</b><span>{t("trustExchangeS")}</span></div>
            </div>
          </section>
        </div>
      );

    // ---- Landing
    case "lp-hero": {
      const img = str(s.image);
      return (
        <section className="lp-hero" data-section={id}>
          <div className="wrap lp-hero-in">
            <div>
              {L(s, "badge", lang) && <span className="lp-badge">{L(s, "badge", lang)}</span>}
              <h1>{L(s, "headline", lang)}</h1>
              {L(s, "subhead", lang) && <p>{L(s, "subhead", lang)}</p>}
              <a href="#order" className="btn btn-primary btn-round">{L(s, "ctaText", lang)}</a>
            </div>
            {img && <div className="lp-hero-img"><Img src={img} alt={L(s, "headline", lang)} /></div>}
          </div>
        </section>
      );
    }
    case "lp-benefits": {
      const items = (s.items as S[] | undefined) ?? [];
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap">
            <h2>{L(s, "title", lang)}</h2>
            <ul className="lp-benefits">{items.map((it, i) => <li key={i}><b>{L(it, "title", lang)}</b>{L(it, "text", lang) && <span>{L(it, "text", lang)}</span>}</li>)}</ul>
          </div>
        </section>
      );
    }
    case "lp-gallery": {
      const items = ((s.items as S[] | undefined) ?? []).filter((it) => str(it.image));
      if (items.length === 0) return null;
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap">
            {L(s, "title", lang) && <h2>{L(s, "title", lang)}</h2>}
            <div className="lp-gallery">{items.map((it, i) => <Img key={i} src={str(it.image)} alt={str(it.alt)} />)}</div>
          </div>
        </section>
      );
    }
    case "lp-reviews": {
      const items = (s.items as S[] | undefined) ?? [];
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap">
            <h2>{L(s, "title", lang)}</h2>
            <div className="lp-reviews">
              {items.map((it, i) => (
                <figure key={i}>
                  <div aria-label={t("starsN", { n: Number(it.rating) || 5 })} style={{ color: "var(--warn)" }}>{"★".repeat(Number(it.rating) || 5)}</div>
                  <blockquote>{str(it.text)}</blockquote>
                  <figcaption>{str(it.name)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case "lp-faq": {
      const items = (s.items as S[] | undefined) ?? [];
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap lp-narrow">
            <h2>{L(s, "title", lang)}</h2>
            {items.map((it, i) => <details key={i} className="lp-faq"><summary>{L(it, "q", lang)}</summary><p>{L(it, "a", lang)}</p></details>)}
          </div>
        </section>
      );
    }
    case "lp-order-form":
      return (
        <section className="lp-block lp-order" id="order" data-section={id}>
          <div className="wrap lp-narrow">
            <h2>{L(s, "title", lang)}</h2>
            {L(s, "intro", lang) && <p className="muted">{L(s, "intro", lang)}</p>}
            {orderForm ?? <p className="muted">{t("previewOrderForm")}</p>}
          </div>
        </section>
      );
    case "lp-video": {
      const vid = youtubeId(str(s.videoUrl));
      if (!vid) return null;
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap lp-narrow">
            {L(s, "title", lang) && <h2>{L(s, "title", lang)}</h2>}
            <div className="lp-video">
              {/* The privacy-friendly YouTube address, and only an 11-character id that passed the check above. */}
              <iframe src={`https://www.youtube-nocookie.com/embed/${vid}`} title={L(s, "title", lang) || "Video"} loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
          </div>
        </section>
      );
    }
    case "lp-split": {
      const img = str(s.image);
      return (
        <section className="lp-block" data-section={id}>
          <div className={`wrap lp-split${s.side === "left" ? " lp-split-left" : ""}${img ? "" : " lp-split-solo"}`}>
            <div>
              <h2>{L(s, "title", lang)}</h2>
              <p>{L(s, "text", lang)}</p>
              {L(s, "ctaText", lang) && <a href="#order" className="btn btn-primary btn-round">{L(s, "ctaText", lang)}</a>}
            </div>
            {img && <Img src={img} alt={L(s, "title", lang)} />}
          </div>
        </section>
      );
    }
    case "lp-text":
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap lp-narrow lp-center">
            <h2>{L(s, "title", lang)}</h2>
            <p>{L(s, "text", lang)}</p>
            {L(s, "ctaText", lang) && <a href="#order" className="btn btn-primary btn-round">{L(s, "ctaText", lang)}</a>}
          </div>
        </section>
      );
    case "lp-countdown": {
      // Only a real end date counts down; with none, or once it has passed, the section is simply not there.
      const end = parseEndsAt(str(s.endsAt));
      if (!end || end.getTime() <= Date.now()) return null;
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap lp-narrow lp-center">
            <h2>{L(s, "title", lang)}</h2>
            <Countdown endsAt={end.toISOString()} labels={{ d: t("lpDays"), h: t("lpHours"), m: t("lpMinutes"), s: t("lpSeconds") }} />
          </div>
        </section>
      );
    }
    case "lp-stock": {
      const n = landing?.stock;
      const limit = Number(s.threshold) || 20;
      if (n == null || n <= 0 || (n > limit && !landing?.alwaysShowStock)) return null;
      return <div className="wrap lp-narrow lp-center" data-section={id}><p className="lp-stock" role="status">{L(s, "text", lang).replace("{n}", String(n))}</p></div>;
    }
    case "lp-offer-bar": {
      const price = landing?.price;
      if (price == null) return null;
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap lp-narrow lp-center">
            <div className="lp-offer">
              <span className="muted">{L(s, "text", lang)}</span>
              <b className="lp-offer-price">{money(price, lang)}</b>
              {landing?.was != null && landing.was > price && <s className="muted">{money(landing.was, lang)}</s>}
            </div>
            {L(s, "ctaText", lang) && <a href="#order" className="btn btn-primary btn-round">{L(s, "ctaText", lang)}</a>}
          </div>
        </section>
      );
    }
    case "lp-sticky-cta":
      return <div className="lp-sticky" data-section={id}><a href="#order" className="btn btn-primary btn-round btn-block">{L(s, "text", lang)}</a></div>;
    default:
      // The product, collection and cart blocks (docs/39) need the page's own data.
      return <>{renderPageBlock(section.type, id, s, ctx, lang, t)}</>;
  }
}

export function Sections({ page, data, lang, t, orderForm, ctx, landing }: { page: PageJson; data: PageData; lang: Lang; t: T; orderForm?: React.ReactNode; ctx?: PageCtx; landing?: LandingInfo }) {
  return <>{page.sections.filter((s) => !s.disabled).map((s) => <Section key={s.id} section={s} data={data} lang={lang} t={t} orderForm={orderForm} ctx={ctx} landing={landing} />)}</>;
}
