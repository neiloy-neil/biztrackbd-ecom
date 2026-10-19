"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Drawer, Segmented, useToast } from "@biztrackbd/ui";
import {
  DEFAULT_THEME, FONT_LABELS, FONT_PAIRS, STYLE_FIELDS, contrast, editableField, newSection, sectionDef, sectionsFor, setByPath, validateTheme,
  SECTION_GRADIENT_PRESETS, normalizeSettings, normalizeSectionStyle, SECTION_PATTERNS, PATTERN_CATEGORIES,
  THEME_PALETTES, THEME_RADII, RADIUS_PX, type ThemePalette, type ThemeRadius,
  type Field, type ListSpec, type PageJson, type PageKind, type PageSection, type SectionDef, type ThemeSettings, type SiteMode, type BusinessVertical,
  type SectionStyle, type SectionBgType, type SectionPaddingY, type SectionHideOn, type SectionTextColor,
  type SectionAnimation, type SectionAnimDuration, type SectionAnimDelay, type SectionPattern,
} from "@biztrackbd/core/builder-client";
import { ImagePicker } from "@/components/image-picker";
import { LANDING_GROUPS, STORE_SECTION_CATEGORIES, SectionThumb } from "./section-thumbs";
import { PatternCard } from "./pattern-card";
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
  siteMode?: SiteMode;
  businessVertical?: BusinessVertical;
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
const IMore = () => <svg {...svg} width={16} height={16}><circle cx="12" cy="12" r="1.5" /><circle cx="6" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" /></svg>;
const ILink = () => <svg {...svg}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>;
const ILayers = () => <svg {...svg}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>;
const IBlocks = () => <svg {...svg}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>;
const IPalette = () => <svg {...svg}><path d="M12 2a10 10 0 00-10 10 9.9 9.9 0 005 8.66c.55.32 1.25.13 1.57-.42.23-.39.22-.88-.02-1.28A4 4 0 0112 16a2 2 0 012 2v.5a2.5 2.5 0 005 0V17a7 7 0 001.4-4.2A10 10 0 0012 2z" /><circle cx="7.5" cy="10.5" r="1.5" /><circle cx="12" cy="7.5" r="1.5" /><circle cx="16.5" cy="10.5" r="1.5" /></svg>;
const IHistory = () => <svg {...svg}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const ICollapseLeft = () => <svg {...svg} width={16} height={16}><polyline points="15 18 9 12 15 6" /></svg>;
const IExpandRight = () => <svg {...svg} width={16} height={16}><polyline points="9 18 15 12 9 6" /></svg>;
const IZen = () => <svg {...svg}><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></svg>;

function sectionGlyph(type: string): string {
  switch (type) {
    case "hero":
    case "doctor-hero":
    case "banner":
      return "🖼️";
    case "restaurant-menu":
      return "🍽️";
    case "restaurant-hours-location":
    case "clinic-chambers":
      return "📍";
    case "reservation-cta":
      return "📅";
    case "featured-products":
    case "collection-products":
      return "🛍️";
    case "category-grid":
      return "🗂️";
    case "testimonials-slider":
    case "product-reviews":
      return "⭐";
    case "trust-strip":
      return "🛡️";
    case "bento-grid":
      return "▦";
    case "content-tabs":
      return "📑";
    case "pricing-matrix":
      return "🏷️";
    case "accordion-faq":
      return "❓";
    case "video-lightbox":
    case "video-reels":
      return "▶️";
    case "countdown-timer":
      return "⏱️";
    case "promo-popup":
      return "🎁";
    case "floating-whatsapp":
      return "💬";
    case "contact-form":
      return "✉️";
    case "team-grid":
      return "👥";
    case "process-timeline":
      return "⏳";
    case "flip-box":
      return "🔄";
    case "image-comparison":
      return "🪞";
    default:
      return "▤";
  }
}

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

function getItemPreviewTitle(it: Settings, spec: ListSpec, index: number): string {
  const candidate = (
    it.title ||
    it.heading ||
    it.question ||
    it.label ||
    it.name ||
    it.dishName ||
    it.author ||
    it.text
  );
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  return `${spec.itemLabel} ${index + 1}`;
}

