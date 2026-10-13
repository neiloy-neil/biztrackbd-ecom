"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Drawer, Segmented, useToast } from "@biztrackbd/ui";
import {
  DEFAULT_THEME, contrast, editableField, newSection, sectionDef, sectionsFor, setByPath, validateTheme,
  type Field, type ListSpec, type PageJson, type PageKind, type PageSection, type SectionDef, type ThemeSettings,
} from "@biztrackbd/core/builder-client";
import { ImagePicker } from "@/components/image-picker";
import { LANDING_GROUPS, SectionThumb } from "./section-thumbs";
import { discardDraftAction, publishAction, rollbackAction, saveDraftAction } from "./actions";

export interface VersionItem { version: number; label: string | null; createdAt: string; isLive: boolean }
type Settings = Record<string, unknown>;
type Snap = { page: PageJson; theme: ThemeSettings };
type Device = "desktop" | "tablet" | "phone";
type Tab = "layers" | "settings" | "theme" | "history";

interface Props {
  pageKey: string;
  kind: PageKind;
  title: string;
  initialPage: PageJson;
  initialTheme: ThemeSettings;
  hasDraft: boolean;
  /** When the draft was last saved (null: there is none yet). Sent back with each save to notice another person editing. */
  stamp: string | null;
  unpublished: boolean;
  publishedVersion: number | null;
  versions: VersionItem[];
  previewUrl: string;
  previewOrigin: string;
  liveUrl: string;
  canEdit: boolean;
  /** The plan allows colours and style only: sections cannot be added, moved, hidden or edited. */
  sectionsLocked?: boolean;
  /** Shown in the "Template" (home) or "Page" (landing) tab: the template picker, or the landing page's name, product and Pixel. */
  header?: ReactNode;
  exitHref: string;
  /** The pages of the store the editor can switch between (home, product, collection, cart). Landing pages leave this out. */
  pages?: { key: string; label: string }[];
  /** Open on the Template / Page tab (after saving a landing page's details, whose notice lives there). */
  initialTab?: "theme";
}

const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 768, phone: 390 };
const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));

// ---- small pieces -------------------------------------------------------------------------------------------------
const svg = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const IUndo = () => <svg {...svg}><path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" /></svg>;
const IRedo = () => <svg {...svg}><path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" /></svg>;
const IDesktop = () => <svg {...svg}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>;
const ITablet = () => <svg {...svg}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" /></svg>;
const IPhone = () => <svg {...svg}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>;
const IPlus = () => <svg {...svg}><path d="M12 5v14M5 12h14" /></svg>;
const IGrip = () => <svg {...svg} width={16} height={16}><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></svg>;
const IEye = ({ off }: { off?: boolean }) => <svg {...svg} width={16} height={16}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{off && <path d="M4 4l16 16" />}</svg>;
const ICopy = () => <svg {...svg} width={16} height={16}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>;
const ITrash = () => <svg {...svg} width={16} height={16}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
const IUp = () => <svg {...svg} width={16} height={16}><path d="M6 15l6-6 6 6" /></svg>;
const IDown = () => <svg {...svg} width={16} height={16}><path d="M6 9l6 6 6-6" /></svg>;
const ILink = () => <svg {...svg}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>;

function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia("(max-width: 899px)"); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia("(max-width: 899px)").matches,
    () => false,
  );
}

// ---- A single field, drawn from its definition --------------------------------------------------------------------
function FieldInput({ f, value, onChange, disabled, idPrefix, openSignal = 0 }: { f: Field; value: unknown; onChange: (v: unknown) => void; disabled: boolean; idPrefix: string; /** Goes up each time the page asks for this picture to be changed. */ openSignal?: number }) {
  const id = `${idPrefix}-${f.key}`;
  const str = typeof value === "string" ? value : value == null ? "" : String(value);
  if (f.type === "image") return <ImagePicker label={f.label} value={str} onChange={onChange} disabled={disabled} openSignal={openSignal} />;
  if (f.type === "checkbox") {
    return (
      <label className="check" htmlFor={id} style={{ minHeight: 40, alignItems: "center" }}>
        <input id={id} type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span>{f.label}</span>
      </label>
    );
  }
  return (
    <div className="field" style={{ margin: 0 }}>
      <label className="label" htmlFor={id}>{f.label}</label>
      {f.type === "textarea" ? (
        <textarea id={id} className="textarea" rows={3} maxLength={f.max} value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ padding: 10 }} />
      ) : f.type === "select" ? (
        <select id={id} className="select" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      ) : f.type === "color" ? (
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <input type="color" aria-label={`${f.label} picker`} value={/^#[0-9a-fA-F]{6}$/.test(str) ? str : "#000000"} disabled={disabled} onChange={(e) => onChange(e.target.value.toUpperCase())} style={{ width: 52, height: 40, padding: 2 }} />
          <input id={id} className="input" value={str} maxLength={7} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        </div>
      ) : f.type === "number" ? (
        <input id={id} className="input" type="number" min={f.min} max={f.max} value={str} disabled={disabled} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
      ) : (
        <input id={id} className="input" type="text" inputMode={f.type === "url" ? "url" : undefined} maxLength={f.max} value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.hint && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{f.hint}</div>}
    </div>
  );
}

