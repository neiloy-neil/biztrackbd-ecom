import Link from "next/link";
import type { CategoryCard, StoreInfo } from "@biztrackbd/core";
import { setLanguage } from "@/app/actions";
import type { Lang, T } from "@/lib/i18n";

export function Footer({ info, categories, lang, t, pages = [], hasBlog = false }: { info: StoreInfo; categories: CategoryCard[]; lang: Lang; t: T; pages?: { title: string; slug: string }[]; hasBlog?: boolean }) {
  const other: Lang = lang === "bn" ? "en" : "bn";
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="cols">
          <div>
            <div className="brand">{info.storeName.toUpperCase()}</div>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 12, maxWidth: 320 }}>
              {[info.tagline, info.addressLine].filter(Boolean).join(". ")}
            </p>
          </div>
          <div>
            <b>{t("shop")}</b>
            {categories.slice(0, 6).map((c) => <Link key={c.id} href={`/c/${c.slug}`}>{c.name}</Link>)}
            <Link href="/search">{t("all")}</Link>
          </div>
          <div>
            <b>{t("help")}</b>
            {info.contactPhone && <a href={`tel:${info.contactPhone}`}>{t("contact")} {info.contactPhone}</a>}
            {info.whatsappNumber && <a href={`https://wa.me/88${info.whatsappNumber}`} rel="noopener noreferrer">WhatsApp</a>}
            {info.facebookUrl && <a href={info.facebookUrl} rel="noopener noreferrer">Facebook</a>}
            <Link href="/account">{t("account")}</Link>
            {hasBlog && <Link href="/blog">{t("blog")}</Link>}
            {pages.map((p) => <Link key={p.slug} href={`/p/${p.slug}`}>{p.title}</Link>)}
          </div>
        </div>
        <div className="legal">
          <span>© {new Date().getFullYear()} {info.storeName}</span>
          <form action={setLanguage.bind(null, other)}><button className="lang-btn" type="submit" lang={other} style={{ color: "inherit", minHeight: 32 }}>{t("switchLang")}</button></form>
          <span>{t("poweredBy")}</span>
        </div>
      </div>
    </footer>
  );
}
