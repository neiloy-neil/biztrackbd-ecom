import Link from "next/link";
import type { PageData, PageJson, PageSection } from "@biztrackbd/core";
import { parseEndsAt, productKey, youtubeId } from "@biztrackbd/core/builder-client";
import { money, type Lang, type T } from "@/lib/i18n-core";
import { Countdown } from "./countdown";
import { LandingMotion } from "./landing-motion";
import { mark, markImg } from "./edit-marks";
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

function Cta({ href, className, children, attrs }: { href: string; className: string; children: React.ReactNode; attrs?: Record<string, string> }) {
  // In the editor a button without a link is still drawn, so its words can be typed.
  if (!href) return attrs && Object.keys(attrs).length ? <span className={className} {...attrs}>{children}</span> : null;
  if (attrs && Object.keys(attrs).length) return <span className={className} {...attrs}>{children}</span>;
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

/** The store's own contact details, for the contact block of a page built from sections. They come from the store settings, never from the layout. */
export interface SiteInfo { phone: string | null; whatsapp: string | null; address: string | null; logoUrl?: string | null; storeName?: string }
/** Things only the server can draw, handed in by the page (a server action cannot be imported into code the editor's preview also uses). */
export interface SectionExtras { langSwitch?: React.ReactNode }

const PhoneIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></svg>;
const WaIcon = ({ size = 18 }: { size?: number }) => <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.1 1.3z" /></svg>;
const NO_REVEAL = new Set(["lp-header", "lp-hero", "lp-marquee", "lp-sticky-cta"]);

function Section({ section, data, lang, t, orderForm, ctx, landing, editing, site, pro, extras }: { section: PageSection; data: PageData; lang: Lang; t: T; orderForm?: React.ReactNode; ctx?: PageCtx; landing?: LandingInfo; editing?: boolean; site?: SiteInfo; pro?: boolean; extras?: SectionExtras }) {
  const s = section.settings as S;
  const id = section.id;
  const ed = mark(editing);
  const edImg = markImg(editing);
  switch (section.type) {
    case "announcement-bar": {
      const text = L(s, "text", lang);
      if (!text && !editing) return null;
      const style = { background: str(s.bgColor), color: str(s.textColor) };
      const inner = <span {...ed("text")}>{text}</span>;
      return <div className="b-announce" style={style} data-section={id}>{str(s.link) && !editing ? <Cta href={str(s.link)} className="b-announce-link">{inner}</Cta> : inner}</div>;
    }
    case "hero": {
      const img = str(s.image);
      return (
        <section className={`hero${s.align === "center" ? " hero-center" : ""}`} data-section={id}>
          <div className="wrap">
            <div>
              {(L(s, "eyebrow", lang) || editing) && <div className="eyebrow" {...ed("eyebrow")}>{L(s, "eyebrow", lang)}</div>}
              <h1 {...ed("title")}>{L(s, "title", lang)}</h1>
              {(L(s, "text", lang) || editing) && <p {...ed("text")}>{L(s, "text", lang)}</p>}
              <div className="ctas"><Cta href={str(s.ctaLink)} className="btn btn-primary" attrs={ed("ctaText")}>{L(s, "ctaText", lang)}</Cta></div>
            </div>
            {img ? <div className="b-hero-img" {...edImg("image")}><Img src={img} /></div> : editing ? <div className="b-hero-img lp-pick" {...edImg("image")}>+ Picture</div> : null}
          </div>
        </section>
      );
    }
    case "featured-products": {
      const items = (data.products[productKey(s as { source: string; categorySlug?: string })] ?? []).slice(0, Number(s.limit) || 8);
      if (items.length === 0 && !editing) return null;
      const cols = s.columns === "3" ? "grid-3" : "grid-4";
      return (
        <div className="wrap" data-section={id}>
          <section className="section">
            <div className="section-head">
              <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
              <Link href={s.source === "sale" ? "/search?sale=1" : s.source === "category" && str(s.categorySlug) ? `/c/${encodeURIComponent(str(s.categorySlug))}` : "/search?sort=newest"} className="link-accent">{t("viewAll")}</Link>
            </div>
            {items.length === 0 ? <p className="muted">No products to show here yet.</p> : <div className={`grid ${cols}`}>{items.map((p, i) => <ProductCard key={p.id} p={p} lang={lang} t={t} priority={i < 2} />)}</div>}
          </section>
        </div>
      );
    }
    case "category-grid": {
      const cats = data.categories.slice(0, Number(s.limit) || 3);
      if (cats.length === 0 && !editing) return null;
      return (
        <div className="wrap" data-section={id}>
          <section className="section">
            <div className="section-head"><h2 {...ed("title")}>{L(s, "title", lang)}</h2></div>
            {cats.length === 0 && <p className="muted">No categories yet.</p>}
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
              <h2 {...ed("heading")}>{L(s, "heading", lang)}</h2>
              {(L(s, "text", lang) || editing) && <p {...ed("text")}>{L(s, "text", lang)}</p>}
              <Cta href={str(s.ctaLink)} className="btn btn-primary" attrs={ed("ctaText")}>{L(s, "ctaText", lang)}</Cta>
              {editing && <button type="button" className="lp-pick-btn" {...edImg("image")}>{img ? "Change picture" : "+ Picture"}</button>}
            </div>
          </section>
        </div>
      );
    }
    case "rich-text":
      return (
        <div className="wrap" data-section={id}>
          <section className="section b-text">
            {(L(s, "heading", lang) || editing) && <h2 {...ed("heading")}>{L(s, "heading", lang)}</h2>}
            {editing
              ? <div style={{ whiteSpace: "pre-wrap" }} {...ed("body", true, true)}>{L(s, "body", lang)}</div>
              : L(s, "body", lang).split(/\n{2,}/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
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
      const ticks = [1, 2, 3].map((n) => ({ n, text: L(s, `tick${n}`, lang) })).filter((x) => x.text || editing);
      const price = pro && s.showPrice !== false ? landing?.price ?? null : null;
      const was = pro ? landing?.was ?? null : null;
      return (
        <section className="lp-hero" data-section={id}>
          <div className="wrap lp-hero-in">
            <div>
              {(L(s, "badge", lang) || editing) && <span className="lp-badge" {...ed("badge")}>{L(s, "badge", lang)}</span>}
              <h1 {...ed("headline")}>{L(s, "headline", lang)}</h1>
              {(L(s, "subhead", lang) || editing) && <p {...ed("subhead")}>{L(s, "subhead", lang)}</p>}
              {price != null && (
                <div className="lp-price" data-testid="lp-hero-price">
                  <span className="now">{money(price, lang)}</span>
                  {was != null && was > price && <><s className="was">{money(was, lang)}</s><span className="save">{t("save", { amount: money(was - price, lang) })}</span></>}
                </div>
              )}
              <a href="#order" className={`btn btn-primary btn-round${pro ? " lp-pulse" : ""}`} {...ed("ctaText")}>{L(s, "ctaText", lang)}</a>
              {pro && ticks.length > 0 && <ul className="lp-ticks">{ticks.map((x) => <li key={x.n} {...ed(`tick${x.n}`)}>{L(s, `tick${x.n}`, lang)}</li>)}</ul>}
            </div>
            {img ? <div className="lp-hero-img" {...edImg("image")}><Img src={img} alt={L(s, "headline", lang)} /></div> : editing ? <div className="lp-hero-img lp-pick" {...edImg("image")}>+ Picture</div> : null}
          </div>
        </section>
      );
    }
    case "lp-header": {
      const logo = str(s.logo) || site?.logoUrl || "";
      const name = site?.storeName ?? "";
      const phone = site?.phone;
      const wa = site?.whatsapp;
      return (
        <header className="lp-head" data-section={id}>
          <div className="wrap lp-head-in">
            <a href="#top" className="lp-brand" aria-label={name || "Home"}>{logo ? <Img src={logo} alt={name} /> : <span>{name}</span>}</a>
            <div className="lp-head-act">
              {s.showPhone !== false && phone && <a href={`tel:${phone}`} className="lp-chip" aria-label={phone}><PhoneIcon /><span className="t">{phone}</span></a>}
              {s.showWhatsapp !== false && wa && <a href={`https://wa.me/88${wa}`} rel="noopener noreferrer" className="lp-chip wa" aria-label="WhatsApp"><WaIcon /><span className="t">WhatsApp</span></a>}
              {s.showLanguage === true && (extras?.langSwitch ?? (editing ? <span className="lp-chip">EN | বাং</span> : null))}
              {s.showOrder !== false && <a href="#order" className="lp-chip go" {...ed("orderText")}>{L(s, "orderText", lang) || t("lpOrderSubmit")}</a>}
            </div>
          </div>
          {s.floatWhatsapp !== false && wa && <a href={`https://wa.me/88${wa}`} rel="noopener noreferrer" className="lp-wa-float" aria-label="WhatsApp"><WaIcon size={30} /></a>}
        </header>
      );
    }
    case "lp-marquee": {
      const items = ((s.items as S[] | undefined) ?? []).map((it) => L(it, "text", lang)).filter(Boolean);
      if (items.length === 0) return null;
      // The phrases are drawn twice, so the strip can slide by half its length and start over without a jump.
      const run = [...items, ...items, ...items, ...items];
      return <div className="lp-marquee" data-section={id} aria-label={items.join(", ")}><div className="lp-marquee-track" aria-hidden="true">{[0, 1].map((k) => run.map((x, i) => <span key={`${k}-${i}`}>{x}</span>))}</div></div>;
    }
    case "lp-compare": {
      const items = (s.items as S[] | undefined) ?? [];
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap">
            <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
            <div className="lp-compare">
              <div className="bad"><h3 {...ed("badTitle")}>{L(s, "badTitle", lang)}</h3><ul>{items.map((it, i) => <li key={i} {...ed(`items.${i}.bad`)}>{L(it, "bad", lang)}</li>)}</ul></div>
              <div className="good"><h3 {...ed("goodTitle")}>{L(s, "goodTitle", lang)}</h3><ul>{items.map((it, i) => <li key={i} {...ed(`items.${i}.good`)}>{L(it, "good", lang)}</li>)}</ul></div>
            </div>
          </div>
        </section>
      );
    }
    case "lp-steps": {
      const items = (s.items as S[] | undefined) ?? [];
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap">
            <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
            <ol className="lp-steps">{items.map((it, i) => <li key={i}><b {...ed(`items.${i}.title`)}>{L(it, "title", lang)}</b>{(L(it, "text", lang) || editing) && <span {...ed(`items.${i}.text`)}>{L(it, "text", lang)}</span>}</li>)}</ol>
          </div>
        </section>
      );
    }
    case "lp-screens": {
      const all = (s.items as S[] | undefined) ?? [];
      const items = all.map((it, i) => ({ it, i })).filter(({ it }) => str(it.image));
      if (items.length === 0 && !editing) return null;
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap">
            <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
            <div className="lp-screens">{items.length === 0 ? <div className="lp-pick" {...edImg("items.0.image")}>+ Picture</div> : items.map(({ it, i }) => <span key={i} style={{ display: "contents" }} {...edImg(`items.${i}.image`)}><Img src={str(it.image)} alt={str(it.alt)} /></span>)}</div>
          </div>
        </section>
      );
    }
    case "lp-benefits": {
      const items = (s.items as S[] | undefined) ?? [];
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap">
            <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
            <ul className="lp-benefits">{items.map((it, i) => <li key={i}><b {...ed(`items.${i}.title`)}>{L(it, "title", lang)}</b>{(L(it, "text", lang) || editing) && <span {...ed(`items.${i}.text`)}>{L(it, "text", lang)}</span>}</li>)}</ul>
          </div>
        </section>
      );
    }
    case "lp-gallery": {
      const all = (s.items as S[] | undefined) ?? [];
      const items = all.map((it, i) => ({ it, i })).filter(({ it }) => str(it.image));
      if (items.length === 0 && !editing) return null;
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap">
            {(L(s, "title", lang) || editing) && <h2 {...ed("title")}>{L(s, "title", lang)}</h2>}
            <div className="lp-gallery">{items.length === 0 ? <div className="lp-pick" {...edImg("items.0.image")}>+ Picture</div> : items.map(({ it, i }) => <span key={i} style={{ display: "contents" }} {...edImg(`items.${i}.image`)}><Img src={str(it.image)} alt={str(it.alt)} /></span>)}</div>
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
            <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
            {items.map((it, i) => <details key={i} className="lp-faq" open={editing || undefined}><summary {...ed(`items.${i}.q`)}>{L(it, "q", lang)}</summary><p {...ed(`items.${i}.a`)}>{L(it, "a", lang)}</p></details>)}
          </div>
        </section>
      );
    }
    case "lp-order-form":
      return (
        <section className="lp-block lp-order" id="order" data-section={id}>
          <div className="wrap lp-narrow">
            <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
            {(L(s, "intro", lang) || editing) && <p className="muted" {...ed("intro")}>{L(s, "intro", lang)}</p>}
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
            {(L(s, "title", lang) || editing) && <h2 {...ed("title")}>{L(s, "title", lang)}</h2>}
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
          <div className={`wrap lp-split${s.side === "left" ? " lp-split-left" : ""}${img || editing ? "" : " lp-split-solo"}`}>
            <div>
              <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
              <p {...ed("text")}>{L(s, "text", lang)}</p>
              {(L(s, "ctaText", lang) || editing) && <a href="#order" className="btn btn-primary btn-round" {...ed("ctaText")}>{L(s, "ctaText", lang)}</a>}
            </div>
            {img ? <span style={{ display: "contents" }} {...edImg("image")}><Img src={img} alt={L(s, "title", lang)} /></span> : editing ? <div className="lp-pick" {...edImg("image")}>+ Picture</div> : null}
          </div>
        </section>
      );
    }
    case "lp-text":
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap lp-narrow lp-center">
            <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
            <p {...ed("text")}>{L(s, "text", lang)}</p>
            {(L(s, "ctaText", lang) || editing) && <a href="#order" className="btn btn-primary btn-round" {...ed("ctaText")}>{L(s, "ctaText", lang)}</a>}
          </div>
        </section>
      );
    case "lp-countdown": {
      // Only a real end date counts down; with none, or once it has passed, the section is simply not there.
      const end = parseEndsAt(str(s.endsAt));
      if (!end || end.getTime() <= Date.now()) return editing ? <section className="lp-block" data-section={id}><div className="wrap lp-narrow lp-center"><h2 {...ed("title")}>{L(s, "title", lang)}</h2><p className="muted">Set the end date in the settings to show the timer. It stays hidden until then.</p></div></section> : null;
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap lp-narrow lp-center">
            <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
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
              <span className="muted" {...ed("text")}>{L(s, "text", lang)}</span>
              <b className="lp-offer-price">{money(price, lang)}</b>
              {landing?.was != null && landing.was > price && <s className="muted">{money(landing.was, lang)}</s>}
            </div>
            {(L(s, "ctaText", lang) || editing) && <a href="#order" className="btn btn-primary btn-round" {...ed("ctaText")}>{L(s, "ctaText", lang)}</a>}
          </div>
        </section>
      );
    }
    case "contact-block":
      return (
        <section className="lp-block" data-section={id}>
          <div className="wrap lp-narrow lp-center">
            <h2 {...ed("title")}>{L(s, "title", lang)}</h2>
            {(L(s, "text", lang) || editing) && <p {...ed("text")}>{L(s, "text", lang)}</p>}
            <div className="lp-contact">
              {site?.phone && <a href={`tel:${site.phone}`} className="btn btn-primary btn-round">{site.phone}</a>}
              {site?.whatsapp && <a href={`https://wa.me/88${site.whatsapp}`} rel="noopener noreferrer" className="btn btn-secondary btn-round">WhatsApp</a>}
              {!site?.phone && !site?.whatsapp && editing && <p className="muted">Add your phone number and WhatsApp in Settings, and they appear here.</p>}
            </div>
            {site?.address && <p className="muted" style={{ marginTop: 12 }}>{site.address}</p>}
          </div>
        </section>
      );
    case "lp-sticky-cta":
      return (
        <div className="lp-sticky" data-section={id}>
          {pro && landing?.price != null && <div className="sum"><b>{money(landing.price, lang)}</b>{landing.was != null && landing.was > landing.price && <s>{money(landing.was, lang)}</s>}</div>}
          <a href="#order" className={`btn btn-primary btn-round${pro ? "" : " btn-block"}`} {...ed("text")}>{L(s, "text", lang)}</a>
        </div>
      );
    default:
      // The product, collection and cart blocks (docs/39) need the page's own data.
      return <>{renderPageBlock(section.type, id, s, ctx, lang, t, editing)}</>;
  }
}

