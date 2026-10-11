"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_THEME, contrast, newSection, sectionDef, sectionsFor, validateTheme,
  type Field, type ListSpec, type PageJson, type PageKind, type PageSection, type SectionDef, type ThemeSettings,
} from "@biztrackbd/core/builder-client";
import { ImagePicker } from "@/components/image-picker";
import { discardDraftAction, publishAction, rollbackAction, saveDraftAction } from "./actions";

export interface VersionItem { version: number; label: string | null; createdAt: string; isLive: boolean }
type Settings = Record<string, unknown>;

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
  /** Extra controls above the section list (landing page name, product, Pixel). */
  header?: React.ReactNode;
}

const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));

// ---- A single field, drawn from its definition -------------------------------------------------------------------
function FieldInput({ f, value, onChange, disabled, idPrefix }: { f: Field; value: unknown; onChange: (v: unknown) => void; disabled: boolean; idPrefix: string }) {
  const id = `${idPrefix}-${f.key}`;
  const str = typeof value === "string" ? value : value == null ? "" : String(value);
  if (f.type === "image") return <ImagePicker label={f.label} value={str} onChange={onChange} disabled={disabled} />;
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
      ) : f.type === "checkbox" ? (
        <input id={id} type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      ) : (
        <input id={id} className="input" type={f.type === "url" ? "text" : "text"} inputMode={f.type === "url" ? "url" : undefined} maxLength={f.max} value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.hint && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{f.hint}</div>}
    </div>
  );
}

