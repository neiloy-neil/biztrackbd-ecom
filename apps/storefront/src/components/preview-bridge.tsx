"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PageData, PageJson } from "@biztrackbd/core";
import { themeCss, validatePage, validateTheme, type PageKind, type ThemeSettings } from "@biztrackbd/core/builder-client";
import { makeT, type Lang } from "@/lib/i18n-core";
import { Sections } from "./sections";

/**
 * The editor sits in the admin and shows the store in an iframe. Each change in the editor is posted here as a message
 * and the page redraws at once, with no save and no reload. Messages are accepted only from the window that framed us
 * (and, when configured, only from the admin's address), and everything is checked again here before it is drawn.
 */

export const PREVIEW_MESSAGE = "bt-preview:update";
export const PREVIEW_READY = "bt-preview:ready";

export function PreviewBridge({ kind, initialPage, initialTheme, data, lang: initialLang, orderForm, adminOrigin }: { kind: PageKind; initialPage: PageJson; initialTheme: ThemeSettings; data: PageData; lang: Lang; orderForm?: React.ReactNode; adminOrigin?: string }) {
  const router = useRouter();
  const [page, setPage] = useState(initialPage);
  const [theme, setTheme] = useState(initialTheme);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(initialLang);

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
      try {
        if (m.page !== undefined) setPage(validatePage(kind, m.page));
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
      document.querySelector(`[data-section="${CSS.escape(m.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    window.addEventListener("message", onFocus);
    return () => window.removeEventListener("message", onFocus);
  }, [adminOrigin]);

  const css = themeCss(theme);
  return (
    <div data-testid="preview-root" data-preview-sections={page.sections.length}>
      {css && <style id="bt-preview-theme" dangerouslySetInnerHTML={{ __html: css }} />}
      {error && <div role="status" style={{ position: "sticky", top: 0, zIndex: 50, background: "#FEF3E2", color: "#92400E", padding: "8px 16px", fontSize: 13, fontWeight: 600 }}>{error}</div>}
      <Sections page={page} data={data} lang={lang} t={makeT(lang)} orderForm={orderForm} />
    </div>
  );
}
