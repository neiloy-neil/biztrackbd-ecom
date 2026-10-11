"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BellIcon, ChevronIcon, ExternalIcon, SearchIcon } from "@/components/icons";
import { setLangAction } from "@/app/(admin)/lang-actions";

export interface Counts { check: number; newOrders: number; toPack: number; returnsPending: number; lowStock: number; items: { key: string; text: string; href: string; tone: "bad" | "warn" | "info"; count: number }[] }
export interface NavGroup { id: string; label: string; icon: ReactNode; items: { href: string; label: string; exact?: boolean; badge?: "check" }[]; /** Pages that also light this group up, for a group that is one link to a section with its own navigation. */ activePrefixes?: string[] }
export interface Page { href: string; label: string; group: string }
export interface Strings { search: string; searchPlaceholder: string; goTo: string; noMatches: string; typeToSearch: string; notifications: string; allClear: string; viewStore: string }

interface Ctx { counts: Counts; pages: Page[]; strings: Strings; openSearch: () => void; registerSearch: (fn: () => void) => void }
const ShellCtx = createContext<Ctx | null>(null);
const useShell = (): Ctx => {
  const c = useContext(ShellCtx);
  if (!c) throw new Error("ShellProvider is missing");
  return c;
};

const POLL_MS = 30_000;

/** Holds the live counts (sidebar badges and bell) and the page list for the search box. Polls only while the tab is visible. */
export function ShellProvider({ initial, pages, strings, children }: { initial: Counts; pages: Page[]; strings: Strings; children: ReactNode }) {
  const [counts, setCounts] = useState(initial);
  const opener = useRef<() => void>(() => undefined);
  useEffect(() => {
    let stop = false;
    const pull = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/shell/counts", { cache: "no-store" });
        if (r.ok && !stop) setCounts(await r.json());
      } catch { /* offline: keep the last numbers */ }
    };
    const t = setInterval(pull, POLL_MS);
    document.addEventListener("visibilitychange", pull);
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", pull); };
  }, []);
  const value = useMemo<Ctx>(() => ({ counts, pages, strings, openSearch: () => opener.current(), registerSearch: (fn) => { opener.current = fn; } }), [counts, pages, strings]);
  return <ShellCtx.Provider value={value}>{children}</ShellCtx.Provider>;
}