function ListEditor({ spec, items, onChange, disabled, idPrefix, imgSignal }: { spec: ListSpec; items: Settings[]; onChange: (items: Settings[]) => void; disabled: boolean; idPrefix: string; imgSignal?: { path: string; n: number } }) {
  const set = (i: number, patch: Settings) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 700, marginBottom: 6 }}>{spec.label}</legend>
      {items.map((it, i) => (
        <div key={i} className="bld-item" data-testid="list-item">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <b style={{ fontSize: 13 }}>{spec.itemLabel} {i + 1}</b>
            <span className="row" style={{ gap: 4 }}>
              <button type="button" className="bld-ib" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${spec.itemLabel.toLowerCase()} ${i + 1} up`}><IUp /></button>
              <button type="button" className="bld-ib" disabled={disabled || i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${spec.itemLabel.toLowerCase()} ${i + 1} down`}><IDown /></button>
              <button type="button" className="bld-ib" disabled={disabled || items.length <= spec.min} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${spec.itemLabel.toLowerCase()} ${i + 1}`}><ITrash /></button>
            </span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {spec.fields.map((f) => <FieldInput key={f.key} f={f} value={it[f.key]} disabled={disabled} idPrefix={`${idPrefix}-${i}`} openSignal={imgSignal?.path === `${spec.key}.${i}.${f.key}` ? imgSignal.n : 0} onChange={(v) => set(i, { [f.key]: v })} />)}
          </div>
        </div>
      ))}
      {items.length < spec.max && !disabled && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...items, structuredClone(spec.defaultItem)])}>Add {spec.itemLabel.toLowerCase()}</button>}
    </fieldset>
  );
}

const isStyle = (f: Field) => f.type === "color" || f.type === "select" || f.type === "number" || f.type === "checkbox";

/** A section's settings in three groups: what it says, how it looks, and the Bangla twins tucked into one fold (instead of every field twice). */
function SectionForm({ def, section, onChange, disabled, bnOpen, imgSignal }: { def: SectionDef; section: PageSection; onChange: (patch: Settings) => void; disabled: boolean; bnOpen: boolean; imgSignal?: { path: string; n: number } }) {
  if (def.fields.length === 0 && !def.list) return <p className="muted" style={{ fontSize: 14 }}>This section has nothing to set. It shows your delivery and payment promises.</p>;
  const content = def.fields.filter((f) => !f.bn && !isStyle(f));
  const style = def.fields.filter((f) => !f.bn && isStyle(f));
  const bn = def.fields.filter((f) => f.bn);
  const row = (f: Field) => <FieldInput key={f.key} f={f} value={section.settings[f.key]} disabled={disabled} idPrefix={section.id} openSignal={imgSignal?.path === f.key ? imgSignal.n : 0} onChange={(v) => onChange({ [f.key]: v })} />;
  return (
    <div className="stack" style={{ gap: 14 }} data-testid="section-form">
      {content.length > 0 && <div className="bld-group"><div className="bld-gh">Content</div><div className="stack" style={{ gap: 10 }}>{content.map(row)}</div></div>}
      {def.list && <div className="bld-group"><ListEditor spec={def.list} items={(section.settings[def.list.key] as Settings[]) ?? []} disabled={disabled} idPrefix={section.id} imgSignal={imgSignal} onChange={(items) => onChange({ [def.list!.key]: items })} /></div>}
      {style.length > 0 && <div className="bld-group"><div className="bld-gh">Style</div><div className="stack" style={{ gap: 10 }}>{style.map(row)}</div></div>}
      {bn.length > 0 && (
        <details className="bld-group bld-bn" open={bnOpen}>
          <summary className="bld-gh">Bangla text <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></summary>
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>{bn.map(row)}</div>
        </details>
      )}
    </div>
  );
}

function ThemePanel({ theme, onChange, disabled }: { theme: ThemeSettings; onChange: (t: ThemeSettings) => void; disabled: boolean }) {
  const problem = useMemo(() => {
    try { validateTheme(theme); return null; } catch (e) { return e instanceof Error ? e.message : "Check these colours"; }
  }, [theme]);
  const set = (patch: Partial<ThemeSettings>) => onChange({ ...theme, ...patch });
  const color = (key: "accent" | "background" | "text", label: string) => (
    <FieldInput f={{ key, label, type: "color" }} value={theme[key]} disabled={disabled} idPrefix="theme" onChange={(v) => set({ [key]: String(v) })} />
  );
  return (
    <div className="stack" style={{ gap: 10 }} data-testid="theme-panel">
      {color("accent", "Main colour (buttons, links)")}
      {color("background", "Page background")}
      {color("text", "Text colour")}
      <div className="field" style={{ margin: 0 }}>
        <label className="label" htmlFor="theme-radius">Corners</label>
        <select id="theme-radius" className="select" value={theme.radius} disabled={disabled} onChange={(e) => set({ radius: e.target.value as ThemeSettings["radius"] })}>
          <option value="sharp">Sharp</option><option value="soft">Soft</option><option value="round">Round</option>
        </select>
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label className="label" htmlFor="theme-font">Font</label>
        <select id="theme-font" className="select" value={theme.font} disabled={disabled} onChange={(e) => set({ font: e.target.value as ThemeSettings["font"] })}>
          <option value="sans">Clean (sans-serif)</option><option value="serif">Classic (serif)</option>
        </select>
      </div>
      {problem ? <div className="notice bad" role="alert">{problem} The preview keeps the last colours that worked.</div> : <div className="muted" style={{ fontSize: 13 }}>Text contrast {contrast(theme.text, theme.background).toFixed(1)} to 1. At least 4.5 keeps it easy to read.</div>}
      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => onChange(DEFAULT_THEME)}>Back to the original look</button>
    </div>
  );
}

// ---- The editor ---------------------------------------------------------------------------------------------------
export function Builder(props: Props) {
  const { pageKey, kind, canEdit, previewOrigin } = props;
  const router = useRouter();
  const toast = useToast();
  const narrow = useNarrow();
  const [page, setPage] = useState(props.initialPage);
  const [theme, setTheme] = useState(props.initialTheme);
  const [selected, setSelected] = useState<string | null>(props.initialPage.sections[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>(props.initialTab ?? "layers");
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">(props.hasDraft ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(props.unpublished);
  const [device, setDevice] = useState<Device>("desktop");
  // The words customers read in: the editor shows the English text by default, and the Bangla twin when switched.
  const [lang, setLang] = useState<"en" | "bn">("en");
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);
  // Where a section chosen from the gallery goes: the gap that was clicked on the page, or the end.
  const [addAt, setAddAt] = useState<number | null>(null);
  // A click on a picture in the preview asks for that picture to be changed.
  const [imgSignal, setImgSignal] = useState<{ path: string; n: number } | undefined>(undefined);
  // On a phone the page fills the screen and the settings slide up from the bottom.
  const [sheet, setSheet] = useState(false);
  const visual = kind === "landing";
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [conflict, setConflict] = useState<{ stamp: string | null } | null>(null);
  const [, bump] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  const latest = useRef({ page, theme, lang });
  latest.current = { page, theme, lang };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const touched = useRef(false);
  const stampRef = useRef<string | null>(props.stamp);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const hist = useRef<{ past: Snap[]; future: Snap[]; last: number }>({ past: [], future: [], last: 0 });
  const locked = !canEdit || !!props.sectionsLocked;
  /** The product, the product grid and the cart cannot be hidden or removed: their page does not work without them. */
  const isRequired = (type: string) => !!sectionDef(type)?.required;

  /**
   * Saves one at a time, each from the stamp the previous save returned. Two saves in flight would otherwise both start from the same stamp
   * and the second would be refused as someone else's change. The newest content is read when its turn comes.
   */
  const persist = useCallback(() => {
    const run = chain.current.then(async () => {
      const r = await saveDraftAction(pageKey, latest.current.page, latest.current.theme, stampRef.current);
      if (r.ok && r.stamp) stampRef.current = r.stamp;
      return r;
    });
    chain.current = run.catch(() => undefined);
    return run;
  }, [pageKey]);

  const post = useCallback((msg: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(msg, previewOrigin), [previewOrigin]);
  // What the preview asks for (typing on the page, dragging, adding, choosing a picture). Filled in below, once the editing functions exist.
  const handlers = useRef<Record<string, (m: Record<string, unknown>) => void>>({});

  // The preview tells us when it has loaded, or that a section was clicked.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== previewOrigin || e.source !== frame.current?.contentWindow) return;
      const m = e.data as { type?: string; id?: unknown } | null;
      if (m?.type === "bt-preview:ready") {
        ready.current = true;
        post({ type: "bt-preview:update", page: latest.current.page, theme: latest.current.theme, lang: latest.current.lang, locked });
        if (selectedRef.current) post({ type: "bt-preview:focus", id: selectedRef.current });
      } else if (m?.type === "bt-preview:select" && typeof m.id === "string" && latest.current.page.sections.some((s) => s.id === m.id)) {
        setSelected(m.id);
        setTab("settings");
        setSheet(true);
        post({ type: "bt-preview:focus", id: m.id });
      } else if (m && typeof m.type === "string" && m.type.startsWith("bt-preview:") && visual) {
        handlers.current[m.type]?.(m as Record<string, unknown>);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewOrigin, post, visual, locked]);
  // Publishing and going back reload the editor from the server, which resets this component: the notice is carried across in the tab.
  useEffect(() => {
    try {
      const n = sessionStorage.getItem("bld-notice");
      if (n) { sessionStorage.removeItem("bld-notice"); setNotice(n); }
    } catch { /* private window: the toast still tells them */ }
  }, []);
  const carryNotice = (text: string) => { try { sessionStorage.setItem("bld-notice", text); } catch { /* ignore */ } };
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Every change goes to the preview at once, and to the server a moment after typing stops.
  useEffect(() => {
    if (!touched.current) return;
    if (ready.current) post({ type: "bt-preview:update", page, theme, lang: latest.current.lang, locked });
    if (!canEdit) return;
    setSave("saving");
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      const r = await persist();
      if (mine !== seq.current) return;
      if (r.ok) { setSave("saved"); setError(null); }
      else if (r.conflict) { setSave("error"); setConflict(r.conflict); setError(null); }
      else { setSave("error"); setError(r.error); }
    }, 700);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [page, theme, pageKey, canEdit, post, persist, locked]);

  useEffect(() => { if (ready.current) post({ type: "bt-preview:update", lang, locked }); }, [lang, locked, post]);

  // ---- edits, with undo and redo. Typing is grouped: a snapshot is kept when a change comes after a pause.
  const remember = () => {
    const h = hist.current, now = Date.now();
    if (now - h.last > 800) {
      h.past.push({ page: latest.current.page, theme: latest.current.theme });
      if (h.past.length > 60) h.past.shift();
      h.future = [];
      bump((n) => n + 1);
    }
    h.last = now;
  };
  const edit = (fn: (p: PageJson) => PageJson) => { remember(); touched.current = true; setPage(fn); };
  const editTheme = (t: ThemeSettings) => { remember(); touched.current = true; setTheme(t); };
  const patch = (id: string, p: Settings) => edit((pg) => ({ ...pg, sections: pg.sections.map((s) => (s.id === id ? { ...s, settings: { ...s.settings, ...p } } : s)) }));
  const undo = useCallback(() => {
    const h = hist.current, snap = h.past.pop();
    if (!snap) return;
    h.future.push({ page: latest.current.page, theme: latest.current.theme });
    h.last = 0; touched.current = true;
    setPage(snap.page); setTheme(snap.theme); bump((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    const h = hist.current, snap = h.future.pop();
    if (!snap) return;
    h.past.push({ page: latest.current.page, theme: latest.current.theme });
    h.last = 0; touched.current = true;
    setPage(snap.page); setTheme(snap.theme); bump((n) => n + 1);
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return; // the field keeps its own undo
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const defs = sectionsFor(kind);
  const count = (type: string) => page.sections.filter((s) => s.type === type).length;
  const full = (type: string) => { const d = sectionDef(type); return page.sections.length >= 30 || (!!d?.max && count(type) >= d.max); };
  const current = page.sections.find((s) => s.id === selected) ?? null;
  const currentDef = current ? sectionDef(current.type) : undefined;

  const choose = (id: string) => { setSelected(id); post({ type: "bt-preview:focus", id }); if (narrow) setTab("settings"); };
  function add(type: string) {
    const s = newSection(type);
    const at = addAt;
    edit((p) => {
      const next = [...p.sections];
      next.splice(at === null ? next.length : Math.max(0, Math.min(at, next.length)), 0, s);
      return { ...p, sections: next };
    });
    setSelected(s.id);
    setAddAt(null);
    setLibrary(false);
    setTab(narrow ? "settings" : "layers");
    setTimeout(() => { post({ type: "bt-preview:focus", id: s.id }); }, 200);
  }
  function move(id: string, d: -1 | 1) {
    edit((p) => {
      const i = p.sections.findIndex((s) => s.id === id), j = i + d;
      if (i < 0 || j < 0 || j >= p.sections.length) return p;
      const next = [...p.sections];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...p, sections: next };
    });
  }
  function reorder(from: number, to: number) {
    if (from === to) return;
    edit((p) => { const next = [...p.sections]; const [m] = next.splice(from, 1); next.splice(to, 0, m!); return { ...p, sections: next }; });
  }
  function duplicate(s: PageSection) {
    if (full(s.type)) return;
    const copy: PageSection = { ...structuredClone(s), id: newSection(s.type).id };
    edit((p) => { const i = p.sections.findIndex((x) => x.id === s.id); const next = [...p.sections]; next.splice(i + 1, 0, copy); return { ...p, sections: next }; });
    setSelected(copy.id);
  }
  function remove(id: string) {
    edit((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== id) }));
    if (selected === id) setSelected(null);
  }
  const toggle = (id: string) => edit((p) => ({ ...p, sections: p.sections.map((x) => (x.id === id ? { ...x, disabled: !x.disabled } : x)) }));

  // ---- editing on the page itself. Everything the preview sends is checked here against the section's own definition.
  handlers.current = {
    "bt-preview:edit": (m) => {
      if (locked || typeof m.id !== "string" || typeof m.path !== "string" || typeof m.value !== "string") return;
      const section = latest.current.page.sections.find((x) => x.id === m.id);
      const def = section && sectionDef(section.type);
      const field = def ? editableField(def, m.path) : null;
      if (!section || !def || !field) return;
      // In Bangla view the words belong to the Bangla twin of the field, when it has one.
      const twinPath = m.path.replace(/([A-Za-z0-9]+)$/, "$1Bn");
      const useTwin = latest.current.lang === "bn" && m.twin === true && editableField(def, twinPath) !== null;
      const target = useTwin ? twinPath : m.path;
      const max = (useTwin ? editableField(def, twinPath) : field)?.max ?? 200;
      // eslint-disable-next-line no-control-regex
      const value = m.value.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, max);
      edit((pg) => ({ ...pg, sections: pg.sections.map((x) => (x.id === section.id ? { ...x, settings: setByPath(x.settings, target, value) } : x)) }));
    },
    "bt-preview:image": (m) => {
      if (locked || typeof m.id !== "string" || typeof m.path !== "string") return;
      const section = latest.current.page.sections.find((x) => x.id === m.id);
      const def = section && sectionDef(section.type);
      if (!section || !def || !editableField(def, m.path, ["image"])) return;
      setSelected(section.id); setTab("settings"); setSheet(true);
      setImgSignal({ path: m.path, n: Date.now() });
    },
    "bt-preview:move": (m) => {
      if (locked || typeof m.id !== "string" || typeof m.slot !== "number") return;
      const from = latest.current.page.sections.findIndex((x) => x.id === m.id);
      if (from < 0) return;
      const slot = Math.max(0, Math.min(Math.round(m.slot), latest.current.page.sections.length));
      const to = slot > from ? slot - 1 : slot;
      if (to !== from) reorder(from, to);
    },
    "bt-preview:op": (m) => {
      if (locked || typeof m.id !== "string") return;
      const section = latest.current.page.sections.find((x) => x.id === m.id);
      if (!section) return;
      if (m.op === "up") move(section.id, -1);
      else if (m.op === "down") move(section.id, 1);
      else if (m.op === "hide" && !isRequired(section.type)) toggle(section.id);
      else if (m.op === "dup") duplicate(section);
      else if (m.op === "delete" && !isRequired(section.type)) remove(section.id);
    },
    "bt-preview:add": (m) => {
      if (locked || typeof m.index !== "number") return;
      setAddAt(Math.max(0, Math.min(Math.round(m.index), latest.current.page.sections.length)));
      setLibrary(true);
    },
  };

  async function flush(): Promise<boolean> {
    if (timer.current) clearTimeout(timer.current);
    seq.current++;
    const r = await persist();
    if (!r.ok) {
      setSave("error");
      if (r.conflict) setConflict(r.conflict); else setError(r.error);
      return false;
    }
    setSave("saved"); setError(null);
    return true;
  }
  async function doPublish() {
    setBusy(true); setNotice(null);
    if (await flush()) {
      const r = await publishAction(pageKey, label);
      if (r.ok) { const n = `Published. Your store now shows version ${r.version}.`; setNotice(n); carryNotice(n); toast(`Published as version ${r.version}`); setLabel(""); setDirty(false); router.refresh(); }
      else setError(r.error);
    }
    setBusy(false);
  }
  /** Someone else saved first. Keep my version: save again from their stamp. Or take theirs: reload what is saved. */
  async function keepMine(stamp: string | null) { stampRef.current = stamp; setConflict(null); setBusy(true); await flush(); setBusy(false); }
  function loadTheirs() { setConflict(null); router.refresh(); }
  async function doDiscard() { setBusy(true); const r = await discardDraftAction(pageKey); if (r.ok) router.refresh(); else setError(r.error); setBusy(false); }
  async function doRestore(v: number) {
    setBusy(true);
    const r = await rollbackAction(pageKey, v);
    if (r.ok) { const n = `Went back to version ${v}. Your store now shows it as version ${r.version}.`; setNotice(n); carryNotice(n); router.refresh(); } else setError(r.error);
    setBusy(false);
  }
  /** Moves to another page of the store. The draft is saved first, so nothing typed is lost. */
  async function switchPage(key: string) {
    setBusy(true);
    if (canEdit && touched.current) await flush();
    router.push(key === "home" ? "/design" : `/design?page=${key}`);
  }
  async function copyLink() {
    // The saved draft is what the link shows, so save first. The link works for two hours and shows nothing else about the store.
    if (canEdit) await flush();
    try {
      await navigator.clipboard.writeText(props.previewUrl);
      toast("Preview link copied. It shows your saved draft for 2 hours.");
    } catch {
      toast("Could not copy. Open the preview in a new tab instead.", "bad");
    }
  }

  const status = !canEdit ? "View only" : save === "saving" ? "Saving…" : save === "error" ? "Not saved" : dirty ? "Draft saved. Not published yet." : props.publishedVersion ? `Live: version ${props.publishedVersion}` : "Nothing published yet. Your store shows its built-in home page.";
  const chip = !canEdit ? "grey" : save === "error" ? "bad" : dirty || save === "saving" ? "warn" : "ok";
  const chipText = !canEdit ? "View only" : save === "saving" ? "Saving…" : save === "error" ? "Not saved" : dirty ? "Draft" : props.publishedVersion ? `Live v${props.publishedVersion}` : "Not published";
  // On a phone there is little room: a one-word version of the same state.
  const chipShort = !canEdit ? "View" : save === "saving" ? "Saving" : save === "error" ? "Error" : dirty ? "Draft" : props.publishedVersion ? `v${props.publishedVersion}` : "New";

  // ---- the preview stage: fits the chosen device into the space available
  const [scale, setScale] = useState(1);
  const devW = narrow ? 390 : DEVICE_WIDTH[device];
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => setScale(devW ? Math.min(1, (el.clientWidth - 24) / devW) : 1);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [devW]);

  const tabs: { id: Tab; label: string; test?: string }[] = narrow
    ? [{ id: "layers", label: "Sections" }, { id: "settings", label: "Settings" }, { id: "theme", label: kind === "home" ? "Style" : "Page", test: "tab-theme" }, { id: "history", label: "History", test: "tab-history" }]
    : [{ id: "settings", label: "Settings" }, { id: "theme", label: kind === "home" ? "Template and style" : "Page", test: "tab-theme" }, { id: "history", label: "History", test: "tab-history" }];
  const active: Tab = narrow ? tab : tab === "layers" ? "settings" : tab;

  const layers = (
    <div className="bld-layers" data-testid="layers">
      {props.sectionsLocked && <div className="notice" role="note" data-testid="sections-locked">Your plan lets you change colours and style. {kind === "home" ? "To rearrange or edit sections, move up to the Pro plan." : "Editing this page is part of the Business plan."} <Link className="link" href="/billing">See plans</Link></div>}
      <ol className="bld-list" aria-label="Sections on this page">
        {page.sections.map((s, i) => {
          const def = sectionDef(s.type);
          return (
            <li
              key={s.id}
              className={`bld-row${s.id === selected ? " on" : ""}${s.disabled ? " off" : ""}${dragOver === i && dragFrom !== null && dragFrom !== i ? (dragFrom < i ? " over-after" : " over-before") : ""}`}
              data-testid="section-row" data-type={s.type}
              draggable={!locked && !narrow}
              onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDragOver(i); } }}
              onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) reorder(dragFrom, i); setDragFrom(null); setDragOver(null); }}
              onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
            >
              {!locked && !narrow && <span className="bld-grip" aria-hidden><IGrip /></span>}
              <button type="button" className="bld-pick" onClick={() => choose(s.id)} aria-pressed={s.id === selected}>
                <b>{def?.label ?? s.type}</b>
                {s.disabled && <span className="pill grey">Hidden</span>}
              </button>
              {!locked && (
                <span className="bld-acts">
                  <button type="button" className="bld-ib" disabled={i === 0} onClick={() => move(s.id, -1)} aria-label={`Move ${def?.label} up`}><IUp /></button>
                  <button type="button" className="bld-ib" disabled={i === page.sections.length - 1} onClick={() => move(s.id, 1)} aria-label={`Move ${def?.label} down`}><IDown /></button>
                  <button type="button" className="bld-ib" onClick={() => toggle(s.id)} disabled={isRequired(s.type)} title={isRequired(s.type) ? "This page needs this section" : undefined} aria-label={`${s.disabled ? "Show" : "Hide"} ${def?.label}`}><IEye off={s.disabled} /></button>
                </span>
              )}
            </li>
          );
        })}
        {page.sections.length === 0 && <li className="muted" style={{ padding: 12 }}>This page is empty. Add a section below.</li>}
      </ol>
      {!locked && <button type="button" className="btn btn-secondary btn-block" onClick={() => setLibrary(true)} data-testid="add-section"><IPlus /> Add section</button>}
    </div>
  );

  const settings = current && currentDef ? (
    <section aria-label={`Edit ${currentDef.label}`} className="bld-insp">
      <div className="bld-insp-head">
        <div><h2>{currentDef.label}</h2><p className="muted">{currentDef.description}</p>{isRequired(current.type) && <p className="muted" style={{ marginTop: 4 }}>You can move it and change its settings, but not hide or remove it.</p>}</div>
        {!locked && (
          <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
            <button type="button" className="bld-ib" onClick={() => toggle(current.id)} disabled={isRequired(current.type)} aria-label={`${current.disabled ? "Show" : "Hide"} this section`}><IEye off={current.disabled} /></button>
            <button type="button" className="bld-ib" onClick={() => duplicate(current)} disabled={full(current.type)} aria-label="Duplicate this section"><ICopy /></button>
            {!isRequired(current.type) && <button type="button" className="bld-ib danger" onClick={() => remove(current.id)} aria-label="Delete this section"><ITrash /></button>}
          </span>
        )}
      </div>
      <SectionForm def={currentDef} section={current} disabled={locked} bnOpen={lang === "bn"} imgSignal={imgSignal} onChange={(p) => patch(current.id, p)} />
    </section>
  ) : (
    <div className="bld-empty"><b>Pick a section</b><p className="muted">Choose one in the list, or click it in the preview, to change its text, pictures and style.</p></div>
  );

  const themeTab = (
    <div className="stack" style={{ gap: 14 }}>
      {kind === "home" ? (
        <>
          {props.header}
          <section className="bld-group"><div className="bld-gh">Colours and style</div><ThemePanel theme={theme} onChange={editTheme} disabled={!canEdit} /></section>
        </>
      ) : props.header}
    </div>
  );

  const history = (
    <section className="stack" data-testid="history">
      {canEdit && (
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="pub-label">Name for the next version (optional)</label>
          <input id="pub-label" className="input" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="For example: Eid sale" />
        </div>
      )}
      {props.versions.length === 0 && <p className="muted">Nothing has been published yet.</p>}
      <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>
        {props.versions.map((v) => (
          <li key={v.version} className="row" style={{ justifyContent: "space-between" }} data-testid="version-row">
            <span><b>Version {v.version}</b> {v.isLive && <span className="pill ok">Live</span>}<br /><span className="muted" style={{ fontSize: 13 }}>{when(v.createdAt)}{v.label ? ` · ${v.label}` : ""}</span></span>
            {canEdit && !v.isLive && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => doRestore(v.version)} aria-label={`Go back to version ${v.version}`}>Go back to this</button>}
          </li>
        ))}
      </ul>
      {canEdit && props.hasDraft && <button type="button" className="btn btn-secondary" onClick={doDiscard} disabled={busy} data-testid="discard">Throw away my unpublished changes</button>}
    </section>
  );

  const inspector = (
    <div className="bld-panel-body">
      {active === "settings" && settings}
      {active === "theme" && themeTab}
      {active === "history" && history}
    </div>
  );

  const canUndo = hist.current.past.length > 0, canRedo = hist.current.future.length > 0;

  return (
    <div className="bld" data-testid="builder" data-visual={visual ? "1" : undefined} data-sheet={visual && narrow ? (sheet ? "open" : "peek") : undefined}>
      <header className="bld-top">
        <Link href={props.exitHref} className="bld-exit" aria-label="Exit the editor">← <span>Exit</span></Link>
        <div className="bld-title">
          {props.pages ? (
            <select className="bld-page" value={pageKey} disabled={busy} onChange={(e) => switchPage(e.target.value)} aria-label="Page being edited" data-testid="page-switch">
              {props.pages.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          ) : <b>{props.title}</b>}<span className="bld-status" data-testid="design-status" data-save={save} data-dirty={dirty ? "1" : "0"} role="status" aria-live="polite"><span className={`bld-chip ${chip}`} title={status} aria-hidden>{narrow ? chipShort : chipText}</span><span className="sr-only">{status}</span></span></div>
        <div className="bld-tools">
          {!narrow && (
            <div className="bld-seg" role="group" aria-label="Preview size">
              {([["desktop", "Computer", <IDesktop key="d" />], ["tablet", "Tablet", <ITablet key="t" />], ["phone", "Phone", <IPhone key="p" />]] as const).map(([d, name, icon]) => (
                <button key={d} type="button" aria-pressed={device === d} aria-label={name} title={name} onClick={() => setDevice(d)}>{icon}</button>
              ))}
            </div>
          )}
          <Segmented label="Preview language" value={lang} onChange={setLang} options={[{ value: "en", label: "EN" }, { value: "bn", label: "বাং" }]} />
          <button type="button" className="bld-ib" onClick={undo} disabled={!canUndo || !canEdit} aria-label="Undo" title="Undo (Ctrl+Z)"><IUndo /></button>
          <button type="button" className="bld-ib" onClick={redo} disabled={!canRedo || !canEdit} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><IRedo /></button>
          {!narrow && <button type="button" className="btn btn-secondary btn-sm" onClick={copyLink} title="Copy a private link to your saved draft"><ILink /> Share preview</button>}
          {!narrow && <a href={props.liveUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">View live page</a>}
          {canEdit && <button type="button" className="btn btn-primary btn-sm" onClick={doPublish} disabled={busy || save === "saving" || (!dirty && !props.hasDraft)} data-testid="publish">{busy ? "Working…" : "Publish"}</button>}
        </div>
      </header>

      {(conflict || error || notice) && (
        <div className="bld-alerts">
          {conflict && (
            <div className="notice bad" role="alert" data-testid="design-conflict">
              <b>Someone else changed this page while you were editing it.</b> Your changes are not saved yet.
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={loadTheirs} data-testid="conflict-theirs">Load their version</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => keepMine(conflict.stamp)} data-testid="conflict-mine">Keep mine</button>
              </div>
            </div>
          )}
          {error && <div className="notice bad" role="alert" data-testid="design-error">{error}</div>}
          {notice && <div className="notice good" role="status" data-testid="design-notice">{notice}</div>}
        </div>
      )}

      <div className="bld-body">
        {!narrow && <aside className="bld-left" aria-label="Sections">{layers}</aside>}

        <main className="bld-stage" ref={stage}>
          <div className="bld-device" style={{ width: devW ? devW : "100%", transform: devW ? `scale(${scale})` : undefined, height: devW ? `${100 / scale}%` : "100%" }}>
            <iframe ref={frame} src={props.previewUrl} title="Preview of your store" data-testid="preview-frame" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" />
          </div>
        </main>

        <aside className="bld-right" aria-label={narrow ? "Editor panel" : "Settings"}>
          {visual && narrow && <button type="button" className="bld-handle" onClick={() => setSheet((v) => !v)} aria-expanded={sheet} data-testid="sheet-handle"><span aria-hidden /><b>{sheet ? "Show the page" : current && currentDef ? `Edit: ${currentDef.label}` : "Sections and settings"}</b></button>}
          <div className="bld-tabs" role="tablist" aria-label="Editor">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => setTab(t.id)} data-testid={t.test ?? `tab-${t.id}`}>{t.label}</button>
            ))}
          </div>
          {narrow && active === "layers" ? <div className="bld-panel-body">{layers}</div> : inspector}
        </aside>
      </div>

      <Drawer open={library} onClose={() => { setLibrary(false); setAddAt(null); }} title="Add a section">
        {(() => {
          const card = (d: (typeof defs)[number]) => (
            <button key={d.type} type="button" className="bld-card bld-card-pic" disabled={full(d.type)} onClick={() => add(d.type)} data-testid={`lib-${d.type}`}>
              <SectionThumb type={d.type} />
              <span className="bld-card-txt"><b>{d.label}</b><span>{d.description}</span>{d.max && count(d.type) >= d.max && <em>Already on the page</em>}</span>
            </button>
          );
          if (kind !== "landing") return <div className="bld-lib">{defs.map(card)}</div>;
          return (
            <div className="stack" style={{ gap: 14 }}>
              {LANDING_GROUPS.map((g) => (
                <section key={g.title} aria-label={g.title}>
                  <div className="bld-gh" style={{ marginBottom: 6 }}>{g.title}</div>
                  <div className="bld-lib">{g.types.map((t) => defs.find((d) => d.type === t)).filter((d): d is NonNullable<typeof d> => Boolean(d)).map(card)}</div>
                </section>
              ))}
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}