export function Sections({ page, data, lang, t, orderForm, ctx, landing, editing, site, extras }: { page: PageJson; data: PageData; lang: Lang; t: T; orderForm?: React.ReactNode; ctx?: PageCtx; landing?: LandingInfo; site?: SiteInfo; extras?: SectionExtras; /** The editor's preview of a landing page: text and pictures are marked so they can be changed on the page. */ editing?: boolean }) {
  // In the editor a hidden section is still drawn, dimmed, so it can be found and shown again; the live page never draws it.
  const shown = page.sections.filter((x) => editing || !x.disabled);
  // A landing page with a header section has a style of its own (colour palette, motion); one without keeps the quieter look it was made with.
  const header = page.sections.find((x) => x.type === "lp-header");
  const pro = Boolean(header);
  const nodes = shown.map((x) => {
    const node = <Section key={x.id} section={x} data={data} lang={lang} t={t} orderForm={orderForm} ctx={ctx} landing={landing} editing={editing} site={site} pro={pro} extras={extras} />;
    // Each block rises into place as it comes into view (never in the editor, and never when the visitor asks for less motion).
    return pro && !NO_REVEAL.has(x.type) ? <div key={x.id} className={`lp-rv${editing ? "" : " lp-reveal"}`}>{node}</div> : node;
  });
  if (!pro) return <>{nodes}</>;
  const palette = String(header!.settings.palette ?? "fresh");
  return <div className="lp-pro" id="top" data-palette={palette}>{!editing && <LandingMotion />}{nodes}</div>;
}