/** Grouped side menu. The group you are in is open; the others fold away, so the list stays short. */
export function SideNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const { counts } = useShell();
  const inGroup = (g: NavGroup) => g.items.some((i) => (i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`))) || (g.activePrefixes ?? []).some((p) => path === p || path.startsWith(`${p}/`));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (g: NavGroup) => open[g.id] ?? inGroup(g);
  return (
    <nav aria-label="Main">
      {groups.map((g) => {
        const active = inGroup(g);
        const single = g.items.length === 1;
        const badge = g.items.some((i) => i.badge === "check") && counts.check > 0 ? counts.check : 0;
        if (single) {
          const it = g.items[0]!;
          return (
            <Link key={g.id} href={it.href} aria-current={active ? "page" : undefined} className="sb-top" prefetch={false}>
              {g.icon}<span className="sb-label">{g.label}</span>
            </Link>
          );
        }
        const expanded = isOpen(g);
        return (
          <div key={g.id} className={`sb-group${active ? " active" : ""}`}>
            <button type="button" className="sb-top" aria-expanded={expanded} aria-controls={`sb-${g.id}`} onClick={() => setOpen((o) => ({ ...o, [g.id]: !expanded }))}>
              {g.icon}<span className="sb-label">{g.label}</span>
              {badge > 0 && !expanded && <span className="count" aria-label={`${badge} payments to check`}>{badge}</span>}
              <ChevronIcon className="sb-chev" width={16} height={16} />
            </button>
            {expanded && (
              <div className="sb-items" id={`sb-${g.id}`}>
                {g.items.map((it) => {
                  const cur = it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`);
                  return (
                    <Link key={it.href} href={it.href} aria-current={cur ? "page" : undefined} prefetch={false}>
                      {it.label}
                      {it.badge === "check" && counts.check > 0 && <span className="count" aria-label={`${counts.check} payments to check`}>{counts.check}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Search box button, View store, language, notifications. Used in the desktop bar and (smaller) on phones. */
export function TopActions({ storeHref, lang, compact }: { storeHref: string; lang: "en" | "bn"; compact?: boolean }) {
  const { counts, strings, openSearch } = useShell();
  return (
    <div className={`tact${compact ? " compact" : ""}`}>
      <button type="button" className="tsearch" onClick={openSearch} aria-label={strings.search} data-testid="open-search">
        <SearchIcon width={18} height={18} />
        <span className="tsearch-text">{strings.searchPlaceholder}</span>
        <kbd>Ctrl K</kbd>
      </button>
      {!compact && <a className="btn btn-secondary btn-sm only-wide" href={storeHref} target="_blank" rel="noreferrer"><ExternalIcon width={16} height={16} />{strings.viewStore}</a>}
      <form action={setLangAction} className="lang" aria-label="Language">
        <button type="submit" name="lang" value="en" aria-pressed={lang === "en"}>EN</button>
        <button type="submit" name="lang" value="bn" aria-pressed={lang === "bn"}>বাং</button>
      </form>
      <Bell strings={strings} items={counts.items} />
    </div>
  );
}

function Bell({ strings, items }: { strings: Strings; items: Counts["items"] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const total = items.reduce((n, i) => n + i.count, 0);
  return (
    <div className="bell" ref={box}>
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={strings.notifications} aria-expanded={open} data-testid="bell">
        <BellIcon width={20} height={20} />
        {total > 0 && <span className="bell-dot" aria-hidden />}
      </button>
      {open && (
        <div className="bell-pop" role="dialog" aria-label={strings.notifications}>
          <div className="bell-head">{strings.notifications}</div>
          {items.length === 0 ? <div className="bell-empty">{strings.allClear}</div> : items.map((i) => (
            <Link key={i.key} href={i.href} className={`bell-item ${i.tone}`} onClick={() => setOpen(false)} prefetch={false}><span>{i.text}</span><ChevronIcon width={14} height={14} style={{ transform: "rotate(-90deg)" }} /></Link>
          ))}
        </div>
      )}
    </div>
  );
}

interface Hit { kind: "order" | "product" | "customer"; id: string; title: string; sub: string; href: string }
const KIND: Record<Hit["kind"], string> = { order: "Order", product: "Product", customer: "Customer" };

/** Ctrl+K (or Cmd+K, or the search button): jump to any page, or find an order, product or customer. */
export function CommandPalette() {
  const { pages, strings, registerSearch } = useShell();
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);

  const open = useCallback(() => { setQ(""); setHits([]); setSel(0); dlg.current?.showModal(); }, []);
  useEffect(() => { registerSearch(open); }, [open, registerSearch]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setBusy(false); return; }
    setBusy(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/shell/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal, cache: "no-store" });
        if (r.ok) { setHits((await r.json()).hits ?? []); setSel(0); }
      } catch { /* aborted or offline */ }
      setBusy(false);
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const pageHits = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (term ? pages.filter((p) => p.label.toLowerCase().includes(term) || p.group.toLowerCase().includes(term)) : pages.slice(0, 6)).slice(0, 6);
  }, [q, pages]);
  const rows = useMemo(() => [...hits.map((h) => ({ href: h.href, title: h.title, sub: `${KIND[h.kind]} · ${h.sub}` })), ...pageHits.map((p) => ({ href: p.href, title: p.label, sub: `${strings.goTo} · ${p.group}` }))], [hits, pageHits, strings.goTo]);

  const go = (href: string) => { dlg.current?.close(); router.push(href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && rows[sel]) { e.preventDefault(); go(rows[sel]!.href); }
  };

  return (
    <dialog ref={dlg} className="palette" aria-label={strings.search} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }}>
      <div className="palette-in">
        <div className="palette-q">
          <SearchIcon width={18} height={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={strings.searchPlaceholder} aria-label={strings.search} autoFocus data-testid="palette-input" role="combobox" aria-expanded aria-controls="palette-list" />
          <kbd>Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="palette-list">
          {q.trim().length < 2 && hits.length === 0 && <li className="palette-hint">{strings.typeToSearch}</li>}
          {rows.map((r, i) => (
            <li key={`${r.href}-${i}`} role="option" aria-selected={i === sel}>
              <button type="button" className={i === sel ? "on" : ""} onMouseEnter={() => setSel(i)} onClick={() => go(r.href)}><b>{r.title}</b><span>{r.sub}</span></button>
            </li>
          ))}
          {q.trim().length >= 2 && !busy && rows.length === 0 && <li className="palette-hint">{strings.noMatches}</li>}
        </ul>
      </div>
    </dialog>
  );
}
