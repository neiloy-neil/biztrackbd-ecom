import Link from "next/link";
import { linkHref, type CategoryCard, type Chrome, type FooterColumn, type StoreInfo } from "@biztrackbd/core";
import { setLanguage } from "@/app/actions";
import type { Lang, T } from "@/lib/i18n";
import { linkLabel } from "./header";
import { PlatformCredit } from "./platform-credit";
import { ContactIcon } from "@biztrackbd/ui";

/** A store keeps its WhatsApp number as typed (01XXXXXXXXX or with 880): wa.me wants the international digits. */
const waHref = (n: string) => {
  const d = n.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("880") ? d : d.startsWith("0") ? `88${d}` : `880${d}`}`;
};

/** The store's contact and social links, each with its icon. Only what the owner filled in is shown. */
function ContactLinks({ info, only }: { info: StoreInfo; only?: ("email" | "phone" | "whatsapp" | "facebook" | "instagram")[] }) {
  const show = (k: "email" | "phone" | "whatsapp" | "facebook" | "instagram") => !only || only.includes(k);
  return (
    <>
      {show("phone") && info.contactPhone && <a className="ficon" href={`tel:${info.contactPhone}`}><ContactIcon name="phone" size={16} /><span>{info.contactPhone}</span></a>}
      {show("whatsapp") && info.whatsappNumber && <a className="ficon" href={waHref(info.whatsappNumber)} target="_blank" rel="noopener noreferrer"><ContactIcon name="whatsapp" size={16} /><span>WhatsApp</span></a>}
      {show("email") && info.email && <a className="ficon" href={`mailto:${info.email}`}><ContactIcon name="email" size={16} /><span>{info.email}</span></a>}
      {show("facebook") && info.facebookUrl && <a className="ficon" href={info.facebookUrl} target="_blank" rel="noopener noreferrer"><ContactIcon name="facebook" size={16} /><span>Facebook</span></a>}
      {show("instagram") && info.instagramUrl && <a className="ficon" href={info.instagramUrl} target="_blank" rel="noopener noreferrer"><ContactIcon name="instagram" size={16} /><span>Instagram</span></a>}
    </>
  );
}

type Pages = { title: string; slug: string }[];

/** The default three columns: the store's name and story, the shop, and help. Kept exactly as it has always been. */
function DefaultColumns({ info, categories, t, pages, hasBlog, commerce = true }: { info: StoreInfo; categories: CategoryCard[]; t: T; pages: Pages; hasBlog: boolean; commerce?: boolean }) {
  return (
    <div className="cols">
      <About info={info} />
      {commerce && <Shop title={t("shop")} categories={categories} t={t} />}
      <Help title={t("help")} info={info} t={t} pages={pages} hasBlog={hasBlog} commerce={commerce} />
    </div>
  );
}

const About = ({ info }: { info: StoreInfo }) => (
  <div>
    <div className="brand">{info.storeName.toUpperCase()}</div>
    <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 12, maxWidth: 320 }}>{[info.tagline, info.addressLine].filter(Boolean).join(". ")}</p>
  </div>
);
const Shop = ({ title, categories, t }: { title: string; categories: CategoryCard[]; t: T }) => (
  <div>
    <b>{title}</b>
    {categories.slice(0, 6).map((c) => <Link key={c.id} href={`/c/${c.slug}`}>{c.name}</Link>)}
    <Link href="/search">{t("all")}</Link>
  </div>
);
const Help = ({ title, info, t, pages, hasBlog, commerce = true }: { title: string; info: StoreInfo; t: T; pages: Pages; hasBlog: boolean; commerce?: boolean }) => (
  <div>
    <b>{title}</b>
    <ContactLinks info={info} />
    {commerce && <Link href="/account">{t("account")}</Link>}
    <Link href="/contact">{t("contact")}</Link>
    {hasBlog && <Link href="/blog">{t("blog")}</Link>}
    {pages.map((p) => <Link key={p.slug} href={`/${p.slug}`}>{p.title}</Link>)}
  </div>
);

/** One column of a footer the merchant built. Each kind draws from the store's own details, so nothing has to be typed twice. */
function Column({ c, info, categories, lang, t, pages, hasBlog }: { c: FooterColumn; info: StoreInfo; categories: CategoryCard[]; lang: Lang; t: T; pages: Pages; hasBlog: boolean }) {
  const title = (lang === "bn" && c.titleBn ? c.titleBn : c.title);
  const body = (lang === "bn" && c.bodyBn ? c.bodyBn : c.body);
  switch (c.type) {
    case "about": return <About info={info} />;
    case "shop": return <Shop title={title || t("shop")} categories={categories} t={t} />;
    case "help": return <Help title={title || t("help")} info={info} t={t} pages={pages} hasBlog={hasBlog} />;
    case "links":
      return (
        <div>
          {title && <b>{title}</b>}
          {c.links.map((l) => {
            const href = linkHref(l);
            const label = linkLabel(l, lang, t, categories);
            return href.startsWith("/") ? <Link key={l.id} href={href}>{label}</Link> : <a key={l.id} href={href} rel="noopener noreferrer">{label}</a>;
          })}
        </div>
      );
    case "text":
      return (
        <div>
          {title && <b>{title}</b>}
          {body.split(/\n{2,}/).filter(Boolean).map((p, i) => <p key={i} style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 360, marginBottom: 8 }}>{p}</p>)}
        </div>
      );
    case "contact":
      return (
        <div>
          <b>{title || t("contact")}</b>
          <ContactLinks info={info} only={["phone", "whatsapp", "email"]} />
          {info.addressLine && <p style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 300 }}>{info.addressLine}</p>}
        </div>
      );
    case "social":
      return (
        <div>
          <b>{title || (lang === "bn" ? "আমাদের অনুসরণ করুন" : "Follow us")}</b>
          <ContactLinks info={info} only={["facebook", "instagram", "whatsapp"]} />
        </div>
      );
    case "payments":
      return (
        <div>
          <b>{title || (lang === "bn" ? "পেমেন্ট" : "We accept")}</b>
          <p style={{ fontSize: 14, lineHeight: 1.8 }}>{t("cod")}<br />{t("bkash")}<br />{t("nagad")}</p>
        </div>
      );
    default: return null;
  }
}

export function Footer({ info, categories, lang, t, pages = [], hasBlog = false, chrome, commerce = true }: { info: StoreInfo; categories: CategoryCard[]; lang: Lang; t: T; pages?: Pages; hasBlog?: boolean; chrome?: Chrome | null; commerce?: boolean }) {
  const other: Lang = lang === "bn" ? "en" : "bn";
  const cols = chrome?.footer.columns;
  // The first column is wider when it is the store's own name and story, as in the default footer.
  const template = cols ? (cols[0]?.type === "about" && cols.length > 1 ? `2fr ${Array(cols.length - 1).fill("1fr").join(" ")}` : Array(cols.length).fill("1fr").join(" ")) : undefined;
  const copyright = chrome ? (lang === "bn" && chrome.footer.copyrightBn ? chrome.footer.copyrightBn : chrome.footer.copyright) : "";
  return (
    <footer className="footer">
      <div className="wrap">
        {cols ? (
          <div className="cols" style={{ ["--cols" as string]: template }}>
            {cols.map((c) => <Column key={c.id} c={c} info={info} categories={categories} lang={lang} t={t} pages={pages} hasBlog={hasBlog} />)}
          </div>
        ) : <DefaultColumns info={info} categories={categories} t={t} pages={pages} hasBlog={hasBlog} commerce={commerce} />}
        <div className="legal">
          <span>{copyright || `© ${new Date().getFullYear()} ${info.storeName}`}</span>
          <form action={setLanguage.bind(null, other)}><button className="lang-btn" type="submit" lang={other} style={{ color: "inherit", minHeight: 32 }}>{t("switchLang")}</button></form>
        </div>
        <PlatformCredit t={t} />
      </div>
    </footer>
  );
}
