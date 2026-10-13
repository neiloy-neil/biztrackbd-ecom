import { ValidationError } from "../errors";
import { safeUrl } from "./registry";

/**
 * The header and footer of a store, built by the merchant (docs/47 part C). It is one small validated record, not a list of sections: the
 * storefront has fixed header and footer components, and this chooses how they are laid out and what they link to. Nothing here is HTML or
 * script: text is shown as text, links are a fixed kind plus a slug (or an https address), colours are hex, everything else is a choice.
 * A store that never saves one keeps today's header and footer exactly.
 */

export const MAX_MENU_ITEMS = 8;
export const MAX_FOOTER_COLUMNS = 4;
export const MAX_COLUMN_LINKS = 8;

export const LINK_TYPES = ["new", "sale", "all", "blog", "category", "page", "link"] as const;
export type LinkType = (typeof LINK_TYPES)[number];
export const COLUMN_TYPES = ["about", "shop", "help", "links", "text", "contact", "social", "payments"] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export interface NavLink {
  id: string;
  type: LinkType;
  /** Shown instead of the built-in words. Needed for a page or an address; optional for the rest. */
  label: string;
  labelBn: string;
  /** The slug of a category or a page. */
  ref: string;
  /** An https address, or a path on the store, for type "link". */
  url: string;
}

export interface FooterColumn {
  id: string;
  type: ColumnType;
  title: string;
  titleBn: string;
  body: string;
  bodyBn: string;
  links: NavLink[];
}

export interface Chrome {
  version: 1;
  header: {
    logo: "left" | "center" | "stacked";
    sticky: boolean;
    search: "bar" | "icon" | "none";
    showLanguage: boolean;
    showAccount: boolean;
    announcement: { mode: "settings" | "custom" | "off"; text: string; textBn: string; link: string; bgColor: string; textColor: string };
  };
  menu: { auto: boolean; items: NavLink[] };
  footer: { columns: FooterColumn[]; copyright: string; copyrightBn: string };
}

const col = (id: string, type: ColumnType): FooterColumn => ({ id, type, title: "", titleBn: "", body: "", bodyBn: "", links: [] });

/** Today's header and footer, as a record. */
export function defaultChrome(): Chrome {
  return {
    version: 1,
    header: { logo: "left", sticky: true, search: "bar", showLanguage: true, showAccount: true, announcement: { mode: "settings", text: "", textBn: "", link: "", bgColor: "#2B2118", textColor: "#FFFFFF" } },
    menu: { auto: true, items: [] },
    footer: { columns: [col("about", "about"), col("shop", "shop"), col("help", "help")], copyright: "", copyrightBn: "" },
  };
}

const ID = /^[a-z0-9_-]{3,40}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
// Control characters are removed on purpose: text from the editor must not carry them into the page.
// eslint-disable-next-line no-control-regex
const plain = (v: unknown, max: number): string => (typeof v === "string" ? v : "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/<[^>]*>/g, "").trim().slice(0, max);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function choose<T extends string>(v: unknown, allowed: readonly T[], fallback: T, label: string): T {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  throw new ValidationError(`${label} is not one of the choices`);
}

function link(raw: unknown, where: string, seen: Set<string>): NavLink {
  const o = obj(raw);
  const id = typeof o.id === "string" ? o.id : "";
  if (!ID.test(id)) throw new ValidationError(`${where} has a bad id`);
  if (seen.has(id)) throw new ValidationError(`Two links share the id ${id}`);
  seen.add(id);
  const type = choose(o.type, LINK_TYPES, "all", `${where}: type`);
  const label = plain(o.label, 40);
  const labelBn = plain(o.labelBn, 40);
  const ref = plain(o.ref, 80).toLowerCase();
  const url = typeof o.url === "string" ? o.url.trim() : "";
  if ((type === "category" || type === "page") && !SLUG.test(ref)) throw new ValidationError(`${where}: choose ${type === "page" ? "a page" : "a category"}`);
  if (type === "link") {
    if (!url || url.length > 300 || !safeUrl(url)) throw new ValidationError(`${where}: the address must start with https:// or /`);
  }
  if ((type === "page" || type === "link") && !label) throw new ValidationError(`${where}: write the words to show`);
  return { id, type, label, labelBn, ref: type === "category" || type === "page" ? ref : "", url: type === "link" ? url : "" };
}

