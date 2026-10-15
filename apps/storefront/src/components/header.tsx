import Link from "next/link";
import Image from "next/image";
import { linkHref, type CategoryCard, type Chrome, type NavLink, type StoreInfo } from "@biztrackbd/core";
import { setLanguage } from "@/app/actions";
import { money, type Lang, type T } from "@/lib/i18n";
import { CartLink } from "./cart-badge";
import { MenuIcon, SearchIcon, UserIcon } from "./icons";

/** The words of a link: the merchant's own (in the reader's language when there is one), else the built-in words for that kind of link. */
export function linkLabel(l: NavLink, lang: Lang, t: T, categories: CategoryCard[]): string {
  const own = lang === "bn" && l.labelBn ? l.labelBn : l.label;
  if (own) return own;
  switch (l.type) {
    case "new": return t("newArrivals");
    case "sale": return t("sale");
    case "all": return t("all");
    case "blog": return t("blog");
    case "category": return categories.find((c) => c.slug === l.ref)?.name ?? l.ref;
    default: return l.ref || l.url;
  }
}

/** The bar above the header. With a header and footer saved by the merchant, it is theirs: the store's own line, their own words, or none. */
export function Announcement({ info, lang, chrome }: { info: StoreInfo; lang: Lang; chrome?: Chrome | null }) {
  const a = chrome?.header.announcement;
  if (a && a.mode === "off") return null;
  if (a && a.mode === "custom") {
    const text = lang === "bn" && a.textBn ? a.textBn : a.text;
    if (!text) return null;
    const style = { background: a.bgColor, color: a.textColor };
    const inner = a.link ? (a.link.startsWith("/") ? <Link href={a.link} style={{ color: "inherit" }}>{text}</Link> : <a href={a.link} rel="noopener noreferrer" style={{ color: "inherit" }}>{text}</a>) : text;
    return <div className="announce" role="note" style={style}>{inner}</div>;
  }
  const text = lang === "bn" && info.announcementBn ? info.announcementBn : info.announcement;
  if (!text && !info.flashSaleActive) return null;
  const isFlash = Boolean(info.flashSaleActive);
  const flashStyle = isFlash ? { background: "#dc2626", color: "#ffffff" } : undefined;
  return (
    <div className={`announce ${isFlash ? "flash-sale" : ""}`} role="note" style={flashStyle}>
      <span>{text}</span>
      {isFlash && info.flashSaleCoupon && (
        <span style={{ marginLeft: 8, padding: "2px 6px", background: "#ffffff", color: "#dc2626", borderRadius: 4, fontWeight: 700, fontSize: 12 }}>
          {lang === "bn" ? `কোড: ${info.flashSaleCoupon}` : `Use code: ${info.flashSaleCoupon}`}
        </span>
      )}
    </div>
  );
}

export function Header({ info, categories, lang, t, points, chrome }: { info: StoreInfo; categories: CategoryCard[]; lang: Lang; t: T; points?: { available: number; worthBdt: number } | null; chrome?: Chrome | null }) {
  const custom = chrome && !chrome.menu.auto;
  const nav = custom
    ? chrome.menu.items.map((l) => ({ href: linkHref(l), label: linkLabel(l, lang, t, categories) }))
    : [{ href: "/search?sort=newest", label: t("newArrivals") }, ...categories.slice(0, 4).map((c) => ({ href: `/c/${c.slug}`, label: c.name })), { href: "/search?sale=1", label: t("sale") }];
  const other: Lang = lang === "bn" ? "en" : "bn";
  const h = chrome?.header;
  const search = h?.search ?? "bar";
  const showAccount = h?.showAccount ?? true;
  const showLanguage = h?.showLanguage ?? true;
  const tools = (
    <>
      <div className="header-tools">
        {search === "bar" && (
          <form action="/search" role="search" className="search-pill">
            <SearchIcon />
            <input name="q" type="search" placeholder={t("searchPlaceholder")} aria-label={t("search")} />
          </form>
        )}
        {search === "icon" && <Link href="/search" className="icon-btn" aria-label={t("search")}><SearchIcon /></Link>}
        {showLanguage && <form action={setLanguage.bind(null, other)}><button className="lang-btn" type="submit" lang={other}>{t("switchLang")}</button></form>}
          {points && <Link href="/account" className="pts-pill" data-testid="points-pill" aria-label={`${t("pointsCount", { n: points.available })}, ${t("pointsWorth", { v: points.worthBdt })}`}>{points.available} <span className="muted">({money(points.worthBdt, lang)})</span></Link>}
        {showAccount && <Link href="/account" className="icon-btn" aria-label={t("account")}><UserIcon /></Link>}
      </div>
      <CartLink label={t("cart")} labelWithCount={t("cartItems", { n: "{n}" })} />
    </>
  );
  return (
    <header className="header" data-logo={h && h.logo !== "left" ? h.logo : undefined} data-sticky={h && !h.sticky ? "off" : undefined}>
      <div className="wrap bar">
        <details className="menu">
          <summary className="icon-btn" aria-label={t("menu")}><MenuIcon /></summary>
          <nav className="menu-panel" aria-label={t("menu")}>
            {nav.map((n) => <Link key={n.href + n.label} href={n.href}>{n.label}</Link>)}
            {showAccount && <Link href="/account">{t("account")}</Link>}
          </nav>
        </details>
        <Link href="/" className="logo" aria-label={info.storeName}>
          {info.logoUrl ? <Image src={info.logoUrl} alt={info.storeName} width={140} height={36} priority /> : info.storeName}
        </Link>
        <nav className="nav-desktop" aria-label={t("menu")}>
          {nav.map((n) => <Link key={n.href + n.label} href={n.href}>{n.label}</Link>)}
        </nav>
        {chrome ? <div className="header-right">{tools}</div> : tools}
      </div>
    </header>
  );
}