function ListEditor({ spec, items, onChange, disabled, idPrefix }: { spec: ListSpec; items: Settings[]; onChange: (items: Settings[]) => void; disabled: boolean; idPrefix: string }) {
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
        <div key={i} className="card" style={{ padding: 12, background: "var(--bg)" }} data-testid="list-item">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <b style={{ fontSize: 13 }}>{spec.itemLabel} {i + 1}</b>
            <span className="row" style={{ gap: 4 }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${spec.itemLabel.toLowerCase()} ${i + 1} up`}>↑</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${spec.itemLabel.toLowerCase()} ${i + 1} down`}>↓</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || items.length <= spec.min} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${spec.itemLabel.toLowerCase()} ${i + 1}`}>Remove</button>
            </span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {spec.fields.map((f) => <FieldInput key={f.key} f={f} value={it[f.key]} disabled={disabled} idPrefix={`${idPrefix}-${i}`} onChange={(v) => set(i, { [f.key]: v })} />)}
          </div>
        </div>
      ))}
      {items.length < spec.max && !disabled && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...items, structuredClone(spec.defaultItem)])}>Add {spec.itemLabel.toLowerCase()}</button>}
    </fieldset>
  );
}

function SectionForm({ def, section, onChange, disabled }: { def: SectionDef; section: PageSection; onChange: (patch: Settings) => void; disabled: boolean }) {
  if (def.fields.length === 0 && !def.list) return <p className="muted" style={{ fontSize: 14 }}>This section has nothing to set. It shows your delivery and payment promises.</p>;
  return (
    <div className="stack" style={{ gap: 10 }} data-testid="section-form">
      {def.fields.map((f) => <FieldInput key={f.key} f={f} value={section.settings[f.key]} disabled={disabled} idPrefix={section.id} onChange={(v) => onChange({ [f.key]: v })} />)}
      {def.list && <ListEditor spec={def.list} items={(section.settings[def.list.key] as Settings[]) ?? []} disabled={disabled} idPrefix={section.id} onChange={(items) => onChange({ [def.list!.key]: items })} />}
    </div>
  );
}

function ThemePanel({ theme, onChange, disabled }: { theme: ThemeSettings; onChange: (t: ThemeSettings) => void; disabled: boolean }) {
  const problem = useMemo(() => {
    try {
      validateTheme(theme);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Check these colours";
    }
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
export function Editor(props: Props) {
  const { pageKey, kind, canEdit, previewOrigin } = props;
  const router = useRouter();
  const [page, setPage] = useState(props.initialPage);
  const [theme, setTheme] = useState(props.initialTheme);
  const [selected, setSelected] = useState<string | null>(props.initialPage.sections[0]?.id ?? null);
  const [tab, setTab] = useState<"sections" | "theme" | "history">("sections");
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">(props.hasDraft ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(props.unpublished);
  const [view, setView] = useState<"phone" | "desktop">("desktop");
  // The words customers read in: the editor shows the English text by default, and the Bangla twin when switched.
  const [lang, setLang] = useState<"en" | "bn">("en");
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const latest = useRef({ page, theme, lang });
  latest.current = { page, theme, lang };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const touched = useRef(false);
  const stampRef = useRef<string | null>(props.stamp);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
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
  const [conflict, setConflict] = useState<{ stamp: string | null } | null>(null);

  const post = useCallback((msg: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(msg, previewOrigin), [previewOrigin]);

  // The preview tells us when it has loaded; then it gets the current state, which may be newer than what the page was built with.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== previewOrigin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string } | null)?.type === "bt-preview:ready") {
        ready.current = true;
        post({ type: "bt-preview:update", page: latest.current.page, theme: latest.current.theme, lang: latest.current.lang });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewOrigin, post]);

  // Every change goes to the preview at once, and to the server a moment after typing stops.
  useEffect(() => {
    if (!touched.current) return;
    if (ready.current) post({ type: "bt-preview:update", page, theme, lang: latest.current.lang });
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
  }, [page, theme, pageKey, canEdit, post, persist]);

  useEffect(() => { if (ready.current) post({ type: "bt-preview:update", lang }); }, [lang, post]);

  const edit = (fn: (p: PageJson) => PageJson) => { touched.current = true; setPage(fn); };
  const editTheme = (t: ThemeSettings) => { touched.current = true; setTheme(t); };
  const patch = (id: string, p: Settings) => edit((pg) => ({ ...pg, sections: pg.sections.map((s) => (s.id === id ? { ...s, settings: { ...s.settings, ...p } } : s)) }));

  const defs = sectionsFor(kind);
  const count = (type: string) => page.sections.filter((s) => s.type === type).length;
  const [adding, setAdding] = useState(defs.find((d) => !d.max || count(d.type) < d.max)?.type ?? defs[0]!.type);
  const current = page.sections.find((s) => s.id === selected) ?? null;

  function add() {
    const s = newSection(adding);
    edit((p) => ({ ...p, sections: [...p.sections, s] }));
    setSelected(s.id);
    setTab("sections");
    setTimeout(() => post({ type: "bt-preview:focus", id: s.id }), 150);
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
  function duplicate(s: PageSection) {
    const def = sectionDef(s.type);
    if (def?.max && count(s.type) >= def.max) return;
    const copy: PageSection = { ...structuredClone(s), id: newSection(s.type).id };
    edit((p) => { const i = p.sections.findIndex((x) => x.id === s.id); const next = [...p.sections]; next.splice(i + 1, 0, copy); return { ...p, sections: next }; });
    setSelected(copy.id);
  }
  function remove(id: string) {
    edit((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== id) }));
    if (selected === id) setSelected(null);
  }

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
      if (r.ok) { setNotice(`Published. Your store now shows version ${r.version}.`); setLabel(""); setDirty(false); router.refresh(); }
      else setError(r.error);
    }
    setBusy(false);
  }
  /** Someone else saved first. Keep my version: save again from their stamp. Or take theirs: reload what is saved. */
  async function keepMine(stamp: string | null) {
    stampRef.current = stamp;
    setConflict(null); setBusy(true);
    await flush();
    setBusy(false);
  }
  function loadTheirs() { setConflict(null); router.refresh(); }
  async function doDiscard() {
    setBusy(true);
    const r = await discardDraftAction(pageKey);
    if (r.ok) router.refresh(); else setError(r.error);
    setBusy(false);
  }
  async function doRestore(v: number) {
    setBusy(true);
    const r = await rollbackAction(pageKey, v);
    if (r.ok) { setNotice(`Went back to version ${v}. Your store now shows it as version ${r.version}.`); router.refresh(); } else setError(r.error);
    setBusy(false);
  }

  const status = !canEdit ? "You can look but not change this page." : save === "saving" ? "Saving…" : save === "error" ? "Not saved" : dirty ? "Draft saved. Not published yet." : props.publishedVersion ? `Live: version ${props.publishedVersion}` : "Nothing published yet. Your store shows its built-in home page.";

  return (
    <>
      <div className="page-head">
        <h1>{props.title}</h1>
        <div className="row" style={{ gap: 8 }}>
          <a href={props.liveUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">View live page</a>
          {canEdit && <button type="button" className="btn btn-primary" onClick={doPublish} disabled={busy || save === "saving" || (!dirty && !props.hasDraft)} data-testid="publish">{busy ? "Working…" : "Publish"}</button>}
        </div>
      </div>
      <p className="page-sub" role="status" aria-live="polite" data-testid="design-status" data-save={save} data-dirty={dirty ? "1" : "0"}>{status}</p>
      {conflict && (
        <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="design-conflict">
          <b>Someone else changed this page while you were editing it.</b> Your changes are not saved yet.
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadTheirs} data-testid="conflict-theirs">Load their version</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => keepMine(conflict.stamp)} data-testid="conflict-mine">Keep mine</button>
          </div>
        </div>
      )}
      {error && <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="design-error">{error}</div>}
      {notice && <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="design-notice">{notice}</div>}

      <div className="editor-grid">
        <div className="editor-side stack">
          {props.header}
          <div className="tabs" role="tablist" aria-label="Editor">
            {(["sections", "theme", "history"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)} className="tabbtn" data-testid={`tab-${t}`}>{t === "sections" ? "Sections" : t === "theme" ? "Colours and style" : "History"}</button>
            ))}
          </div>

          {tab === "sections" && (
            <>
              {props.sectionsLocked && <div className="notice" role="note" data-testid="sections-locked">Your plan lets you change colours and style. To rearrange or edit sections, move up to the Pro plan. <a className="link" href="/billing">See plans</a></div>}
              <ol className="section-list" aria-label="Sections on this page">
                {page.sections.map((s, i) => {
                  const def = sectionDef(s.type);
                  return (
                    <li key={s.id} className={s.id === selected ? "on" : ""} data-testid="section-row" data-type={s.type}>
                      <button type="button" className="pick" onClick={() => { setSelected(s.id); post({ type: "bt-preview:focus", id: s.id }); }} aria-pressed={s.id === selected}>
                        <b>{def?.label ?? s.type}</b>{s.disabled && <span className="pill grey" style={{ marginLeft: 6 }}>Hidden</span>}
                      </button>
                      {canEdit && !props.sectionsLocked && (
                        <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                          <button type="button" className="btn btn-secondary btn-sm" disabled={i === 0} onClick={() => move(s.id, -1)} aria-label={`Move ${def?.label} up`}>↑</button>
                          <button type="button" className="btn btn-secondary btn-sm" disabled={i === page.sections.length - 1} onClick={() => move(s.id, 1)} aria-label={`Move ${def?.label} down`}>↓</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => edit((p) => ({ ...p, sections: p.sections.map((x) => (x.id === s.id ? { ...x, disabled: !x.disabled } : x)) }))} aria-label={`${s.disabled ? "Show" : "Hide"} ${def?.label}`}>{s.disabled ? "Show" : "Hide"}</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => duplicate(s)} disabled={!!def?.max && count(s.type) >= def.max} aria-label={`Duplicate ${def?.label}`}>Copy</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(s.id)} aria-label={`Delete ${def?.label}`}>Delete</button>
                        </span>
                      )}
                    </li>
                  );
                })}
                {page.sections.length === 0 && <li className="muted" style={{ padding: 12 }}>This page is empty. Add a section below.</li>}
              </ol>

              {canEdit && !props.sectionsLocked && (
                <div className="card" style={{ padding: 12 }}>
                  <label className="label" htmlFor="add-section">Add a section</label>
                  <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                    <select id="add-section" className="select" value={adding} onChange={(e) => setAdding(e.target.value)} data-testid="add-type">
                      {defs.map((d) => <option key={d.type} value={d.type} disabled={!!d.max && count(d.type) >= d.max}>{d.label}</option>)}
                    </select>
                    <button type="button" className="btn btn-secondary" onClick={add} disabled={page.sections.length >= 30 || (!!sectionDef(adding)?.max && count(adding) >= sectionDef(adding)!.max!)} data-testid="add-section">Add</button>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{sectionDef(adding)?.description}</div>
                </div>
              )}

              {current && sectionDef(current.type) && (
                <section className="card" aria-label={`Edit ${sectionDef(current.type)!.label}`}>
                  <h2 style={{ fontSize: 16, marginBottom: 10 }}>{sectionDef(current.type)!.label}</h2>
                  <SectionForm def={sectionDef(current.type)!} section={current} disabled={!canEdit || !!props.sectionsLocked} onChange={(p) => patch(current.id, p)} />
                </section>
              )}
            </>
          )}

          {tab === "theme" && kind === "home" && <section className="card"><ThemePanel theme={theme} onChange={editTheme} disabled={!canEdit} /></section>}
          {tab === "theme" && kind !== "home" && <section className="card muted">Colours and style are set once for the whole store, from the Store design page.</section>}

          {tab === "history" && (
            <section className="card stack" data-testid="history">
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
          )}
        </div>

        <div className="editor-preview">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <b>Preview</b>
            <span className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
              <button type="button" className="btn btn-secondary btn-sm" aria-pressed={lang === "bn"} onClick={() => setLang("bn")}>বাংলা</button>
              <button type="button" className="btn btn-secondary btn-sm" aria-pressed={view === "phone"} onClick={() => setView("phone")}>Phone</button>
              <button type="button" className="btn btn-secondary btn-sm" aria-pressed={view === "desktop"} onClick={() => setView("desktop")}>Computer</button>
            </span>
          </div>
          <div className={`frame-wrap ${view}`}>
            <iframe ref={frame} src={props.previewUrl} title="Preview of your store" data-testid="preview-frame" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" onLoad={() => { /* the page announces itself with a message */ }} />
          </div>
        </div>
      </div>
    </>
  );
}