function ListEditor({
  spec,
  items,
  onChange,
  disabled,
  idPrefix,
  imgSignal,
}: {
  spec: ListSpec;
  items: Settings[];
  onChange: (items: Settings[]) => void;
  disabled: boolean;
  idPrefix: string;
  imgSignal?: { path: string; n: number };
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const set = (i: number, patch: Settings) =>
    onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
    setExpandedIndex(j);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onChange(next);
    setExpandedIndex(to);
  };

  const duplicateItem = (i: number) => {
    if (items.length >= spec.max || disabled) return;
    const clone = structuredClone(items[i]);
    const next = [...items];
    next.splice(i + 1, 0, clone!);
    onChange(next);
    setExpandedIndex(i + 1);
  };

  const addItem = () => {
    if (items.length >= spec.max || disabled) return;
    const next = [...items, structuredClone(spec.defaultItem)];
    onChange(next);
    setExpandedIndex(next.length - 1);
  };

  return (
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <legend style={{ fontWeight: 700, margin: 0, fontSize: 13 }}>
          {spec.label} <span className="muted" style={{ fontWeight: 500, fontSize: 11 }}>({items.length}/{spec.max})</span>
        </legend>
        {items.length < spec.max && !disabled && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addItem}
            style={{ fontSize: 11, height: 26, padding: "0 8px" }}
          >
            + Add {spec.itemLabel.toLowerCase()}
          </button>
        )}
      </div>

      <div className="bld-repeater" role="list">
        {items.map((it, i) => {
          const isExpanded = expandedIndex === i;
          const title = getItemPreviewTitle(it, spec, i);
          const hasCustomTitle = title !== `${spec.itemLabel} ${i + 1}`;

          return (
            <div
              key={i}
              className={`bld-repeater-item${isExpanded ? " expanded" : ""}${dragOverIdx === i && dragIdx !== null && dragIdx !== i ? (dragIdx < i ? " over-after" : " over-before") : ""}`}
              data-testid="list-item"
              draggable={!disabled}
              onDragStart={(e) => {
                setDragIdx(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (dragIdx !== null) {
                  e.preventDefault();
                  setDragOverIdx(i);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null) {
                  reorder(dragIdx, i);
                }
                setDragIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => {
                setDragIdx(null);
                setDragOverIdx(null);
              }}
            >
              {/* Accordion Row Header */}
              <div
                className="bld-repeater-head"
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                title="Click to expand/collapse"
              >
                {!disabled && (
                  <span
                    className="bld-repeater-grip"
                    onClick={(e) => e.stopPropagation()}
                    aria-hidden
                    title="Drag to reorder"
                  >
                    <IGrip />
                  </span>
                )}
                <div className="bld-repeater-title">
                  <span>{title}</span>
                  {hasCustomTitle && <span className="muted">#{i + 1}</span>}
                </div>
                <div className="bld-repeater-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="bld-ib"
                    disabled={disabled || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Move up`}
                    title="Move up"
                    style={{ width: 24, height: 24 }}
                  >
                    <IUp />
                  </button>
                  <button
                    type="button"
                    className="bld-ib"
                    disabled={disabled || i === items.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move down`}
                    title="Move down"
                    style={{ width: 24, height: 24 }}
                  >
                    <IDown />
                  </button>
                  <button
                    type="button"
                    className="bld-ib"
                    disabled={disabled || items.length >= spec.max}
                    onClick={() => duplicateItem(i)}
                    aria-label={`Duplicate`}
                    title="Duplicate item"
                    style={{ width: 24, height: 24 }}
                  >
                    <ICopy />
                  </button>
                  <button
                    type="button"
                    className="bld-ib danger"
                    disabled={disabled || items.length <= spec.min}
                    onClick={() => {
                      onChange(items.filter((_, j) => j !== i));
                      if (expandedIndex === i) setExpandedIndex(null);
                      else if (expandedIndex !== null && expandedIndex > i) setExpandedIndex(expandedIndex - 1);
                    }}
                    aria-label={`Remove`}
                    title="Delete item"
                    style={{ width: 24, height: 24 }}
                  >
                    <ITrash />
                  </button>
                </div>
                <span className="bld-repeater-chevron" aria-hidden>
                  ▾
                </span>
              </div>

              {/* Accordion Expanded Body */}
              {isExpanded && (
                <div className="bld-repeater-body">
                  {spec.fields.map((f) => (
                    <FieldInput
                      key={f.key}
                      f={f}
                      value={it[f.key]}
                      disabled={disabled}
                      idPrefix={`${idPrefix}-${i}`}
                      openSignal={imgSignal?.path === `${spec.key}.${i}.${f.key}` ? imgSignal.n : 0}
                      onChange={(v) => set(i, { [f.key]: v })}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.length < spec.max && !disabled && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={addItem}
          style={{ marginTop: 8 }}
        >
          + Add {spec.itemLabel.toLowerCase()}
        </button>
      )}
    </fieldset>
  );
}

const isStyle = (f: Field) => f.type === "color" || f.type === "select" || f.type === "number" || f.type === "checkbox";

/** Content tab of the Elementor-style 3-tab inspector: text copy, list repeater items, and Bengali translations. */
function SectionContentTab({
  def,
  section,
  onChange,
  disabled,
  bnOpen,
  imgSignal,
}: {
  def: SectionDef;
  section: PageSection;
  onChange: (patch: Settings) => void;
  disabled: boolean;
  bnOpen: boolean;
  imgSignal?: { path: string; n: number };
}) {
  const content = def.fields.filter((f) => !f.bn && !isStyle(f));
  const bn = def.fields.filter((f) => f.bn);
  const row = (f: Field) => (
    <FieldInput
      key={f.key}
      f={f}
      value={section.settings[f.key]}
      disabled={disabled}
      idPrefix={section.id}
      openSignal={imgSignal?.path === f.key ? imgSignal.n : 0}
      onChange={(v) => onChange({ [f.key]: v })}
    />
  );

  const hasNothing = content.length === 0 && !def.list && bn.length === 0;

  return (
    <div className="stack" style={{ gap: 14 }} data-testid="section-form">
      {hasNothing && (
        <div className="bld-group" style={{ textAlign: "center", padding: "24px 16px" }}>
          <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>📋</span>
          <b style={{ fontSize: 13, color: "var(--ink)" }}>Automatic Store Content</b>
          <p className="muted" style={{ margin: "6px auto 0", fontSize: 12, maxWidth: 280, lineHeight: 1.45 }}>
            This section renders live store items automatically. Use the <b>Style</b> or <b>Advanced</b> tab to customize colors, spacing, and entrance animations.
          </p>
        </div>
      )}

      {content.length > 0 && (
        <div className="bld-group">
          <div className="bld-gh">Content & Copy</div>
          <div className="stack" style={{ gap: 10 }}>{content.map(row)}</div>
        </div>
      )}

      {def.list && (
        <div className="bld-group">
          <ListEditor
            spec={def.list}
            items={(section.settings[def.list.key] as Settings[]) ?? []}
            disabled={disabled}
            idPrefix={section.id}
            imgSignal={imgSignal}
            onChange={(items) => onChange({ [def.list!.key]: items })}
          />
        </div>
      )}

      {bn.length > 0 && (
        <details className="bld-group bld-bn" open={bnOpen}>
          <summary className="bld-gh">
            Bangla text <span className="muted" style={{ fontWeight: 500 }}>(ঐচ্ছিক)</span>
          </summary>
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>{bn.map(row)}</div>
        </details>
      )}
    </div>
  );
}

const COLOR_SWATCHES = [
  { label: "White", hex: "#ffffff" },
  { label: "Off White", hex: "#f8fafc" },
  { label: "Cream", hex: "#fff8f3" },
  { label: "Slate Grey", hex: "#f1f5f9" },
  { label: "Dark Slate", hex: "#0f172a" },
  { label: "Zinc Carbon", hex: "#18181b" },
  { label: "Navy", hex: "#0d121e" },
  { label: "Emerald", hex: "#064e3b" },
];

/** Style tab of the Elementor-style 3-tab inspector: component options, background tone, swatches, gradients, card container, and vertical spacing. */
function SectionStyleTab({
  def,
  section,
  disabled,
  imgSignal,
  onChangeSettings,
  onChangeStyle,
}: {
  def?: SectionDef;
  section: PageSection;
  disabled: boolean;
  imgSignal?: { path: string; n: number };
  onChangeSettings: (patch: Settings) => void;
  onChangeStyle: (patch: Partial<SectionStyle>) => void;
}) {
  const style = section.style ?? {};
  const bgType: SectionBgType = style.bgType ?? "default";
  const paddingY: SectionPaddingY = style.paddingY ?? "normal";
  const textColor: SectionTextColor = style.textColor ?? "default";

  const isSpecial = section.type === "floating-whatsapp" || section.type === "announcement-bar";
  const sectionStyleFields = def ? def.fields.filter((f) => !f.bn && isStyle(f)) : [];
  const row = (f: Field) => (
    <FieldInput
      key={f.key}
      f={f}
      value={section.settings[f.key]}
      disabled={disabled}
      idPrefix={section.id}
      openSignal={imgSignal?.path === f.key ? imgSignal.n : 0}
      onChange={(v) => onChangeSettings({ [f.key]: v })}
    />
  );

  return (
    <div className="stack" style={{ gap: 14 }} data-testid="section-style-tab">
      {/* Component Specific Style Options */}
      {sectionStyleFields.length > 0 && (
        <div className="bld-group">
          <div className="bld-gh">Component Options</div>
          <div className="stack" style={{ gap: 10 }}>{sectionStyleFields.map(row)}</div>
        </div>
      )}

      {/* Global Background & Tone */}
      {!isSpecial && (
        <details className="bld-group" open>
          <summary className="bld-gh">Background & Appearance</summary>
          <div className="stack" style={{ gap: 12, marginTop: 10 }}>
            <div className="field" style={{ margin: 0, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
              <label className="label">Background Tone</label>
              <Segmented
                label="Background style"
                value={bgType}
                onChange={(v) => !disabled && onChangeStyle({ bgType: v as SectionBgType })}
                options={[
                  { value: "default", label: "Default" },
                  { value: "color", label: "Color" },
                  { value: "gradient", label: "Gradient" },
                  { value: "image", label: "Image" },
                ]}
              />
            </div>

            {bgType === "color" && (
              <div className="stack" style={{ gap: 8 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label className="label" htmlFor={`${section.id}-bg-color`}>Background Color</label>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <input
                      id={`${section.id}-bg-color`}
                      type="color"
                      className="bld-color-input"
                      value={style.bgColor ?? "#ffffff"}
                      disabled={disabled}
                      onChange={(e) => onChangeStyle({ bgColor: e.target.value })}
                    />
                    <input
                      type="text"
                      className="input"
                      style={{ width: 110, fontFamily: "monospace" }}
                      value={style.bgColor ?? "#ffffff"}
                      disabled={disabled}
                      onChange={(e) => onChangeStyle({ bgColor: e.target.value })}
                      placeholder="#ffffff"
                    />
                  </div>
                </div>

                <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: 12 }}>Quick colors:</span>
                  {COLOR_SWATCHES.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      title={sw.label}
                      className="bld-swatch-btn"
                      style={{
                        backgroundColor: sw.hex,
                        outline: style.bgColor?.toLowerCase() === sw.hex ? "2px solid var(--brand)" : "1px solid var(--line-2)",
                      }}
                      disabled={disabled}
                      onClick={() => onChangeStyle({ bgColor: sw.hex })}
                    />
                  ))}
                </div>
              </div>
            )}

            {bgType === "gradient" && (
              <div className="field" style={{ margin: 0 }}>
                <label className="label">Gradient Preset</label>
                <div className="bld-gradient-grid">
                  {Object.entries(SECTION_GRADIENT_PRESETS).map(([key, item]) => {
                    const isSelected = (style.bgGradient ?? "midnight") === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`bld-gradient-chip ${isSelected ? "selected" : ""}`}
                        disabled={disabled}
                        onClick={() => onChangeStyle({ bgGradient: key })}
                      >
                        <span className="bld-gradient-preview" style={{ background: item.css }} />
                        <span className="bld-gradient-title">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {bgType === "image" && (
              <div className="stack" style={{ gap: 10 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label className="label" htmlFor={`${section.id}-bg-img`}>Background Image URL</label>
                  <input
                    id={`${section.id}-bg-img`}
                    type="url"
                    className="input"
                    value={style.bgImage ?? ""}
                    disabled={disabled}
                    onChange={(e) => onChangeStyle({ bgImage: e.target.value })}
                    placeholder="https://... or /media/..."
                  />
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Use an HTTPS picture or uploaded store media path.
                  </div>
                </div>

                <div className="row" style={{ gap: 12, alignItems: "center" }}>
                  <div className="field" style={{ margin: 0, flex: 1, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
                    <label className="label">Overlay Tint</label>
                    <Segmented
                      label="Overlay tint"
                      value={style.bgOverlayTint ?? "dark"}
                      onChange={(v) => !disabled && onChangeStyle({ bgOverlayTint: v as "dark" | "light" })}
                      options={[
                        { value: "dark", label: "Dark" },
                        { value: "light", label: "Light" },
                      ]}
                    />
                  </div>
                  <div className="field" style={{ margin: 0, flex: 1 }}>
                    <label className="label" htmlFor={`${section.id}-overlay-range`}>
                      Dim: {style.bgOverlay ?? 40}%
                    </label>
                    <input
                      id={`${section.id}-overlay-range`}
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={style.bgOverlay ?? 40}
                      disabled={disabled}
                      onChange={(e) => onChangeStyle({ bgOverlay: Number(e.target.value) })}
                      style={{ width: "100%", accentColor: "var(--brand)" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="field" style={{ margin: 0, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
              <label className="label">Text Contrast</label>
              <Segmented
                label="Text contrast"
                value={textColor}
                onChange={(v) => !disabled && onChangeStyle({ textColor: v as SectionTextColor })}
                options={[
                  { value: "default", label: "Default" },
                  { value: "dark", label: "Dark text" },
                  { value: "light", label: "Light text" },
                ]}
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Switch to Light text if you choose a dark background color or gradient.
              </div>
            </div>

            <label className="row" style={{ gap: 8, alignItems: "center", cursor: "pointer", marginTop: 4 }}>
              <input
                type="checkbox"
                checked={style.cardMode ?? false}
                disabled={disabled}
                onChange={(e) => onChangeStyle({ cardMode: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: "var(--brand)" }}
              />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Wrap in floating card container</span>
            </label>
          </div>
        </details>
      )}

      {/* Spacing & Layout */}
      {!isSpecial && (
        <details className="bld-group" open>
          <summary className="bld-gh">Spacing & Layout</summary>
          <div className="stack" style={{ gap: 12, marginTop: 10 }}>
            <div className="field" style={{ margin: 0, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
              <label className="label">Vertical Spacing (Padding)</label>
              <Segmented
                label="Vertical spacing"
                value={paddingY}
                onChange={(v) => !disabled && onChangeStyle({ paddingY: v as SectionPaddingY })}
                options={[
                  { value: "none", label: "0px" },
                  { value: "compact", label: "Compact" },
                  { value: "normal", label: "Normal" },
                  { value: "spacious", label: "Spacious" },
                ]}
              />
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

/** Advanced tab of the Elementor-style 3-tab inspector: responsive device visibility, entrance animations with speed/delay & preview replay, anchor ID and custom CSS classes. */
function SectionAdvancedTab({
  section,
  disabled,
  onChangeStyle,
  onReplayAnim,
}: {
  section: PageSection;
  disabled: boolean;
  onChangeStyle: (patch: Partial<SectionStyle>) => void;
  onReplayAnim?: () => void;
}) {
  const style = section.style ?? {};
  const hideOn: SectionHideOn = style.hideOn ?? "none";
  const isSpecial = section.type === "floating-whatsapp" || section.type === "announcement-bar";

  return (
    <div className="stack" style={{ gap: 14 }} data-testid="section-appearance">
      {/* 1. Responsive & Device Visibility */}
      <details className="bld-group" open>
        <summary className="bld-gh">Responsive Visibility</summary>
        <div className="stack" style={{ gap: 12, marginTop: 10 }}>
          <div className="field" style={{ margin: 0, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
            <label className="label">Show On Devices</label>
            <Segmented
              label="Device visibility"
              value={hideOn}
              onChange={(v) => !disabled && onChangeStyle({ hideOn: v as SectionHideOn })}
              options={[
                { value: "none", label: "All devices" },
                { value: "mobile", label: "Desktop only" },
                { value: "desktop", label: "Mobile only" },
              ]}
            />
            {hideOn === "mobile" && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4, color: "var(--warning)" }}>
                Hidden on mobile phones (viewport width &le; 768px).
              </div>
            )}
            {hideOn === "desktop" && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4, color: "var(--warning)" }}>
                Hidden on desktop / computers (viewport width &gt; 768px).
              </div>
            )}
          </div>
        </div>
      </details>

      {/* 2. Motion & Scroll Effects */}
      {!isSpecial && (
        <details className="bld-group" open>
          <summary className="bld-gh">Motion & Scroll Effects</summary>
          <div className="stack" style={{ gap: 12, marginTop: 10 }}>
            <div className="field" style={{ margin: 0, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
              <label className="label">Entrance Animation</label>
              <select
                className="select"
                value={style.animation ?? "none"}
                disabled={disabled}
                onChange={(e) => {
                  const anim = e.target.value as SectionAnimation;
                  onChangeStyle({ animation: anim });
                  if (anim !== "none") {
                    setTimeout(() => onReplayAnim?.(), 50);
                  }
                }}
              >
                <option value="none">None (Immediate display)</option>
                <option value="fade">Fade In (Gentle opacity)</option>
                <option value="slide-up">Slide Up (From bottom)</option>
                <option value="slide-down">Slide Down (From top)</option>
                <option value="slide-left">Slide Left (From right edge)</option>
                <option value="slide-right">Slide Right (From left edge)</option>
                <option value="zoom-in">Zoom In (Scale from 92%)</option>
              </select>
            </div>

            {style.animation && style.animation !== "none" && (
              <>
                <div className="field" style={{ margin: 0, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
                  <label className="label">Animation Speed</label>
                  <Segmented
                    label="Animation speed"
                    value={style.animDuration ?? "normal"}
                    onChange={(v) => {
                      onChangeStyle({ animDuration: v as SectionAnimDuration });
                      setTimeout(() => onReplayAnim?.(), 50);
                    }}
                    options={[
                      { value: "fast", label: "Fast (0.3s)" },
                      { value: "normal", label: "Normal (0.6s)" },
                      { value: "slow", label: "Slow (0.9s)" },
                    ]}
                  />
                </div>

                <div className="field" style={{ margin: 0, opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
                  <label className="label">Start Delay</label>
                  <Segmented
                    label="Animation delay"
                    value={String(style.animDelay ?? 0)}
                    onChange={(v) => {
                      onChangeStyle({ animDelay: Number(v) as SectionAnimDelay });
                      setTimeout(() => onReplayAnim?.(), 50);
                    }}
                    options={[
                      { value: "0", label: "0s" },
                      { value: "150", label: "150ms" },
                      { value: "300", label: "300ms" },
                      { value: "450", label: "450ms" },
                    ]}
                  />
                </div>

                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={disabled}
                    onClick={() => onReplayAnim?.()}
                    style={{ fontSize: 12, gap: 6 }}
                  >
                    ▶ Replay Animation Preview
                  </button>
                </div>
              </>
            )}
          </div>
        </details>
      )}

      {/* 3. Developer & Anchor */}
      <details className="bld-group">
        <summary className="bld-gh">Developer & Attributes</summary>
        <div className="stack" style={{ gap: 12, marginTop: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label className="label" htmlFor={`${section.id}-anchor-id`}>
              Section HTML Anchor ID
            </label>
            <div className="row" style={{ gap: 6, alignItems: "center" }}>
              <span className="muted" style={{ fontWeight: 600, fontSize: 14 }}>#</span>
              <input
                id={`${section.id}-anchor-id`}
                type="text"
                className="input"
                value={style.anchorId ?? ""}
                disabled={disabled}
                placeholder="e.g. reviews, menu, contact"
                maxLength={32}
                onChange={(e) => {
                  const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                  onChangeStyle({ anchorId: cleaned });
                }}
              />
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Allows smooth in-page jumping using button or navbar links like <code>#{style.anchorId || "reviews"}</code>.
            </div>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label className="label" htmlFor={`${section.id}-custom-class`}>
              Custom CSS Class Names
            </label>
            <input
              id={`${section.id}-custom-class`}
              type="text"
              className="input"
              value={style.customClass ?? ""}
              disabled={disabled}
              placeholder="e.g. hero-glow my-custom-card"
              maxLength={80}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9_\-\s]/g, "");
                onChangeStyle({ customClass: cleaned });
              }}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Space-separated CSS classes attached to this section container.
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

/** Backward-compatible wrapper */
function SectionForm({ def, section, onChange, disabled, bnOpen, imgSignal }: { def: SectionDef; section: PageSection; onChange: (patch: Settings) => void; disabled: boolean; bnOpen: boolean; imgSignal?: { path: string; n: number } }) {
  return <SectionContentTab def={def} section={section} onChange={onChange} disabled={disabled} bnOpen={bnOpen} imgSignal={imgSignal} />;
}

/** Backward-compatible wrapper */
function SectionAppearanceForm({
  section,
  disabled,
  onChange,
  onReplayAnim,
}: {
  section: PageSection;
  disabled: boolean;
  onChange: (patch: Partial<SectionStyle>) => void;
  onReplayAnim?: () => void;
}) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <SectionStyleTab
        def={sectionDef(section.type)}
        section={section}
        disabled={disabled}
        onChangeSettings={() => {}}
        onChangeStyle={onChange}
      />
      <SectionAdvancedTab
        section={section}
        disabled={disabled}
        onChangeStyle={onChange}
        onReplayAnim={onReplayAnim}
      />
    </div>
  );
}

function ThemePanel({ theme, onChange, disabled }: { theme: ThemeSettings; onChange: (t: ThemeSettings) => void; disabled: boolean }) {
  const problem = useMemo(() => {
    try { validateTheme(theme); return null; } catch (e) { return e instanceof Error ? e.message : "Check these colours"; }
  }, [theme]);

  const set = (patch: Partial<ThemeSettings>) => onChange({ ...theme, ...patch });

  const activePalette = useMemo(() => {
    if (theme.paletteId) {
      const found = THEME_PALETTES.find((p) => p.id === theme.paletteId);
      if (found && found.accent.toUpperCase() === theme.accent.toUpperCase() && found.background.toUpperCase() === theme.background.toUpperCase()) {
        return found.id;
      }
    }
    return THEME_PALETTES.find((p) => p.accent.toUpperCase() === theme.accent.toUpperCase() && p.background.toUpperCase() === theme.background.toUpperCase())?.id ?? null;
  }, [theme.paletteId, theme.accent, theme.background]);

  const textContrast = useMemo(() => {
    try { return contrast(theme.text, theme.background); } catch { return 0; }
  }, [theme.text, theme.background]);

  const accentContrast = useMemo(() => {
    try { return contrast(theme.accent, theme.background); } catch { return 0; }
  }, [theme.accent, theme.background]);

  const applyPalette = (p: ThemePalette) => {
    set({
      accent: p.accent,
      background: p.background,
      text: p.text,
      paletteId: p.id,
      radius: p.recommendedRadius ?? theme.radius,
      font: p.recommendedFont ?? theme.font,
    });
  };

  const color = (key: "accent" | "background" | "text", label: string) => (
    <FieldInput f={{ key, label, type: "color" }} value={theme[key]} disabled={disabled} idPrefix="theme" onChange={(v) => set({ [key]: String(v) })} />
  );

  return (
    <div className="stack" style={{ gap: 14 }} data-testid="theme-panel">
      {/* 1. Curated Brand Color Palettes */}
      <div className="bld-group" data-testid="brand-palettes-group">
        <div className="bld-gh" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Curated Brand Palettes</span>
          <span className="pill" style={{ fontSize: 10, padding: "2px 6px", background: "var(--accent, #5B4FE8)", color: "#FFF" }}>1-Click Apply</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, padding: "6px 0" }}>
          {THEME_PALETTES.map((p) => {
            const isSelected = activePalette === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => applyPalette(p)}
                data-testid={`palette-${p.id}`}
                aria-pressed={isSelected}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: isSelected ? "2px solid var(--accent, #5B4FE8)" : "1px solid var(--line)",
                  background: isSelected ? "color-mix(in srgb, var(--accent, #5B4FE8) 6%, transparent)" : "var(--surface)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  position: "relative",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", marginBottom: 6 }}>
                  {/* Swatch Pill */}
                  <div
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 999,
                      background: p.background,
                      border: "1px solid rgba(0,0,0,0.12)",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 3px",
                      gap: 3,
                    }}
                  >
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: p.accent }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: p.text }}>Aa</span>
                  </div>
                  {isSelected && (
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--accent, #5B4FE8)", fontWeight: 700 }}>✓</span>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 2, lineHeight: 1.2 }}>{p.nameBn}</div>
              </button>
            );
          })}
        </div>

        {/* Custom Color Tuning */}
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", userSelect: "none", padding: "4px 0" }}>
            Custom Hex Colors & Contrast
          </summary>
          <div className="stack" style={{ gap: 10, marginTop: 10, padding: 10, background: "var(--surface-sunken, rgba(0,0,0,0.02))", borderRadius: 8 }}>
            {color("accent", "Main colour (buttons, links)")}
            {color("background", "Page background")}
            {color("text", "Text colour")}

            <div style={{ display: "flex", gap: 8, fontSize: 11, flexWrap: "wrap", marginTop: 4 }}>
              <div style={{ padding: "3px 8px", borderRadius: 6, background: textContrast >= 4.5 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: textContrast >= 4.5 ? "#065F46" : "#991B1B", fontWeight: 600 }}>
                Text Contrast: {textContrast.toFixed(1)}:1 {textContrast >= 4.5 ? "(WCAG AA Pass)" : "(Too Low)"}
              </div>
              <div style={{ padding: "3px 8px", borderRadius: 6, background: accentContrast >= 3.0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", color: accentContrast >= 3.0 ? "#065F46" : "#991B1B", fontWeight: 600 }}>
                Button Contrast: {accentContrast.toFixed(1)}:1 {accentContrast >= 3.0 ? "(Pass)" : "(Too Low)"}
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* 2. Typography & Bengali Fonts */}
      <div className="bld-group" data-testid="typography-group">
        <div className="bld-gh">Typography & Bengali Fonts</div>
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="theme-font">Font Pairing</label>
          <select id="theme-font" className="select" value={theme.font} disabled={disabled} onChange={(e) => set({ font: e.target.value as ThemeSettings["font"] })}>
            {FONT_PAIRS.map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}
          </select>
        </div>

        {/* Live Font Sample Strip */}
        <div style={{ padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, marginTop: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
            Aa Premium Storefront — চমৎকার ডিজাইন
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4, lineHeight: 1.4 }}>
            High-clarity typography optimized for fast rendering on mobile and desktop.
          </div>
        </div>
      </div>

      {/* 3. Buttons & Corner Radii */}
      <div className="bld-group" data-testid="buttons-and-shapes-group">
        <div className="bld-gh">Corners & Button Styling</div>

        {/* Corner Radii Segmented Buttons */}
        <div className="field" style={{ margin: 0 }}>
          <label className="label">Corner Rounding ({RADIUS_PX[theme.radius]}px)</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
            {([
              { key: "none", label: "0px", name: "Sharp" },
              { key: "subtle", label: "6px", name: "Subtle" },
              { key: "soft", label: "10px", name: "Soft" },
              { key: "rounded", label: "16px", name: "Round" },
              { key: "pill", label: "999px", name: "Pill" },
            ] as const).map((r) => {
              const active = theme.radius === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => set({ radius: r.key as ThemeRadius })}
                  data-testid={`radius-${r.key}`}
                  style={{
                    padding: "6px 2px",
                    borderRadius: 6,
                    border: active ? "2px solid var(--accent, #5B4FE8)" : "1px solid var(--line)",
                    background: active ? "color-mix(in srgb, var(--accent, #5B4FE8) 8%, transparent)" : "var(--surface)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    textAlign: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: active ? "var(--accent, #5B4FE8)" : "var(--ink)" }}>{r.name}</div>
                  <div style={{ fontSize: 9, color: "var(--ink-muted)" }}>{r.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Button Style Fields */}
        <div className="stack" style={{ gap: 10, marginTop: 10 }}>
          {STYLE_FIELDS.filter((f) => f.group === "Buttons").map((f) => (
            <div className="field" style={{ margin: 0 }} key={f.key}>
              <label className="label" htmlFor={`theme-${f.key}`}>{f.label}</label>
              <select id={`theme-${f.key}`} className="select" value={String(theme[f.key] ?? "look")} disabled={disabled} onChange={(e) => set({ [f.key]: e.target.value } as Partial<ThemeSettings>)}>
                {Object.entries(f.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Product Cards & Surfaces */}
      <div className="bld-group" data-testid="cards-and-surfaces-group">
        <div className="bld-gh">Cards & Surfaces</div>
        <div className="stack" style={{ gap: 10 }}>
          {STYLE_FIELDS.filter((f) => f.group === "Product cards").map((f) => (
            <div className="field" style={{ margin: 0 }} key={f.key}>
              <label className="label" htmlFor={`theme-${f.key}`}>{f.label}</label>
              <select id={`theme-${f.key}`} className="select" value={String(theme[f.key] ?? "look")} disabled={disabled} onChange={(e) => set({ [f.key]: e.target.value } as Partial<ThemeSettings>)}>
                {Object.entries(f.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Spacing and Width */}
      <div className="bld-group" data-testid="spacing-and-width-group">
        <div className="bld-gh">Spacing & Page Width</div>
        <div className="stack" style={{ gap: 10 }}>
          {STYLE_FIELDS.filter((f) => f.group === "Spacing and width").map((f) => (
            <div className="field" style={{ margin: 0 }} key={f.key}>
              <label className="label" htmlFor={`theme-${f.key}`}>{f.label}</label>
              <select id={`theme-${f.key}`} className="select" value={String(theme[f.key] ?? "look")} disabled={disabled} onChange={(e) => set({ [f.key]: e.target.value } as Partial<ThemeSettings>)}>
                {Object.entries(f.options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {problem && <div className="notice bad" role="alert">{problem} The preview keeps the last colours that worked.</div>}

      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => onChange(DEFAULT_THEME)}>
        Reset to Original Template Look
      </button>
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
  const [libraryTab, setLibraryTab] = useState<"components" | "patterns">("components");
  const [libraryCategory, setLibraryCategory] = useState("all");
  const [patternCategory, setPatternCategory] = useState("all");
  const [librarySearch, setLibrarySearch] = useState("");
  // Where a section chosen from the gallery goes: the gap that was clicked on the page, or the end.
  const [addAt, setAddAt] = useState<number | null>(null);
  // A click on a picture in the preview asks for that picture to be changed.
  const [imgSignal, setImgSignal] = useState<{ path: string; n: number } | undefined>(undefined);
  // On a phone the page fills the screen and the settings slide up from the bottom.
  const [sheet, setSheet] = useState(false);
  const visual = true;
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [conflict, setConflict] = useState<{ stamp: string | null } | null>(null);
  // Canvas Zoom, Stage Backdrop, and Interactive Resizing
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [canvasBackdrop, setCanvasBackdrop] = useState<"neutral" | "light" | "checker">("neutral");
  const [resizing, setResizing] = useState<"left" | "right" | null>(null);
  const resizeStart = useRef<{ clientX: number; startW: number } | null>(null);
  const [, bump] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [leftTab, setLeftTab] = useState<"layers" | "library" | "theme" | "history">("layers");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(340);
  const [resizingLeftDock, setResizingLeftDock] = useState(false);
  const leftResizeStart = useRef<{ clientX: number; startW: number } | null>(null);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [inspTab, setInspTab] = useState<"content" | "style" | "advanced">("content");
  const [treeSearch, setTreeSearch] = useState("");
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
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
      } else if ((m?.type === "bt-preview:select" || m?.type === "bt-preview:open-settings") && typeof m.id === "string" && latest.current.page.sections.some((s) => s.id === m.id)) {
        setSelected(m.id);
        setTab("settings");
        setRightCollapsed(false);
        setSheet(true);
        post({ type: "bt-preview:focus", id: m.id });
      } else if (m && typeof m.type === "string" && m.type.startsWith("bt-preview:") && visual) {
        handlers.current[m.type]?.(m as Record<string, unknown>);
      }
    }
    window.addEventListener("message", onMessage);
    const onWindowClick = () => setOpenRowMenu(null);
    window.addEventListener("click", onWindowClick);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("click", onWindowClick);
    };
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
  const patchStyle = (id: string, stylePatch: Partial<SectionStyle>) => {
    edit((pg) => ({
      ...pg,
      sections: pg.sections.map((s) => {
        if (s.id !== id) return s;
        const nextStyle: SectionStyle = { ...(s.style ?? {}), ...stylePatch };
        if (nextStyle.bgType === "default") delete nextStyle.bgType;
        if (nextStyle.hideOn === "none") delete nextStyle.hideOn;
        if (nextStyle.textColor === "default") delete nextStyle.textColor;
        if (!nextStyle.cardMode) delete nextStyle.cardMode;
        if (nextStyle.bgImage === "") delete nextStyle.bgImage;
        return {
          ...s,
          style: Object.keys(nextStyle).length > 0 ? nextStyle : undefined,
        };
      }),
    }));
  };
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
      const t = e.target as HTMLElement | null;
      const isInput = Boolean(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable));

      // Undo / Redo: Ctrl+Z / Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (isInput) return; // the field keeps its own undo
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }

      // Reorder with Alt+ArrowUp / Alt+ArrowDown
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        if (!selected || locked) return;
        e.preventDefault();
        move(selected, e.key === "ArrowUp" ? -1 : 1);
        return;
      }

      // Duplicate with Ctrl+D / Cmd+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (!selected || locked || isInput) return;
        const currentSec = latest.current.page.sections.find((s) => s.id === selected);
        if (currentSec && !full(currentSec.type)) {
          e.preventDefault();
          duplicate(currentSec);
        }
        return;
      }

      // Shortcuts modal toggle: ? or Shift+/
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Quick save with Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canEdit && !locked) {
          flush().then((ok) => {
            if (ok) toast("Draft saved");
          });
        }
        return;
      }

      // Toggle Left Sidebar: Ctrl+B / Cmd+B
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        if (!isInput) {
          e.preventDefault();
          setLeftCollapsed((prev) => !prev);
          return;
        }
      }

      // Zen Focus Mode (Toggle Both Sidebars): Ctrl+\ / Cmd+\
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        if (!isInput) {
          e.preventDefault();
          setLeftCollapsed((prevL) => {
            const next = !prevL;
            setRightCollapsed(next);
            return next;
          });
          return;
        }
      }

      // Escape key: close shortcuts modal or deselect section
      if (e.key === "Escape") {
        setShowShortcuts(false);
        if (selected && !isInput) {
          e.preventDefault();
          setSelected(null);
        }
        return;
      }

      // Delete with Delete key when not typing in an input
      if (e.key === "Delete" && !isInput) {
        if (!selected || locked) return;
        const currentSec = latest.current.page.sections.find((s) => s.id === selected);
        if (currentSec && !isRequired(currentSec.type)) {
          e.preventDefault();
          remove(selected);
        }
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selected, locked, canEdit, flush]);

  const defs = sectionsFor(kind, { mode: props.siteMode, vertical: props.businessVertical });
  const count = (type: string) => page.sections.filter((s) => s.type === type).length;
  const full = (type: string) => { const d = sectionDef(type); return page.sections.length >= 30 || (!!d?.max && count(type) >= d.max); };
  const current = page.sections.find((s) => s.id === selected) ?? null;
  const currentDef = current ? sectionDef(current.type) : undefined;

  const choose = (id: string) => { setSelected(id); post({ type: "bt-preview:focus", id }); setRightCollapsed(false); if (narrow) setTab("settings"); };
  function add(type: string) {
    const s = newSection(type);
    const at = addAt;
    edit((p) => {
      const next = [...p.sections];
      next.splice(at === null ? next.length : Math.max(0, Math.min(at, next.length)), 0, s);
      return { ...p, sections: next };
    });
    setSelected(s.id);
    setRightCollapsed(false);
    setAddAt(null);
    setLibrary(false);
    setTab(narrow ? "settings" : "layers");
    setTimeout(() => { post({ type: "bt-preview:focus", id: s.id }); }, 200);
  }
  function addPattern(pattern: SectionPattern) {
    const def = sectionDef(pattern.sectionType);
    if (!def || full(pattern.sectionType)) return;
    const base = newSection(pattern.sectionType);
    const s: PageSection = {
      id: base.id,
      type: pattern.sectionType,
      label: pattern.defaultLabel,
      settings: normalizeSettings(def, pattern.settings),
      style: normalizeSectionStyle(pattern.style),
    };
    const at = addAt;
    edit((p) => {
      const next = [...p.sections];
      next.splice(at === null ? next.length : Math.max(0, Math.min(at, next.length)), 0, s);
      return { ...p, sections: next };
    });
    setSelected(s.id);
    setRightCollapsed(false);
    setAddAt(null);
    setLibrary(false);
    setTab(narrow ? "settings" : "layers");
    toast(`Added "${pattern.title}" pattern`);
    setTimeout(() => {
      post({ type: "bt-preview:focus", id: s.id });
      post({ type: "bt-preview:highlight", id: s.id });
    }, 200);
  }
  function move(id: string, d: -1 | 1) {
    edit((p) => {
      const i = p.sections.findIndex((s) => s.id === id), j = i + d;
      if (i < 0 || j < 0 || j >= p.sections.length) return p;
      const next = [...p.sections];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...p, sections: next };
    });
    setTimeout(() => {
      post({ type: "bt-preview:focus", id });
      post({ type: "bt-preview:highlight", id });
    }, 100);
  }
  function reorder(from: number, to: number) {
    if (from === to) return;
    const movedId = page.sections[from]?.id;
    edit((p) => { const next = [...p.sections]; const [m] = next.splice(from, 1); next.splice(to, 0, m!); return { ...p, sections: next }; });
    if (movedId) {
      setTimeout(() => {
        post({ type: "bt-preview:focus", id: movedId });
        post({ type: "bt-preview:highlight", id: movedId });
      }, 100);
    }
  }
  function moveTo(id: string, targetIndex: number) {
    const from = page.sections.findIndex((s) => s.id === id);
    if (from < 0) return;
    const to = Math.max(0, Math.min(targetIndex, page.sections.length - 1));
    if (from !== to) reorder(from, to);
  }
  function patchLabel(id: string, label?: string) {
    edit((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.id === id ? { ...s, label: label?.trim() ? label.trim().slice(0, 60) : undefined } : s)),
    }));
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
      // A paragraph box keeps its line breaks; a single line of text never has one.
      // eslint-disable-next-line no-control-regex
      const value = (field.type === "textarea" ? m.value.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ") : m.value.replace(/[\u0000-\u001F\u007F]/g, " ")).slice(0, max);
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
    "bt-preview:spacing": (m) => {
      if (locked || typeof m.id !== "string" || (m.edge !== "top" && m.edge !== "bottom") || typeof m.px !== "number") return;
      const px = Math.max(0, Math.min(240, Math.round(m.px)));
      patchStyle(m.id, m.edge === "top" ? { paddingTop: px } : { paddingBottom: px });
    },
    "bt-preview:set-lang": (m) => {
      if (m.lang === "bn" || m.lang === "en") setLang(m.lang);
    },
    "bt-preview:insert": (m) => {
      if (locked || typeof m.index !== "number" || typeof m.blockType !== "string") return;
      const d = sectionDef(m.blockType);
      if (!d || full(m.blockType)) return;
      const s = newSection(m.blockType);
      const at = Math.max(0, Math.min(Math.round(m.index), latest.current.page.sections.length));
      edit((p) => {
        const next = [...p.sections];
        next.splice(at, 0, s);
        return { ...p, sections: next };
      });
      setSelected(s.id);
      setTab("settings");
      toast(`Added ${d.label}`);
    },
    "bt-preview:edit-image-url": (m) => {
      if (locked || typeof m.id !== "string" || typeof m.path !== "string" || typeof m.url !== "string") return;
      edit((pg) => ({
        ...pg,
        sections: pg.sections.map((x) => (x.id === m.id ? { ...x, settings: setByPath(x.settings, m.path as string, m.url as string) } : x)),
      }));
      toast("Image updated");
    },
    "bt-preview:upload-image": async (m) => {
      if (locked || typeof m.id !== "string" || typeof m.path !== "string" || typeof m.dataUrl !== "string") return;
      try {
        toast("Uploading picture...");
        const res = await fetch(m.dataUrl as string);
        const blob = await res.blob();
        const fd = new FormData();
        const fname = typeof m.filename === "string" && m.filename ? m.filename : "uploaded-picture.webp";
        fd.append("file", new File([blob], fname, { type: blob.type || "image/webp" }));
        const up = await fetch("/api/media", { method: "POST", body: fd });
        const json = await up.json().catch(() => ({}));
        if (!up.ok || !json.url) throw new Error(json.error || "Upload failed");
        edit((pg) => ({
          ...pg,
          sections: pg.sections.map((x) => (x.id === m.id ? { ...x, settings: setByPath(x.settings, m.path as string, json.url as string) } : x)),
        }));
        toast("Picture replaced");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to upload image");
      }
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
    if (key.startsWith("custom:")) {
      router.push(`/pages/${key.slice(7)}`);
    } else {
      router.push(key === "home" ? "/design" : `/design?page=${key}`);
    }
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
  const baseW = narrow ? 390 : DEVICE_WIDTH[device];
  const activeW = customWidth ?? baseW;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const compute = () => {
      if (zoomMode === "fit") {
        setScale(activeW ? Math.min(1, (el.clientWidth - 48) / activeW) : 1);
      } else {
        setScale(zoomMode);
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeW, zoomMode]);

  // Keyboard shortcuts for canvas zoom (Ctrl/Cmd +, -, 0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoomMode((curr) => {
          const val = curr === "fit" ? scale : curr;
          return Math.min(2.0, Math.round((val + 0.15) * 100) / 100);
        });
      } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        setZoomMode((curr) => {
          const val = curr === "fit" ? scale : curr;
          return Math.max(0.4, Math.round((val - 0.15) * 100) / 100);
        });
      } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        setZoomMode("fit");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scale]);

  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>, direction: "left" | "right") => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(direction);
    const startW = activeW ?? (stage.current ? Math.min(1280, stage.current.clientWidth - 48) : 1200);
    resizeStart.current = { clientX: e.clientX, startW };
  };

  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizing || !resizeStart.current) return;
    const delta = e.clientX - resizeStart.current.clientX;
    const factor = resizing === "right" ? 2 * delta : -2 * delta;
    let newW = Math.max(320, Math.min(1600, Math.round(resizeStart.current.startW + factor)));

    // Magnetic snap within +-12px
    const snaps = [390, 768, 1024, 1440];
    for (const snap of snaps) {
      if (Math.abs(newW - snap) <= 12) {
        newW = snap;
        break;
      }
    }
    setCustomWidth(newW);
  };

  const onResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    setResizing(null);
    resizeStart.current = null;
  };

  const onLeftResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizingLeftDock(true);
    leftResizeStart.current = { clientX: e.clientX, startW: leftWidth };
  };

  const onLeftResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizingLeftDock || !leftResizeStart.current) return;
    const delta = e.clientX - leftResizeStart.current.clientX;
    const newW = Math.max(280, Math.min(480, Math.round(leftResizeStart.current.startW + delta)));
    setLeftWidth(newW);
  };

  const onLeftResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    setResizingLeftDock(false);
    leftResizeStart.current = null;
  };

  const handleRailClick = (targetTab: "layers" | "library" | "theme" | "history") => {
    if (leftTab === targetTab && !leftCollapsed) {
      setLeftCollapsed(true);
    } else {
      setLeftTab(targetTab);
      setLeftCollapsed(false);
    }
  };

  const tabs: { id: Tab; label: string; test?: string }[] = narrow
    ? [{ id: "layers", label: "Sections" }, { id: "settings", label: "Settings" }, { id: "theme", label: kind === "home" ? "Style" : "Page", test: "tab-theme" }, { id: "history", label: "History", test: "tab-history" }]
    : [{ id: "settings", label: "Settings" }, { id: "theme", label: kind === "home" ? "Template and style" : "Page", test: "tab-theme" }, { id: "history", label: "History", test: "tab-history" }];
  const active: Tab = narrow ? tab : tab === "layers" ? "settings" : tab;

  const filteredSections = treeSearch.trim()
    ? page.sections.filter((s) => {
        const def = sectionDef(s.type);
        const q = treeSearch.toLowerCase().trim();
        return (
          s.label?.toLowerCase().includes(q) ||
          def?.label.toLowerCase().includes(q) ||
          s.type.toLowerCase().includes(q) ||
          s.style?.anchorId?.toLowerCase().includes(q)
        );
      })
    : page.sections;

  const layers = (
    <div className="bld-layers" data-testid="layers">
      {props.sectionsLocked && <div className="notice" role="note" data-testid="sections-locked">Your plan lets you change colours and style. {kind === "home" ? "To rearrange or edit sections, move up to the Pro plan." : "Editing this page is part of the Business plan."} <Link className="link" href="/billing">See plans</Link></div>}
      <ol className="bld-list" aria-label="Sections on this page">
        {filteredSections.map((s) => {
          const def = sectionDef(s.type);
          const origIdx = page.sections.findIndex((x) => x.id === s.id);
          return (
            <li
              key={s.id}
              className={`bld-row${s.id === selected ? " on" : ""}${s.disabled ? " off" : ""}${dragOver === origIdx && dragFrom !== null && dragFrom !== origIdx ? (dragFrom < origIdx ? " over-after" : " over-before") : ""}`}
              data-testid="section-row" data-type={s.type}
              draggable={!locked && !narrow}
              onDragStart={(e) => { setDragFrom(origIdx); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => {
                if (dragFrom !== null) {
                  e.preventDefault();
                  setDragOver(origIdx);
                } else if (
                  e.dataTransfer.types.includes("application/biztrack-block-type") ||
                  e.dataTransfer.types.includes("application/biztrack-pattern-id")
                ) {
                  e.preventDefault();
                  setDragOver(origIdx);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const patternId = e.dataTransfer.getData("application/biztrack-pattern-id");
                const blockType = e.dataTransfer.getData("application/biztrack-block-type");

                if (patternId) {
                  const pat = SECTION_PATTERNS.find((p) => p.id === patternId);
                  if (pat && !locked && !full(pat.sectionType)) {
                    const def = sectionDef(pat.sectionType);
                    if (def) {
                      const base = newSection(pat.sectionType);
                      const s: PageSection = {
                        id: base.id,
                        type: pat.sectionType,
                        label: pat.defaultLabel,
                        settings: normalizeSettings(def, pat.settings),
                        style: normalizeSectionStyle(pat.style),
                      };
                      edit((p) => {
                        const next = [...p.sections];
                        next.splice(origIdx, 0, s);
                        return { ...p, sections: next };
                      });
                      setSelected(s.id);
                      setRightCollapsed(false);
                      setTab("settings");
                      toast(`Added "${pat.title}" at #${origIdx + 1}`);
                    }
                  }
                } else if (blockType) {
                  const d = sectionDef(blockType);
                  if (d && !full(blockType) && !locked) {
                    const s = newSection(blockType);
                    edit((p) => {
                      const next = [...p.sections];
                      next.splice(origIdx, 0, s);
                      return { ...p, sections: next };
                    });
                    setSelected(s.id);
                    setRightCollapsed(false);
                    setTab("settings");
                    toast(`Added ${d.label} at #${origIdx + 1}`);
                  }
                } else if (dragFrom !== null) {
                  reorder(dragFrom, origIdx);
                }
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
            >
              {!locked && !narrow && <span className="bld-grip" aria-hidden><IGrip /></span>}
              <button type="button" className="bld-pick" onClick={() => choose(s.id)} aria-pressed={s.id === selected}>
                <span className="bld-glyph" aria-hidden>{sectionGlyph(s.type)}</span>
                <span style={{ display: "inline-flex", flexDirection: "column", minWidth: 0, flex: 1, gap: 1 }}>
                  <b style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label || def?.label || s.type}</b>
                  {s.label && <span style={{ fontSize: 10, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{def?.label}</span>}
                </span>
                <span className="pill grey" style={{ fontSize: 9, padding: "1px 4px", opacity: 0.8 }}>#{origIdx + 1}</span>
                {s.style?.anchorId && <span className="pill grey" style={{ fontSize: 9, padding: "1px 4px" }}>#{s.style.anchorId}</span>}
                {s.style?.animation && s.style.animation !== "none" && <span className="pill blue" style={{ fontSize: 9, padding: "1px 4px" }} title={`Entrance: ${s.style.animation}`}>✦ {s.style.animation}</span>}
                {s.style?.hideOn === "mobile" && <span className="pill blue" style={{ fontSize: 9, padding: "1px 4px" }} title="Visible on desktop only">Desktop</span>}
                {s.style?.hideOn === "desktop" && <span className="pill purple" style={{ fontSize: 9, padding: "1px 4px" }} title="Visible on mobile phones only">Mobile</span>}
                {s.disabled && <span className="pill grey" style={{ fontSize: 9, padding: "1px 4px" }}>Hidden</span>}
              </button>
              {!locked && (
                <span className="bld-acts" style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="bld-ib"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(s.id);
                    }}
                    disabled={isRequired(s.type)}
                    title={isRequired(s.type) ? "This page needs this section" : s.disabled ? "Show section" : "Hide section"}
                    aria-label={`${s.disabled ? "Show" : "Hide"} ${def?.label}`}
                  >
                    <IEye off={s.disabled} />
                  </button>
                  <button
                    type="button"
                    className="bld-ib"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenRowMenu(openRowMenu === s.id ? null : s.id);
                    }}
                    title="More actions (Move, Duplicate, Delete)"
                    aria-label={`More actions for ${s.label || def?.label}`}
                    aria-expanded={openRowMenu === s.id}
                  >
                    <IMore />
                  </button>
                  {openRowMenu === s.id && (
                    <div className="bld-row-menu" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="bld-row-menu-item"
                        disabled={origIdx === 0}
                        onClick={() => {
                          move(s.id, -1);
                          setOpenRowMenu(null);
                        }}
                      >
                        <IUp /> <span>Move up (Alt+↑)</span>
                      </button>
                      <button
                        type="button"
                        className="bld-row-menu-item"
                        disabled={origIdx === page.sections.length - 1}
                        onClick={() => {
                          move(s.id, 1);
                          setOpenRowMenu(null);
                        }}
                      >
                        <IDown /> <span>Move down (Alt+↓)</span>
                      </button>
                      <button
                        type="button"
                        className="bld-row-menu-item"
                        disabled={full(s.type)}
                        onClick={() => {
                          duplicate(s);
                          setOpenRowMenu(null);
                        }}
                      >
                        <ICopy /> <span>Duplicate (Ctrl+D)</span>
                      </button>
                      {!isRequired(s.type) && (
                        <button
                          type="button"
                          className="bld-row-menu-item danger"
                          onClick={() => {
                            remove(s.id);
                            setOpenRowMenu(null);
                          }}
                        >
                          <ITrash /> <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </span>
              )}
            </li>
          );
        })}
        {filteredSections.length === 0 && (
          <li className="muted" style={{ padding: 16, textAlign: "center", fontSize: 13 }}>
            {treeSearch.trim() ? `No sections match "${treeSearch}"` : "This page is empty. Add a section below."}
          </li>
        )}
      </ol>
      {!locked && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          style={{ boxSizing: "border-box", justifyContent: "center" }}
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.includes("application/biztrack-block-type") ||
              e.dataTransfer.types.includes("application/biztrack-pattern-id")
            ) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            const patternId = e.dataTransfer.getData("application/biztrack-pattern-id");
            const blockType = e.dataTransfer.getData("application/biztrack-block-type");
            if (patternId) {
              const pat = SECTION_PATTERNS.find((p) => p.id === patternId);
              if (pat) addPattern(pat);
            } else if (blockType) {
              add(blockType);
            }
          }}
          onClick={() => {
            setLeftTab("library");
            setLeftCollapsed(false);
          }}
          data-testid="add-section"
        >
          <IPlus /> Add section
        </button>
      )}
    </div>
  );

  const currentIndex = current ? page.sections.findIndex((s) => s.id === current.id) : -1;

  const settings = current && currentDef ? (
    <section aria-label={`Edit ${current.label || currentDef.label}`} className="bld-insp">
      {/* 1. Header Card with Glyph, Title, Pos & Top Actions */}
      <div className="bld-insp-header">
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div className="row" style={{ alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
            <span className="bld-glyph" style={{ fontSize: 20 }} aria-hidden>
              {sectionGlyph(current.type)}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="row" style={{ alignItems: "center", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {current.label || currentDef.label}
                </h2>
                <span className="pill grey" style={{ fontSize: 10, padding: "1px 5px" }}>#{currentIndex + 1}</span>
                {current.style?.anchorId && (
                  <span className="pill grey" style={{ fontSize: 10, padding: "1px 5px" }}>#{current.style.anchorId}</span>
                )}
              </div>
              {current.label && (
                <span className="muted" style={{ fontSize: 11, display: "block" }}>{currentDef.label}</span>
              )}
            </div>
          </div>
          <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
            {!locked && (
              <>
                <button
                  type="button"
                  className="bld-ib"
                  onClick={() => toggle(current.id)}
                  disabled={isRequired(current.type)}
                  aria-label={`${current.disabled ? "Show" : "Hide"} this section`}
                  title={current.disabled ? "Show section" : "Hide section"}
                >
                  <IEye off={current.disabled} />
                </button>
                <button
                  type="button"
                  className="bld-ib"
                  onClick={() => duplicate(current)}
                  disabled={full(current.type)}
                  aria-label="Duplicate this section"
                  title="Duplicate (Ctrl+D)"
                >
                  <ICopy />
                </button>
                {!isRequired(current.type) && (
                  <button
                    type="button"
                    className="bld-ib danger"
                    onClick={() => remove(current.id)}
                    aria-label="Delete this section"
                    title="Delete section (Del)"
                  >
                    <ITrash />
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              className="bld-ib"
              onClick={() => setSelected(null)}
              aria-label="Deselect section"
              title="Close section settings (Esc)"
              style={{ fontSize: 12, fontWeight: 700 }}
            >
              ✕
            </button>
          </span>
        </div>

        {/* Nickname, Quick Jump Position & Description */}
        <div className="row" style={{ gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <input
            type="text"
            className="input"
            style={{ flex: 1, minWidth: 130, height: 28, fontSize: 12, padding: "2px 8px" }}
            placeholder={`Rename (${currentDef.label})`}
            value={current.label ?? ""}
            disabled={locked}
            onChange={(e) => patchLabel(current.id, e.target.value)}
            title="Give this section a custom nickname in the navigator list"
          />
          {current.label && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ height: 28, padding: "0 6px", fontSize: 11 }}
              disabled={locked}
              onClick={() => patchLabel(current.id, undefined)}
              title="Reset nickname"
            >
              Reset
            </button>
          )}
          {!locked && page.sections.length > 1 && (
            <select
              className="select"
              style={{ maxWidth: 115, height: 28, fontSize: 11, padding: "2px 6px" }}
              value={currentIndex}
              onChange={(e) => moveTo(current.id, Number(e.target.value))}
              title="Quick jump to section position"
              aria-label="Move to position"
            >
              {page.sections.map((sec, idx) => (
                <option key={sec.id} value={idx}>
                  #{idx + 1} {sec.label || sectionDef(sec.type)?.label || sec.type}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>{currentDef.description}</p>
        {isRequired(current.type) && <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>You can move it and change its settings, but not hide or remove it.</p>}
      </div>

      {/* 2. Elementor-Style Sticky 3 Tabs */}
      <div className="bld-insp-tabs-sticky">
        <div className="bld-insp-tabs" role="tablist" aria-label="Section inspector tabs">
          <button
            type="button"
            role="tab"
            aria-selected={inspTab === "content"}
            className={`bld-insp-tab${inspTab === "content" ? " active" : ""}`}
            onClick={() => setInspTab("content")}
            data-testid="insp-tab-content"
          >
            <span>📝</span> Content
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={inspTab === "style"}
            className={`bld-insp-tab${inspTab === "style" ? " active" : ""}`}
            onClick={() => setInspTab("style")}
            data-testid="insp-tab-style"
          >
            <span>🎨</span> Style
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={inspTab === "advanced"}
            className={`bld-insp-tab${inspTab === "advanced" ? " active" : ""}`}
            onClick={() => setInspTab("advanced")}
            data-testid="insp-tab-advanced"
          >
            <span>⚙️</span> Advanced
          </button>
        </div>
      </div>

      {/* 3. Sub-form Panels */}
      {inspTab === "content" && (
        <SectionContentTab
          def={currentDef}
          section={current}
          disabled={locked}
          bnOpen={lang === "bn"}
          imgSignal={imgSignal}
          onChange={(p) => patch(current.id, p)}
        />
      )}

      {inspTab === "style" && (
        <SectionStyleTab
          def={currentDef}
          section={current}
          disabled={locked}
          imgSignal={imgSignal}
          onChangeSettings={(p) => patch(current.id, p)}
          onChangeStyle={(sp) => patchStyle(current.id, sp)}
        />
      )}

      {inspTab === "advanced" && (
        <SectionAdvancedTab
          section={current}
          disabled={locked}
          onChangeStyle={(sp) => patchStyle(current.id, sp)}
          onReplayAnim={() => post({ type: "bt-preview:replay-anim", id: current.id })}
        />
      )}
    </section>
  ) : (
    <div className="bld-empty">
      <span style={{ fontSize: 32, display: "block", marginBottom: 12 }}>🎯</span>
      <b>Pick a section</b>
      <p className="muted" style={{ maxWidth: 260, margin: "6px auto 0", fontSize: 13 }}>
        Click any section in the preview canvas or select one from the Layers list on the left to edit its content, style, and motion.
      </p>
    </div>
  );

  const themeTab = (
    <div className="stack" style={{ gap: 14 }}>
      {kind === "home" ? (
        <>
          {props.header}
          <ThemePanel theme={theme} onChange={editTheme} disabled={!canEdit} />
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
                <button key={d} type="button" aria-pressed={device === d} aria-label={name} title={name} onClick={() => { setDevice(d); setCustomWidth(null); }}>{icon}</button>
              ))}
            </div>
          )}
          <Segmented label="Preview language" value={lang} onChange={setLang} options={[{ value: "en", label: "EN" }, { value: "bn", label: "বাং" }]} />
          <button type="button" className="bld-ib" onClick={undo} disabled={!canUndo || !canEdit} aria-label="Undo" title="Undo (Ctrl+Z)"><IUndo /></button>
          <button type="button" className="bld-ib" onClick={redo} disabled={!canRedo || !canEdit} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><IRedo /></button>
          {!narrow && (
            <button
              type="button"
              className={`bld-ib${leftCollapsed && rightCollapsed ? " on" : ""}`}
              onClick={() => {
                const both = leftCollapsed && rightCollapsed;
                setLeftCollapsed(!both);
                setRightCollapsed(!both);
              }}
              title="Zen Focus Mode (Ctrl+\)"
              aria-label="Zen Focus Mode"
            >
              <IZen />
            </button>
          )}
          {!narrow && rightCollapsed && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRightCollapsed(false)}
              title="Expand Inspector panel"
            >
              Inspector ◀
            </button>
          )}
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

      <div
        className="bld-body"
        style={{
          "--bld-left-w": leftCollapsed ? "48px" : `${leftWidth}px`,
          "--bld-right-w": rightCollapsed ? "0px" : "360px",
        } as React.CSSProperties}
      >
        {!narrow && (
          <aside
            className="bld-left-dock"
            aria-label="Editor tools"
            style={{ width: leftCollapsed ? 48 : leftWidth }}
          >
            <nav className="bld-icon-rail" aria-label="Workspace tool selector">
              <button
                type="button"
                className={`bld-rail-btn${leftTab === "layers" && !leftCollapsed ? " active" : ""}`}
                onClick={() => handleRailClick("layers")}
                title={leftTab === "layers" && !leftCollapsed ? "Collapse Layers (Ctrl+1 or Ctrl+B)" : "Layers & Structure (Ctrl+1)"}
                aria-label="Layers & Structure"
              >
                <ILayers />
              </button>
              <button
                type="button"
                className={`bld-rail-btn${leftTab === "library" && !leftCollapsed ? " active" : ""}`}
                onClick={() => handleRailClick("library")}
                title={leftTab === "library" && !leftCollapsed ? "Collapse Library (Ctrl+2 or Ctrl+B)" : "Add Blocks & Patterns (Ctrl+2)"}
                aria-label="Add Blocks & Patterns"
              >
                <IBlocks />
              </button>
              <button
                type="button"
                className={`bld-rail-btn${leftTab === "theme" && !leftCollapsed ? " active" : ""}`}
                onClick={() => handleRailClick("theme")}
                title={leftTab === "theme" && !leftCollapsed ? "Collapse Theme (Ctrl+3 or Ctrl+B)" : "Global Theme & Styles (Ctrl+3)"}
                aria-label="Global Theme & Styles"
              >
                <IPalette />
              </button>
              <button
                type="button"
                className={`bld-rail-btn${leftTab === "history" && !leftCollapsed ? " active" : ""}`}
                onClick={() => handleRailClick("history")}
                title={leftTab === "history" && !leftCollapsed ? "Collapse History (Ctrl+4 or Ctrl+B)" : "Version History & Drafts (Ctrl+4)"}
                aria-label="Version History & Drafts"
              >
                <IHistory />
              </button>

              <div className="bld-rail-bottom">
                <button
                  type="button"
                  className="bld-rail-btn"
                  onClick={() => setLeftCollapsed(!leftCollapsed)}
                  title={leftCollapsed ? "Expand left sidebar (Ctrl+B)" : "Collapse left sidebar (Ctrl+B)"}
                  aria-label={leftCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {leftCollapsed ? <IExpandRight /> : <ICollapseLeft />}
                </button>
              </div>
            </nav>

            {!leftCollapsed && (
              <div className="bld-dock-panel">
                {leftTab === "layers" && (
                  <>
                    <div className="bld-dock-head">
                      <span className="bld-dock-title">
                        <ILayers />
                        <span>Structure / Layers</span>
                      </span>
                      <div className="row" style={{ gap: 6, alignItems: "center" }}>
                        <span className="bld-dock-badge" title="Sections count">
                          {page.sections.length}/30
                        </span>
                        <button
                          type="button"
                          className="bld-dock-collapse-btn"
                          onClick={() => setLeftCollapsed(true)}
                          title="Collapse left sidebar (Ctrl+B)"
                          aria-label="Collapse sidebar"
                        >
                          <ICollapseLeft />
                        </button>
                      </div>
                    </div>
                    <div className="bld-tree-search">
                      <input
                        type="search"
                        className="bld-tree-input"
                        placeholder="Filter sections..."
                        value={treeSearch}
                        onChange={(e) => setTreeSearch(e.target.value)}
                        aria-label="Filter sections in tree"
                      />
                    </div>
                    <div className="bld-panel-body" style={{ flex: 1, padding: "10px 12px" }}>
                      {layers}
                    </div>
                  </>
                )}

                {leftTab === "library" && (
                  <>
                    <div className="bld-dock-head">
                      <span className="bld-dock-title">
                        <IBlocks />
                        <span>Block Library</span>
                      </span>
                      <div className="row" style={{ gap: 6, alignItems: "center" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: "2px 8px" }}
                          onClick={() => setLibrary(true)}
                          title="Open expanded gallery modal"
                        >
                          Gallery ↗
                        </button>
                        <button
                          type="button"
                          className="bld-dock-collapse-btn"
                          onClick={() => setLeftCollapsed(true)}
                          title="Collapse left sidebar (Ctrl+B)"
                          aria-label="Collapse sidebar"
                        >
                          <ICollapseLeft />
                        </button>
                      </div>
                    </div>
                    <div className="bld-panel-body" style={{ flex: 1, padding: "12px" }}>
                      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${libraryTab === "components" ? "btn-primary" : "btn-secondary"}`}
                          style={{ flex: 1, fontSize: 11 }}
                          onClick={() => setLibraryTab("components")}
                        >
                          Blocks ({defs.length})
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${libraryTab === "patterns" ? "btn-primary" : "btn-secondary"}`}
                          style={{ flex: 1, fontSize: 11 }}
                          onClick={() => setLibraryTab("patterns")}
                        >
                          Patterns ({SECTION_PATTERNS.length})
                        </button>
                      </div>

                      {libraryTab === "components" ? (
                        <div className="bld-lib" style={{ gap: 8 }}>
                          {defs.map((d) => (
                            <button
                              key={d.type}
                              type="button"
                              className="bld-card"
                              style={{ padding: "8px 10px", minHeight: "auto", cursor: locked || full(d.type) ? "not-allowed" : "grab" }}
                              disabled={locked || full(d.type)}
                              draggable={!locked && !full(d.type)}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("application/biztrack-block-type", d.type);
                                e.dataTransfer.effectAllowed = "copy";
                              }}
                              onClick={() => add(d.type)}
                              title={`${d.description} • Click to add or drag to Layers`}
                            >
                              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                                <span className="bld-glyph">{sectionGlyph(d.type)}</span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <b style={{ fontSize: 13, display: "block" }}>{d.label}</b>
                                  <span style={{ fontSize: 11, display: "block", color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.description}</span>
                                </div>
                                <span style={{ color: "var(--brand)", fontWeight: 700, fontSize: 12 }}>+</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="bld-lib" style={{ gap: 8 }}>
                          {SECTION_PATTERNS.map((pat) => (
                            <button
                              key={pat.id}
                              type="button"
                              className="bld-card"
                              style={{ padding: "8px 10px", minHeight: "auto", cursor: locked || full(pat.sectionType) ? "not-allowed" : "grab" }}
                              disabled={locked || full(pat.sectionType)}
                              draggable={!locked && !full(pat.sectionType)}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("application/biztrack-pattern-id", pat.id);
                                e.dataTransfer.setData("application/biztrack-block-type", pat.sectionType);
                                e.dataTransfer.effectAllowed = "copy";
                              }}
                              onClick={() => addPattern(pat)}
                              title={`${pat.description} • Click to add or drag to Layers`}
                            >
                              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                                <span className="bld-glyph">⭐</span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <b style={{ fontSize: 13, display: "block" }}>{pat.title}</b>
                                  <span style={{ fontSize: 11, display: "block", color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pat.description}</span>
                                </div>
                                <span style={{ color: "var(--brand)", fontWeight: 700, fontSize: 12 }}>+</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {leftTab === "theme" && (
                  <>
                    <div className="bld-dock-head">
                      <span className="bld-dock-title">
                        <IPalette />
                        <span>Theme & Styles</span>
                      </span>
                      <button
                        type="button"
                        className="bld-dock-collapse-btn"
                        onClick={() => setLeftCollapsed(true)}
                        title="Collapse left sidebar (Ctrl+B)"
                        aria-label="Collapse sidebar"
                      >
                        <ICollapseLeft />
                      </button>
                    </div>
                    <div className="bld-panel-body" style={{ flex: 1, padding: "12px" }}>
                      {themeTab}
                    </div>
                  </>
                )}

                {leftTab === "history" && (
                  <>
                    <div className="bld-dock-head">
                      <span className="bld-dock-title">
                        <IHistory />
                        <span>Version History</span>
                      </span>
                      <button
                        type="button"
                        className="bld-dock-collapse-btn"
                        onClick={() => setLeftCollapsed(true)}
                        title="Collapse left sidebar (Ctrl+B)"
                        aria-label="Collapse sidebar"
                      >
                        <ICollapseLeft />
                      </button>
                    </div>
                    <div className="bld-panel-body" style={{ flex: 1, padding: "12px" }}>
                      {history}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Left Sidebar Splitter & Floating Retract Pill */}
            <div
              className={`bld-sidebar-splitter${resizingLeftDock ? " active" : ""}${leftCollapsed ? " collapsed" : ""}`}
              onPointerDown={!leftCollapsed ? onLeftResizeStart : undefined}
              onPointerMove={!leftCollapsed ? onLeftResizeMove : undefined}
              onPointerUp={!leftCollapsed ? onLeftResizeEnd : undefined}
              onPointerCancel={!leftCollapsed ? onLeftResizeEnd : undefined}
              onDoubleClick={() => setLeftWidth(340)}
              title={leftCollapsed ? "Click to expand sidebar (Ctrl+B)" : "Drag to resize sidebar • Double-click to reset (Ctrl+B)"}
            >
              <div className="bld-splitter-line" />
              <button
                type="button"
                className={`bld-sidebar-toggle-pill${leftCollapsed ? " collapsed" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setLeftCollapsed(!leftCollapsed);
                }}
                title={leftCollapsed ? "Expand left sidebar (Ctrl+B)" : "Collapse left sidebar (Ctrl+B)"}
                aria-label={leftCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {leftCollapsed ? <IExpandRight /> : <ICollapseLeft />}
              </button>
            </div>
          </aside>
        )}

        <main className="bld-stage" ref={stage} data-backdrop={canvasBackdrop}>
          <div
            className="bld-device-wrapper"
            style={{
              width: activeW ? `${activeW}px` : "100%",
              maxWidth: activeW ? `${activeW}px` : "100%",
              transition: resizing ? "none" : "width 0.15s ease",
            }}
          >
            {/* Left resizer handle */}
            {!narrow && (
              <div
                className={`bld-resizer bld-resizer-left${resizing === "left" ? " active" : ""}`}
                onPointerDown={(e) => onResizeStart(e, "left")}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeEnd}
                onPointerCancel={onResizeEnd}
                onDoubleClick={() => setCustomWidth(null)}
                title="Drag to resize viewport • Double click to reset"
                aria-label="Resize viewport left"
              >
                <div className="bld-resizer-bar" />
              </div>
            )}

            <div
              className="bld-device"
              style={{
                width: "100%",
                height: scale === 1 ? "100%" : `${100 / scale}%`,
                transform: scale !== 1 ? `scale(${scale})` : undefined,
              }}
            >
              <iframe
                ref={frame}
                src={props.previewUrl}
                title="Preview of your store"
                data-testid="preview-frame"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>

            {/* Right resizer handle */}
            {!narrow && (
              <div
                className={`bld-resizer bld-resizer-right${resizing === "right" ? " active" : ""}`}
                onPointerDown={(e) => onResizeStart(e, "right")}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeEnd}
                onPointerCancel={onResizeEnd}
                onDoubleClick={() => setCustomWidth(null)}
                title="Drag to resize viewport • Double click to reset"
                aria-label="Resize viewport right"
              >
                <div className="bld-resizer-bar" />
              </div>
            )}
          </div>

          {/* Bottom Floating Canvas Stage Dock */}
          {!narrow && (
            <div className="bld-stage-dock" data-testid="stage-dock">
              {/* Zoom Out */}
              <button
                type="button"
                onClick={() => setZoomMode((curr) => {
                  const val = curr === "fit" ? scale : curr;
                  return Math.max(0.4, Math.round((val - 0.15) * 100) / 100);
                })}
                title="Zoom out (Ctrl -)"
                aria-label="Zoom out"
              >
                −
              </button>

              {/* Zoom percentage badge */}
              <button
                type="button"
                onClick={() => setZoomMode(zoomMode === 1 ? "fit" : 1)}
                title="Click to toggle 100% / Fit (Ctrl 0)"
                aria-label="Zoom level"
              >
                {Math.round(scale * 100)}%
              </button>

              {/* Zoom In */}
              <button
                type="button"
                onClick={() => setZoomMode((curr) => {
                  const val = curr === "fit" ? scale : curr;
                  return Math.min(2.0, Math.round((val + 0.15) * 100) / 100);
                })}
                title="Zoom in (Ctrl +)"
                aria-label="Zoom in"
              >
                +
              </button>

              {/* Fit Button */}
              <button
                type="button"
                className={zoomMode === "fit" ? "active" : ""}
                onClick={() => setZoomMode("fit")}
                title="Fit to window (Ctrl 0)"
              >
                Fit
              </button>

              <div className="bld-dock-sep" />

              {/* Viewport Dimension Readout */}
              <div className="bld-dim-badge" title="Active viewport dimensions">
                {activeW ? `${activeW}px` : "100% Fluid"}
                {activeW === 390 ? " • Mobile" : activeW === 768 ? " • Tablet" : activeW === 1024 ? " • Laptop" : activeW && activeW >= 1200 ? " • Desktop" : ""}
              </div>

              <div className="bld-dock-sep" />

              {/* Backdrop framing toggle */}
              <button
                type="button"
                className={canvasBackdrop === "neutral" ? "active" : ""}
                onClick={() => setCanvasBackdrop("neutral")}
                title="Studio Dark backdrop"
                aria-label="Dark backdrop"
              >
                ⬛
              </button>
              <button
                type="button"
                className={canvasBackdrop === "light" ? "active" : ""}
                onClick={() => setCanvasBackdrop("light")}
                title="Studio Light backdrop"
                aria-label="Light backdrop"
              >
                ⬜
              </button>
              <button
                type="button"
                className={canvasBackdrop === "checker" ? "active" : ""}
                onClick={() => setCanvasBackdrop("checker")}
                title="Transparency Checkerboard grid"
                aria-label="Checkerboard backdrop"
              >
                🏁
              </button>

              <div className="bld-dock-sep" />

              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                title="Keyboard Shortcuts (?)"
                aria-label="Keyboard Shortcuts"
              >
                ⌨ Shortcuts
              </button>
            </div>
          )}
        </main>

        <aside className={`bld-right${rightCollapsed ? " collapsed" : ""}`} aria-label={narrow ? "Editor panel" : "Settings"}>
          {visual && narrow && <button type="button" className="bld-handle" onClick={() => setSheet((v) => !v)} aria-expanded={sheet} data-testid="sheet-handle"><span aria-hidden /><b>{sheet ? "Show the page" : current && currentDef ? `Edit: ${currentDef.label}` : "Sections and settings"}</b></button>}
          <div className="bld-tabs" role="tablist" aria-label="Editor" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 2 }}>
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => setTab(t.id)} data-testid={t.test ?? `tab-${t.id}`}>{t.label}</button>
              ))}
            </div>
            {!narrow && (
              <button
                type="button"
                className="bld-ib"
                onClick={() => setRightCollapsed(true)}
                title="Collapse Inspector"
                aria-label="Collapse Inspector"
                style={{ width: 28, height: 28, marginRight: 4 }}
              >
                <IExpandRight />
              </button>
            )}
          </div>
          {narrow && active === "layers" ? <div className="bld-panel-body">{layers}</div> : inspector}
        </aside>
      </div>

      <Drawer
        open={library}
        onClose={() => {
          setLibrary(false);
          setAddAt(null);
          setLibrarySearch("");
          setLibraryCategory("all");
          setPatternCategory("all");
        }}
        title="Add a section"
      >
        {/* Top Dual-Tab Switcher */}
        <div
          className="bld-tabs"
          role="tablist"
          aria-label="Section or Pattern"
          style={{ marginBottom: 14 }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={libraryTab === "components"}
            onClick={() => setLibraryTab("components")}
            data-testid="tab-lib-components"
          >
            Components ({defs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={libraryTab === "patterns"}
            onClick={() => setLibraryTab("patterns")}
            data-testid="tab-lib-patterns"
          >
            ⭐ Design Patterns ({SECTION_PATTERNS.length})
          </button>
        </div>

        {/* Universal Search Box */}
        <div className="bld-search-box">
          <span className="bld-search-icon" aria-hidden>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            className="input"
            style={{ paddingLeft: 34, paddingRight: librarySearch ? 32 : 12 }}
            placeholder={
              libraryTab === "components"
                ? "Search sections (e.g. countdown, FAQ, video)..."
                : "Search patterns (e.g. Dark Hero, Bento, Reviews, Eid)..."
            }
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            aria-label="Search sections or patterns"
          />
          {librarySearch && (
            <button
              type="button"
              className="bld-search-clear"
              onClick={() => setLibrarySearch("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {libraryTab === "patterns" ? (
          <div>
            {/* Pattern Category Pills */}
            <div className="bld-cat-pills" role="tablist" aria-label="Pattern categories">
              {PATTERN_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={patternCategory === cat.id}
                  className={`bld-cat-pill${patternCategory === cat.id ? " on" : ""}`}
                  onClick={() => setPatternCategory(cat.id)}
                  data-testid={`pat-cat-${cat.id}`}
                >
                  {cat.icon ? <span>{cat.icon}</span> : null}
                  <span>{cat.title}</span>
                </button>
              ))}
            </div>

            {/* Pattern Cards Grid */}
            {(() => {
              const q = librarySearch.trim().toLowerCase();
              const matchesPatternSearch = (p: SectionPattern) =>
                !q ||
                p.title.toLowerCase().includes(q) ||
                p.titleBn.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q) ||
                p.descriptionBn.toLowerCase().includes(q) ||
                (p.badge && p.badge.toLowerCase().includes(q)) ||
                p.sectionType.toLowerCase().includes(q);

              const filteredPatterns = SECTION_PATTERNS.filter((p) => {
                if (patternCategory !== "all" && p.category !== patternCategory) {
                  return false;
                }
                return matchesPatternSearch(p);
              });

              if (filteredPatterns.length === 0) {
                return (
                  <div className="bld-empty" style={{ padding: "28px 12px" }}>
                    <b>No design patterns found</b>
                    <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                      Try selecting "All Patterns" or a different search keyword.
                    </p>
                  </div>
                );
              }

              return (
                <div
                  className="bld-patterns-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 12,
                    marginTop: 10,
                  }}
                >
                  {filteredPatterns.map((p) => {
                    const d = sectionDef(p.sectionType);
                    const isMax = full(p.sectionType);
                    const currCount = count(p.sectionType);
                    const maxLimit = d?.max;
                    return (
                      <PatternCard
                        key={p.id}
                        pattern={p}
                        def={d}
                        disabled={isMax}
                        disabledReason={isMax ? `Limit reached (${currCount}/${maxLimit} on page)` : undefined}
                        onInsert={addPattern}
                      />
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : (
          <div>
            {kind !== "landing" && (() => {
              let cats = [...STORE_SECTION_CATEGORIES];
              if (props.siteMode === "PORTFOLIO") {
                cats = cats.filter((c) => c.id !== "products");
                const bIdx = cats.findIndex((c) => c.id === "business");
                if (bIdx > 1) {
                  const [b] = cats.splice(bIdx, 1);
                  cats.splice(1, 0, b!);
                }
              }
              return (
                <div className="bld-cat-pills" role="tablist" aria-label="Section categories">
                  {cats.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      role="tab"
                      aria-selected={libraryCategory === cat.id}
                      className={`bld-cat-pill${libraryCategory === cat.id ? " on" : ""}`}
                      onClick={() => setLibraryCategory(cat.id)}
                    >
                      {cat.icon ? <span>{cat.icon}</span> : null}
                      <span>{cat.title}</span>
                    </button>
                  ))}
                </div>
              );
            })()}

            {(() => {
              const card = (d: (typeof defs)[number]) => {
                const isRecommended = Boolean(props.businessVertical && d.verticals?.includes(props.businessVertical));
                return (
                  <button key={d.type} type="button" className="bld-card bld-card-pic" disabled={full(d.type)} onClick={() => add(d.type)} data-testid={`lib-${d.type}`}>
                    <SectionThumb type={d.type} />
                    <span className="bld-card-txt">
                      <span className="row" style={{ gap: 6, alignItems: "center", justifyContent: "space-between" }}>
                        <b>{d.label}</b>
                        {isRecommended && <span className="pill ok" style={{ fontSize: 10, padding: "1px 5px", lineHeight: "14px" }}>Recommended</span>}
                      </span>
                      <span>{d.description}</span>
                      {d.max && count(d.type) >= d.max && <em>Already on the page</em>}
                    </span>
                  </button>
                );
              };

              const q = librarySearch.trim().toLowerCase();
              const matchesSearch = (d: (typeof defs)[number]) => !q || d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.type.toLowerCase().includes(q);

              if (kind !== "landing") {
                const activeCategory = STORE_SECTION_CATEGORIES.find((c) => c.id === libraryCategory);
                const filteredDefs = defs.filter((d) => {
                  if (libraryCategory !== "all" && activeCategory && !activeCategory.types.includes(d.type)) {
                    return false;
                  }
                  return matchesSearch(d);
                });

                if (filteredDefs.length === 0) {
                  return (
                    <div className="bld-empty" style={{ padding: "28px 12px" }}>
                      <b>No sections found</b>
                      <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Try a different category or search keyword.</p>
                    </div>
                  );
                }

                return <div className="bld-lib">{filteredDefs.map(card)}</div>;
              }

              const activeLandingGroups = LANDING_GROUPS.map((g) => {
                const groupDefs = g.types
                  .map((t) => defs.find((d) => d.type === t))
                  .filter((d): d is NonNullable<typeof d> => Boolean(d))
                  .filter(matchesSearch);
                return { title: g.title, defs: groupDefs };
              }).filter((g) => g.defs.length > 0);

              if (activeLandingGroups.length === 0) {
                return (
                  <div className="bld-empty" style={{ padding: "28px 12px" }}>
                    <b>No sections found</b>
                    <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Try a different search keyword.</p>
                  </div>
                );
              }

              return (
                <div className="stack" style={{ gap: 14 }}>
                  {activeLandingGroups.map((g) => (
                    <section key={g.title} aria-label={g.title}>
                      <div className="bld-gh" style={{ marginBottom: 6 }}>{g.title}</div>
                      <div className="bld-lib">{g.defs.map(card)}</div>
                    </section>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </Drawer>

      {showShortcuts && (
        <div
          className="bld-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowShortcuts(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard Shortcuts"
        >
          <div className="bld-shortcuts-card">
            <div className="bld-shortcuts-head">
              <h3>⌨ Keyboard Shortcuts</h3>
              <button
                type="button"
                className="bld-ib"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts modal"
              >
                ✕
              </button>
            </div>
            <div className="bld-shortcuts-grid">
              <div className="bld-shortcut-row">
                <span className="bld-shortcut-label">Undo action</span>
                <span className="bld-key-badges"><span className="bld-kbd">Ctrl</span><span className="bld-kbd">Z</span></span>
              </div>
              <div className="bld-shortcut-row">
                <span className="bld-shortcut-label">Redo action</span>
                <span className="bld-key-badges"><span className="bld-kbd">Ctrl</span><span className="bld-kbd">Shift</span><span className="bld-kbd">Z</span></span>
              </div>
              <div className="bld-shortcut-row">
                <span className="bld-shortcut-label">Duplicate section</span>
                <span className="bld-key-badges"><span className="bld-kbd">Ctrl</span><span className="bld-kbd">D</span></span>
              </div>
              <div className="bld-shortcut-row">
                <span className="bld-shortcut-label">Save draft</span>
                <span className="bld-key-badges"><span className="bld-kbd">Ctrl</span><span className="bld-kbd">S</span></span>
              </div>
              <div className="bld-shortcut-row">
                <span className="bld-shortcut-label">Move section up</span>
                <span className="bld-key-badges"><span className="bld-kbd">Alt</span><span className="bld-kbd">↑</span></span>
              </div>
              <div className="bld-shortcut-row">
                <span className="bld-shortcut-label">Move section down</span>
                <span className="bld-key-badges"><span className="bld-kbd">Alt</span><span className="bld-kbd">↓</span></span>
              </div>
              <div className="bld-shortcut-row">
                <span className="bld-shortcut-label">Delete section</span>
                <span className="bld-key-badges"><span className="bld-kbd">Delete</span></span>
              </div>
              <div className="bld-shortcut-row">
                <span className="bld-shortcut-label">Toggle shortcuts</span>
                <span className="bld-key-badges"><span className="bld-kbd">?</span></span>
              </div>
              <div className="bld-shortcut-row">
                <span className="bld-shortcut-label">Zoom In / Out</span>
                <span className="bld-key-badges"><span className="bld-kbd">Ctrl</span><span className="bld-kbd">+</span> / <span className="bld-kbd">-</span></span>
              </div>
              <div className="bld-shortcut-row">
                <span className="bld-shortcut-label">Reset Zoom (Fit)</span>
                <span className="bld-key-badges"><span className="bld-kbd">Ctrl</span><span className="bld-kbd">0</span></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
