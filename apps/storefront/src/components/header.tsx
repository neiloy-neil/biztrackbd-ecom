import Link from "next/link";
import Image from "next/image";
import type { CategoryCard, StoreInfo } from "@biztrackbd/core";
import { setLanguage } from "@/app/actions";
import { money, type Lang, type T } from "@/lib/i18n";
import { CartLink } from "./cart-badge";
import { MenuIcon, SearchIcon, UserIcon } from "./icons";

export function Announcement({ info, lang }: { info: StoreInfo; lang: Lang }) {
  const text = lang === "bn" && info.announcementBn ? info.announcementBn : info.announcement;
  return text ? <div className="announce" role="note">{text}</div> : null;
}

export function Header({ info, categories, lang, t, points }: { info: StoreInfo; categories: CategoryCard[]; lang: Lang; t: T; points?: { available: number; worthBdt: number } | null }) {
  const nav = [{ href: "/search?sort=newest", label: t("newArrivals") }, ...categories.slice(0, 4).map((c) => ({ href: `/c/${c.slug}`, label: c.name })), { href: "/search?sale=1", label: t("sale") }];
  const other: Lang = lang === "bn" ? "en" : "bn";
  return (
    <header className="header">
      <div className="wrap bar">
        <details className="menu">
          <summary className="icon-btn" aria-label={t("menu")}><MenuIcon /></summary>
          <nav className="menu-panel" aria-label={t("menu")}>
            {nav.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
            <Link href="/account">{t("account")}</Link>
          </nav>
        </details>
        <Link href="/" className="logo" aria-label={info.storeName}>
          {info.logoUrl ? <Image src={info.logoUrl} alt={info.storeName} width={140} height={36} priority /> : "KAPOR"}
        </Link>
        <nav className="nav-desktop" aria-label={t("menu")}>
          {nav.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
        </nav>
        <div className="header-tools">
          <form action="/search" role="search" className="search-pill">
            <SearchIcon />
            <input name="q" type="search" placeholder={t("searchPlaceholder")} aria-label={t("search")} />
          </form>
          <form action={setLanguage.bind(null, other)}><button className="lang-btn" type="submit" lang={other}>{t("switchLang")}</button></form>
          {points && <Link href="/account" className="pts-pill" data-testid="points-pill" aria-label={`${t("pointsCount", { n: points.available })}, ${t("pointsWorth", { v: points.worthBdt })}`}><span aria-hidden="true">✨</span> {points.available} <span className="muted">({money(points.worthBdt, lang)})</span></Link>}
          <Link href="/account" className="icon-btn" aria-label={t("account")}><UserIcon /></Link>
        </div>
        <CartLink label={t("cart")} labelWithCount={t("cartItems", { n: "{n}" })} />
      </div>
    </header>
  );
}