function links(raw: unknown, max: number, where: string): NavLink[] {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > max) throw new ValidationError(`${where}: at most ${max} links`);
  const seen = new Set<string>();
  return list.map((l, i) => link(l, `${where}, link ${i + 1}`, seen));
}

/** Cleans a whole header and footer. Unknown keys are dropped, bad values refused with a plain message; anything missing takes today's value. */
export function validateChrome(raw: unknown): Chrome {
  const d = defaultChrome();
  const o = obj(raw);
  const h = obj(o.header);
  const a = obj(h.announcement);
  const mode = choose(a.mode, ["settings", "custom", "off"] as const, d.header.announcement.mode, "Announcement");
  const bg = typeof a.bgColor === "string" && a.bgColor ? a.bgColor : d.header.announcement.bgColor;
  const fg = typeof a.textColor === "string" && a.textColor ? a.textColor : d.header.announcement.textColor;
  if (!HEX.test(bg) || !HEX.test(fg)) throw new ValidationError("Announcement colours must look like #2B2118");
  const url = typeof a.link === "string" ? a.link.trim() : "";
  if (url && (url.length > 300 || !safeUrl(url))) throw new ValidationError("The announcement link must start with https:// or /");
  const text = plain(a.text, 140);
  if (mode === "custom" && !text) throw new ValidationError("Write the announcement, or switch it off");

  const m = obj(o.menu);
  const items = links(m.items, MAX_MENU_ITEMS, "Menu");
  const auto = bool(m.auto, true);
  if (!auto && items.length === 0) throw new ValidationError("Add at least one menu item, or let the menu fill itself");

  const f = obj(o.footer);
  const cols = Array.isArray(f.columns) ? f.columns : d.footer.columns;
  if (cols.length < 1 || cols.length > MAX_FOOTER_COLUMNS) throw new ValidationError(`The footer has 1 to ${MAX_FOOTER_COLUMNS} columns`);
  const seen = new Set<string>();
  const columns = cols.map((c, i): FooterColumn => {
    const co = obj(c);
    const id = typeof co.id === "string" ? co.id : "";
    if (!ID.test(id) || seen.has(id)) throw new ValidationError(`Footer column ${i + 1} has a bad id`);
    seen.add(id);
    const type = choose(co.type, COLUMN_TYPES, "text", `Footer column ${i + 1}`);
    return {
      id, type, title: plain(co.title, 40), titleBn: plain(co.titleBn, 40), body: plain(co.body, 400), bodyBn: plain(co.bodyBn, 400),
      links: type === "links" ? links(co.links, MAX_COLUMN_LINKS, `Footer column ${i + 1}`) : [],
    };
  });
  if (columns.filter((c) => c.type === "about").length > 1) throw new ValidationError("Only one footer column can be the store's name and story");

  return {
    version: 1,
    header: {
      logo: choose(h.logo, ["left", "center", "stacked"] as const, d.header.logo, "Logo position"),
      sticky: bool(h.sticky, d.header.sticky),
      search: choose(h.search, ["bar", "icon", "none"] as const, d.header.search, "Search"),
      showLanguage: bool(h.showLanguage, true),
      showAccount: bool(h.showAccount, true),
      announcement: { mode, text, textBn: plain(a.textBn, 140), link: url, bgColor: bg.toUpperCase(), textColor: fg.toUpperCase() },
    },
    menu: { auto, items },
    footer: { columns, copyright: plain(f.copyright, 120), copyrightBn: plain(f.copyrightBn, 120) },
  };
}

/** Where a link goes. The storefront draws it; the editor shows it. */
export function linkHref(l: Pick<NavLink, "type" | "ref" | "url">): string {
  switch (l.type) {
    case "new": return "/search?sort=newest";
    case "sale": return "/search?sale=1";
    case "all": return "/search";
    case "blog": return "/blog";
    case "category": return `/c/${encodeURIComponent(l.ref)}`;
    case "page": return `/p/${encodeURIComponent(l.ref)}`;
    default: return l.url;
  }
}

export const newChromeId = (prefix: string): string => `${prefix.replace(/[^a-z0-9]/g, "").slice(0, 10)}_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`.slice(0, 40);
