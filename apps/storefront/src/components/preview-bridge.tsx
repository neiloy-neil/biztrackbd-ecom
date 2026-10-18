"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PageData, PageJson } from "@biztrackbd/core";
import { themeCss, validatePage, validateTheme, type PageKind, type ThemeSettings } from "@biztrackbd/core/builder-client";
import { makeT, type Lang } from "@/lib/i18n-core";
import type { PageCtx } from "@/lib/page-ctx";
import { EditOverlay } from "./edit-overlay";
import { Sections, type LandingInfo, type SectionExtras, type SiteInfo } from "./sections";

/**
 * The editor sits in the admin and shows the store in an iframe. Each change in the editor is posted here as a message
 * and the page redraws at once, with no save and no reload. Messages are accepted only from the window that framed us
 * (and, when configured, only from the admin's address), and everything is checked again here before it is drawn.
 */

export const PREVIEW_MESSAGE = "bt-preview:update";
export const PREVIEW_READY = "bt-preview:ready";

export function PreviewBridge({ kind, initialPage, initialTheme, data, lang: initialLang, orderForm, adminOrigin, ctx, landing, site, extras }: { landing?: LandingInfo; site?: SiteInfo; extras?: SectionExtras; kind: PageKind; initialPage: PageJson; initialTheme: ThemeSettings; data: PageData; lang: Lang; orderForm?: React.ReactNode; adminOrigin?: string; /** The page's own data, for product, collection and cart pages. */ ctx?: PageCtx }) {
  const router = useRouter();
  const [page, setPage] = useState(initialPage);
  const [theme, setTheme] = useState(initialTheme);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(initialLang);
  // Every page can be edited on the page itself (docs/46 stage 4, docs/47 part A). A plan that only allows colours (or a viewer) gets the plain preview.
  const [locked, setLocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const typing = useRef(false);
  const pending = useRef<unknown>(undefined);
  const editing = !locked;
  const send = useCallback((msg: Record<string, unknown>) => window.parent.postMessage(msg, adminOrigin || "*"), [adminOrigin]);
  const onTyping = useCallback((on: boolean) => {
    typing.current = on;
    // Redraws that arrived while a word was being typed would move the cursor, so the newest one waits until the typing stops.
    if (!on && pending.current !== undefined) {
      try { setPage(validatePage(kind, pending.current)); } catch { /* the next message corrects it */ }
      pending.current = undefined;
    }
  }, [kind]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== window.parent) return;
      if (adminOrigin && e.origin !== adminOrigin) return;
      const m = e.data as { type?: string; page?: unknown; theme?: unknown; lang?: unknown } | null;
      if (!m || typeof m !== "object") return;
      if (m.type === "bt-preview:refresh") {
        router.refresh();
        return;
      }
      if (m.type !== PREVIEW_MESSAGE) return;
      if (m.lang === "en" || m.lang === "bn") setLang(m.lang);
      if (typeof (m as { locked?: unknown }).locked === "boolean") setLocked((m as { locked: boolean }).locked);
      try {
        if (m.page !== undefined) {
          if (typing.current) pending.current = m.page;
          else setPage(validatePage(kind, m.page));
        }
        if (m.theme !== undefined) setTheme(validateTheme(m.theme));
        setError(null);
      } catch (err) {
        // An incomplete edit (a half-typed address, say) keeps the last good picture and says why.
        setError(err instanceof Error ? err.message : "This change cannot be shown yet");
      }
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: PREVIEW_READY }, adminOrigin || "*");
    return () => window.removeEventListener("message", onMessage);
  }, [kind, adminOrigin, router]);

  // Scroll the section being edited into view when the editor asks for it.
  useEffect(() => {
    function onFocus(e: MessageEvent) {
      if (e.source !== window.parent || (adminOrigin && e.origin !== adminOrigin)) return;
      const m = e.data as { type?: string; id?: string } | null;
      if (m?.type !== "bt-preview:focus" || typeof m.id !== "string") return;
      const el = document.querySelector(`[data-section-wrap="${CSS.escape(m.id)}"]`) || document.querySelector(`[data-section="${CSS.escape(m.id)}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    window.addEventListener("message", onFocus);
    return () => window.removeEventListener("message", onFocus);
  }, [adminOrigin]);

  // Click a section in the preview to edit it: the editor is told which one, and links inside the preview do not navigate away.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as Element | null;
      const section = target?.closest("[data-section-wrap]") || target?.closest("[data-section]");
      if (!section) return;
      e.preventDefault();
      e.stopPropagation();
      const id = section.getAttribute("data-section-wrap") || section.getAttribute("data-section");
      if (id) window.parent.postMessage({ type: "bt-preview:select", id }, adminOrigin || "*");
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [adminOrigin]);

  // Outline the section being edited.
  useEffect(() => {
    function onFocus(e: MessageEvent) {
      if (e.source !== window.parent || (adminOrigin && e.origin !== adminOrigin)) return;
      const m = e.data as { type?: string; id?: string } | null;
      if (m?.type !== "bt-preview:focus" || typeof m.id !== "string") return;
      document.querySelectorAll(".bt-selected").forEach((el) => el.classList.remove("bt-selected"));
      const el = document.querySelector(`[data-section-wrap="${CSS.escape(m.id)}"]`) || document.querySelector(`[data-section="${CSS.escape(m.id)}"]`);
      el?.classList.add("bt-selected");
      setSelectedId(m.id);
    }
    window.addEventListener("message", onFocus);
    return () => window.removeEventListener("message", onFocus);
  }, [adminOrigin]);

  // Written on the body, as the live store does, so the colours, fonts and style choices win over a template's own look in the preview too.
  const css = themeCss(theme, "body");
  return (
    <div data-testid="preview-root" data-preview-sections={page.sections.length}>
      <style id="bt-preview-select">{`[data-section-wrap]{cursor:pointer}[data-section-wrap]:hover{outline:2px dashed rgba(91,79,232,.55);outline-offset:-2px}[data-section-wrap].bt-selected{outline:3px solid #5B4FE8;outline-offset:-3px}[data-section-wrap] [data-section]:hover{outline:none}[data-section-wrap] [data-section].bt-selected{outline:none}[data-section]{cursor:pointer}[data-section]:hover{outline:2px dashed rgba(91,79,232,.55);outline-offset:-2px}[data-section].bt-selected{outline:3px solid #5B4FE8;outline-offset:-3px}`}</style>
      {css && <style id="bt-preview-theme" dangerouslySetInnerHTML={{ __html: css }} />}
      {error && <div role="status" style={{ position: "sticky", top: 0, zIndex: 50, background: "#FEF3E2", color: "#92400E", padding: "8px 16px", fontSize: 13, fontWeight: 600 }}>{error}</div>}
      <Sections page={page} data={data} lang={lang} t={makeT(lang)} orderForm={orderForm} ctx={ctx} landing={landing} editing={editing} site={site} extras={extras} />
      {editing && <EditOverlay page={page} selectedId={selectedId} send={send} onTyping={onTyping} />}
    </div>
  );
}
