"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@biztrackbd/ui";
import { MAX_COLUMN_LINKS, MAX_FOOTER_COLUMNS, MAX_MENU_ITEMS, linkHref, newChromeId, type Chrome, type ColumnType, type FooterColumn, type LinkType, type NavLink } from "@biztrackbd/core/builder-client";
import { discardChromeAction, publishChromeAction, rollbackChromeAction, saveChromeAction } from "./actions";

type Tab = "header" | "menu" | "footer" | "history";

export interface ChromeEditorProps {
  initial: Chrome;
  stamp: string | null;
  hasDraft: boolean;
  unpublished: boolean;
  publishedVersion: number | null;
  versions: { version: number; label: string | null; createdAt: string; isLive: boolean }[];
  editable: boolean;
  canEdit: boolean;
  previewUrl: string;
  previewOrigin: string;
  liveUrl: string;
  categories: { slug: string; name: string }[];
  pages: { slug: string; title: string }[];
  pageChoices: { key: string; label: string }[];
}

const LINK_LABEL: Record<LinkType, string> = { new: "New arrivals", sale: "Sale", all: "All products", blog: "Blog", category: "A category", page: "A page", link: "An address" };
const COLUMN_LABEL: Record<ColumnType, string> = {
  about: "Store name and story", shop: "Shop (your categories)", help: "Help (contact, account, pages)", links: "A list of links", text: "Text",
  contact: "Contact details", social: "Social links", payments: "Payment methods",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** One link: what kind it is, its words, and where it points. Used by the menu and by a footer list of links. */
function LinkRow({ link, onChange, onUp, onDown, onRemove, categories, pages, disabled, canUp, canDown }: {
  link: NavLink; onChange: (l: NavLink) => void; onUp: () => void; onDown: () => void; onRemove: () => void; categories: ChromeEditorProps["categories"]; pages: ChromeEditorProps["pages"]; disabled: boolean; canUp: boolean; canDown: boolean;
}) {
  const set = (p: Partial<NavLink>) => onChange({ ...link, ...p });
  const needsWords = link.type === "page" || link.type === "link";
  return (
    <div className="bld-item" data-testid="chrome-link">
      <div className="stack" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <select className="select" value={link.type} disabled={disabled} aria-label="What it links to" onChange={(e) => set({ type: e.target.value as LinkType, ref: "", url: "" })} style={{ flex: "1 1 150px" }}>
            {(Object.keys(LINK_LABEL) as LinkType[]).map((t) => <option key={t} value={t}>{LINK_LABEL[t]}</option>)}
          </select>
          <span className="row" style={{ gap: 4 }}>
            <button type="button" className="bld-ib" disabled={disabled || !canUp} onClick={onUp} aria-label="Move up">↑</button>
            <button type="button" className="bld-ib" disabled={disabled || !canDown} onClick={onDown} aria-label="Move down">↓</button>
            <button type="button" className="bld-ib danger" disabled={disabled} onClick={onRemove} aria-label="Remove this link">✕</button>
          </span>
        </div>
        {link.type === "category" && (
          <select className="select" value={link.ref} disabled={disabled} aria-label="Category" onChange={(e) => set({ ref: e.target.value })}>
            <option value="">Choose a category</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        )}
        {link.type === "page" && (
          <select className="select" value={link.ref} disabled={disabled} aria-label="Page" onChange={(e) => { const p = pages.find((x) => x.slug === e.target.value); set({ ref: e.target.value, label: link.label || p?.title || "" }); }}>
            <option value="">Choose a page</option>
            {pages.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
          </select>
        )}
        {link.type === "link" && <input className="input" value={link.url} disabled={disabled} placeholder="https://… or /search" aria-label="Address" maxLength={300} onChange={(e) => set({ url: e.target.value })} />}
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <input className="input" value={link.label} disabled={disabled} placeholder={needsWords ? "Words to show" : "Words to show (optional)"} aria-label="Words to show" maxLength={40} onChange={(e) => set({ label: e.target.value })} style={{ flex: "1 1 130px" }} />
          <input className="input" value={link.labelBn} disabled={disabled} placeholder="বাংলা (optional)" aria-label="Words in Bangla" maxLength={40} onChange={(e) => set({ labelBn: e.target.value })} style={{ flex: "1 1 130px" }} />
        </div>
        <span className="muted" style={{ fontSize: 12 }}>Goes to {linkHref(link) || "…"}</span>
      </div>
    </div>
  );
}

const blankLink = (): NavLink => ({ id: newChromeId("link"), type: "all", label: "", labelBn: "", ref: "", url: "" });
const blankColumn = (): FooterColumn => ({ id: newChromeId("col"), type: "text", title: "", titleBn: "", body: "", bodyBn: "", links: [] });

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function ChromeEditor(props: ChromeEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [chrome, setChrome] = useState<Chrome>(props.initial);
  const [tab, setTab] = useState<Tab>("header");
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">(props.hasDraft ? "saved" : "idle");
  const [dirty, setDirty] = useState(props.unpublished);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ stamp: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touched = useRef(false);
  const stampRef = useRef<string | null>(props.stamp);
  const latest = useRef(chrome);
  latest.current = chrome;
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const disabled = !props.canEdit || !props.editable;

  const refreshPreview = useCallback(() => frame.current?.contentWindow?.postMessage({ type: "bt-preview:refresh" }, props.previewOrigin), [props.previewOrigin]);

  /** One save at a time, each from the stamp the last one returned, so two saves in flight never collide with each other. */
  const persist = useCallback(() => {
    const run = chain.current.then(async () => {
      const r = await saveChromeAction(latest.current, stampRef.current);
      if (r.ok && r.stamp) stampRef.current = r.stamp;
      return r;
    });
    chain.current = run.catch(() => undefined);
    return run;
  }, []);

  useEffect(() => {
    if (!touched.current || disabled) return;
    setSave("saving");
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await persist();
      if (r.ok) { setSave("saved"); setError(null); refreshPreview(); }
      else if (r.conflict) { setSave("error"); setConflict(r.conflict); }
      else { setSave("error"); setError(r.error); }
    }, 700);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [chrome, disabled, persist, refreshPreview]);

  const edit = (fn: (c: Chrome) => Chrome) => { touched.current = true; setChrome(fn); };
  const setHeader = (p: Partial<Chrome["header"]>) => edit((c) => ({ ...c, header: { ...c.header, ...p } }));
  const setAnn = (p: Partial<Chrome["header"]["announcement"]>) => edit((c) => ({ ...c, header: { ...c.header, announcement: { ...c.header.announcement, ...p } } }));
  const setMenu = (p: Partial<Chrome["menu"]>) => edit((c) => ({ ...c, menu: { ...c.menu, ...p } }));
  const setFooter = (p: Partial<Chrome["footer"]>) => edit((c) => ({ ...c, footer: { ...c.footer, ...p } }));
  const setColumn = (i: number, p: Partial<FooterColumn>) => setFooter({ columns: chrome.footer.columns.map((c, j) => (j === i ? { ...c, ...p } : c)) });

  async function flush(): Promise<boolean> {
    if (timer.current) clearTimeout(timer.current);
    const r = await persist();
    if (!r.ok) { setSave("error"); if (r.conflict) setConflict(r.conflict); else setError(r.error); return false; }
    setSave("saved"); setError(null);
    return true;
  }
  async function publish() {
    setBusy(true);
    if (!disabled && (touched.current ? await flush() : true)) {
      const r = await publishChromeAction(label);
      if (r.ok) { toast(`Published as version ${r.version}`); setLabel(""); setDirty(false); router.refresh(); }
      else setError(r.error);
    }
    setBusy(false);
  }
  async function discard() { setBusy(true); const r = await discardChromeAction(); if (r.ok) router.refresh(); else setError(r.error); setBusy(false); }
  async function restore(v: number) { setBusy(true); const r = await rollbackChromeAction(v); if (r.ok) { toast(`Went back to version ${v}`); router.refresh(); } else setError(r.error); setBusy(false); }
  async function keepMine(stamp: string | null) { stampRef.current = stamp; setConflict(null); setBusy(true); await flush(); setBusy(false); }

  const chip = disabled ? "grey" : save === "error" ? "bad" : dirty || save === "saving" ? "warn" : "ok";
  const chipText = disabled ? "View only" : save === "saving" ? "Saving…" : save === "error" ? "Not saved" : dirty ? "Draft" : props.publishedVersion ? `Live v${props.publishedVersion}` : "Not published";

  const header = (
    <div className="stack" style={{ gap: 14 }} data-testid="chrome-header-tab">
      <div className="bld-group">
        <div className="bld-gh">Header</div>
        <div className="stack" style={{ gap: 10 }}>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="ch-logo">Logo and menu layout (computer)</label>
            <select id="ch-logo" className="select" value={chrome.header.logo} disabled={disabled} onChange={(e) => setHeader({ logo: e.target.value as Chrome["header"]["logo"] })}>
              <option value="left">Logo on the left, menu in the middle</option><option value="center">Logo in the centre, menu on the left</option><option value="stacked">Logo on top, menu underneath</option>
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="ch-search">Search</label>
            <select id="ch-search" className="select" value={chrome.header.search} disabled={disabled} onChange={(e) => setHeader({ search: e.target.value as Chrome["header"]["search"] })}>
              <option value="bar">A search box</option><option value="icon">A search icon</option><option value="none">No search in the header</option>
            </select>
          </div>
          <label className="check"><input type="checkbox" checked={chrome.header.sticky} disabled={disabled} onChange={(e) => setHeader({ sticky: e.target.checked })} /><span>Keep the header at the top while scrolling</span></label>
          <label className="check"><input type="checkbox" checked={chrome.header.showLanguage} disabled={disabled} onChange={(e) => setHeader({ showLanguage: e.target.checked })} /><span>Show the English / Bangla switch</span></label>
          <label className="check"><input type="checkbox" checked={chrome.header.showAccount} disabled={disabled} onChange={(e) => setHeader({ showAccount: e.target.checked })} /><span>Show the account icon</span></label>
        </div>
      </div>
      <div className="bld-group">
        <div className="bld-gh">Announcement bar (every page)</div>
        <div className="stack" style={{ gap: 10 }}>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="ch-ann">Show</label>
            <select id="ch-ann" className="select" value={chrome.header.announcement.mode} disabled={disabled} onChange={(e) => { const mode = e.target.value as Chrome["header"]["announcement"]["mode"]; setAnn({ mode, ...(mode === "custom" && !chrome.header.announcement.text ? { text: "Free delivery on orders over ৳ 3,000" } : {}) }); }}>
              <option value="settings">The line from your store settings</option><option value="custom">My own line</option><option value="off">Nothing</option>
            </select>
          </div>
          {chrome.header.announcement.mode === "custom" && (
            <>
              <input className="input" value={chrome.header.announcement.text} disabled={disabled} maxLength={140} placeholder="Free delivery over ৳ 3,000" aria-label="Announcement" onChange={(e) => setAnn({ text: e.target.value })} />
              <input className="input" value={chrome.header.announcement.textBn} disabled={disabled} maxLength={140} placeholder="বাংলা (optional)" aria-label="Announcement in Bangla" onChange={(e) => setAnn({ textBn: e.target.value })} />
              <input className="input" value={chrome.header.announcement.link} disabled={disabled} maxLength={300} placeholder="Link (optional): https://… or /search?sale=1" aria-label="Announcement link" onChange={(e) => setAnn({ link: e.target.value })} />
              <div className="row" style={{ gap: 8 }}>
                <label className="field" style={{ margin: 0, flex: 1 }}><span className="label">Background</span><input type="color" value={chrome.header.announcement.bgColor} disabled={disabled} onChange={(e) => setAnn({ bgColor: e.target.value.toUpperCase() })} style={{ width: "100%", height: 40 }} /></label>
                <label className="field" style={{ margin: 0, flex: 1 }}><span className="label">Text</span><input type="color" value={chrome.header.announcement.textColor} disabled={disabled} onChange={(e) => setAnn({ textColor: e.target.value.toUpperCase() })} style={{ width: "100%", height: 40 }} /></label>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const menu = (
    <div className="stack" style={{ gap: 12 }} data-testid="chrome-menu-tab">
      <label className="check"><input type="checkbox" checked={chrome.menu.auto} disabled={disabled} onChange={(e) => setMenu({ auto: e.target.checked, items: e.target.checked || chrome.menu.items.length ? chrome.menu.items : [{ ...blankLink(), type: "new" }, { ...blankLink(), type: "sale" }] })} /><span>Fill the menu for me: new arrivals, your first categories and sale</span></label>
      {!chrome.menu.auto && (
        <>
          <p className="muted" style={{ fontSize: 13 }}>Up to {MAX_MENU_ITEMS} items. The same list is the menu on a phone.</p>
          {chrome.menu.items.map((l, i) => (
            <LinkRow key={l.id} link={l} disabled={disabled} categories={props.categories} pages={props.pages} canUp={i > 0} canDown={i < chrome.menu.items.length - 1}
              onChange={(n) => setMenu({ items: chrome.menu.items.map((x, j) => (j === i ? n : x)) })} onUp={() => setMenu({ items: move(chrome.menu.items, i, -1) })} onDown={() => setMenu({ items: move(chrome.menu.items, i, 1) })} onRemove={() => setMenu({ items: chrome.menu.items.filter((_, j) => j !== i) })} />
          ))}
          {chrome.menu.items.length < MAX_MENU_ITEMS && !disabled && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMenu({ items: [...chrome.menu.items, blankLink()] })} data-testid="add-menu-item">Add a menu item</button>}
        </>
      )}
    </div>
  );

  const footer = (
    <div className="stack" style={{ gap: 14 }} data-testid="chrome-footer-tab">
      <p className="muted" style={{ fontSize: 13 }}>1 to {MAX_FOOTER_COLUMNS} columns. Contact details and social links come from your store settings.</p>
      {chrome.footer.columns.map((c, i) => (
        <div className="bld-item" key={c.id} data-testid="footer-column">
          <div className="stack" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <select className="select" value={c.type} disabled={disabled} aria-label={`Column ${i + 1} contents`} onChange={(e) => setColumn(i, { type: e.target.value as ColumnType })} style={{ flex: "1 1 170px" }}>
                {(Object.keys(COLUMN_LABEL) as ColumnType[]).map((t) => <option key={t} value={t}>{COLUMN_LABEL[t]}</option>)}
              </select>
              <span className="row" style={{ gap: 4 }}>
                <button type="button" className="bld-ib" disabled={disabled || i === 0} onClick={() => setFooter({ columns: move(chrome.footer.columns, i, -1) })} aria-label="Move column left">←</button>
                <button type="button" className="bld-ib" disabled={disabled || i === chrome.footer.columns.length - 1} onClick={() => setFooter({ columns: move(chrome.footer.columns, i, 1) })} aria-label="Move column right">→</button>
                <button type="button" className="bld-ib danger" disabled={disabled || chrome.footer.columns.length <= 1} onClick={() => setFooter({ columns: chrome.footer.columns.filter((_, j) => j !== i) })} aria-label="Remove this column">✕</button>
              </span>
            </div>
            {c.type !== "about" && (
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <input className="input" value={c.title} disabled={disabled} maxLength={40} placeholder="Heading (optional)" aria-label="Heading" onChange={(e) => setColumn(i, { title: e.target.value })} style={{ flex: "1 1 130px" }} />
                <input className="input" value={c.titleBn} disabled={disabled} maxLength={40} placeholder="বাংলা (optional)" aria-label="Heading in Bangla" onChange={(e) => setColumn(i, { titleBn: e.target.value })} style={{ flex: "1 1 130px" }} />
              </div>
            )}
            {c.type === "text" && (
              <>
                <textarea className="textarea" rows={3} value={c.body} disabled={disabled} maxLength={400} placeholder="Your words" aria-label="Text" onChange={(e) => setColumn(i, { body: e.target.value })} style={{ padding: 10 }} />
                <textarea className="textarea" rows={2} value={c.bodyBn} disabled={disabled} maxLength={400} placeholder="বাংলা (optional)" aria-label="Text in Bangla" onChange={(e) => setColumn(i, { bodyBn: e.target.value })} style={{ padding: 10 }} />
              </>
            )}
            {c.type === "links" && (
              <>
                {c.links.map((l, k) => (
                  <LinkRow key={l.id} link={l} disabled={disabled} categories={props.categories} pages={props.pages} canUp={k > 0} canDown={k < c.links.length - 1}
                    onChange={(n) => setColumn(i, { links: c.links.map((x, j) => (j === k ? n : x)) })} onUp={() => setColumn(i, { links: move(c.links, k, -1) })} onDown={() => setColumn(i, { links: move(c.links, k, 1) })} onRemove={() => setColumn(i, { links: c.links.filter((_, j) => j !== k) })} />
                ))}
                {c.links.length < MAX_COLUMN_LINKS && !disabled && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setColumn(i, { links: [...c.links, blankLink()] })}>Add a link</button>}
              </>
            )}
          </div>
        </div>
      ))}
      {chrome.footer.columns.length < MAX_FOOTER_COLUMNS && !disabled && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFooter({ columns: [...chrome.footer.columns, blankColumn()] })} data-testid="add-column">Add a column</button>}
      <div className="bld-group">
        <div className="bld-gh">Bottom line</div>
        <div className="stack" style={{ gap: 8 }}>
          <input className="input" value={chrome.footer.copyright} disabled={disabled} maxLength={120} placeholder={`© ${new Date().getFullYear()} Your store (leave empty for this)`} aria-label="Bottom line" onChange={(e) => setFooter({ copyright: e.target.value })} />
          <input className="input" value={chrome.footer.copyrightBn} disabled={disabled} maxLength={120} placeholder="বাংলা (optional)" aria-label="Bottom line in Bangla" onChange={(e) => setFooter({ copyrightBn: e.target.value })} />
        </div>
      </div>
    </div>
  );

  const history = (
    <section className="stack" data-testid="chrome-history">
      {props.canEdit && props.editable && (
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="ch-label">Name for the next version (optional)</label>
          <input id="ch-label" className="input" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="For example: Eid menu" />
        </div>
      )}
      {props.versions.length === 0 && <p className="muted">Nothing has been published yet. Your store shows its built-in header and footer.</p>}
      <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
        {props.versions.map((v) => (
          <li key={v.version} className="row" style={{ justifyContent: "space-between" }}>
            <span><b>Version {v.version}</b> {v.isLive && <span className="pill ok">Live</span>}<br /><span className="muted" style={{ fontSize: 13 }}>{when(v.createdAt)}{v.label ? ` · ${v.label}` : ""}</span></span>
            {props.canEdit && props.editable && !v.isLive && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => restore(v.version)}>Go back to this</button>}
          </li>
        ))}
      </ul>
      {props.canEdit && props.editable && props.hasDraft && <button type="button" className="btn btn-secondary" onClick={discard} disabled={busy}>Throw away my unpublished changes</button>}
    </section>
  );

  const tabs: { id: Tab; label: string }[] = [{ id: "header", label: "Header" }, { id: "menu", label: "Menu" }, { id: "footer", label: "Footer" }, { id: "history", label: "History" }];

  return (
    <div className="bld" data-testid="chrome-editor">
      <header className="bld-top">
        <Link href="/" className="bld-exit" aria-label="Exit the editor">← <span>Exit</span></Link>
        <div className="bld-title">
          <select className="bld-page" value="chrome" disabled={busy} onChange={(e) => router.push(e.target.value === "home" ? "/design" : `/design?page=${e.target.value}`)} aria-label="Page being edited" data-testid="page-switch">
            {props.pageChoices.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <span className="bld-status" data-testid="chrome-status" role="status" aria-live="polite"><span className={`bld-chip ${chip}`}>{chipText}</span></span>
        </div>
        <div className="bld-tools">
          <a href={props.liveUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">View live page</a>
          {props.canEdit && props.editable && <button type="button" className="btn btn-primary btn-sm" onClick={publish} disabled={busy || save === "saving" || (!dirty && !props.hasDraft)} data-testid="publish">{busy ? "Working…" : "Publish"}</button>}
        </div>
      </header>
      {(conflict || error || !props.editable) && (
        <div className="bld-alerts">
          {!props.editable && <div className="notice" role="note" data-testid="chrome-locked">Editing the header and footer is part of the Pro plan and above. <Link className="link" href="/billing">See plans</Link></div>}
          {conflict && (
            <div className="notice bad" role="alert" data-testid="design-conflict">
              <b>Someone else changed this while you were editing it.</b> Your changes are not saved yet.
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => router.refresh()}>Load their version</button>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => keepMine(conflict.stamp)}>Keep mine</button>
              </div>
            </div>
          )}
          {error && <div className="notice bad" role="alert" data-testid="design-error">{error}</div>}
        </div>
      )}
      <div className="bld-body bld-body-chrome">
        <main className="bld-stage">
          <div className="bld-device" style={{ width: "100%", height: "100%" }}>
            <iframe ref={frame} src={props.previewUrl} title="Preview of your header and footer" data-testid="preview-frame" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" />
          </div>
        </main>
        <aside className="bld-right" aria-label="Header and footer">
          <div className="bld-tabs" role="tablist" aria-label="Editor">
            {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}>{t.label}</button>)}
          </div>
          <div className="bld-panel-body">{tab === "header" ? header : tab === "menu" ? menu : tab === "footer" ? footer : history}</div>
        </aside>
      </div>
    </div>
  );
}
