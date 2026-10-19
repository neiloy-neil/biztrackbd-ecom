"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sectionDef, sectionsFor, STORE_SECTION_CATEGORIES, type PageJson } from "@biztrackbd/core/builder-client";

/**
 * Editing a landing page on the page itself (docs/46, stage 4). It lives in the editor's preview only: the live store never loads it.
 * Text marked data-edit is typed into directly (plain text), pictures marked data-edit-image open the chooser, the selected section gets a
 * small toolbar, a grip drags it to a new place, and a plus between sections adds one there. Every change is a message to the editor,
 * which checks it against the section's own definition and keeps the draft, the undo history and the saving.
 */

type Send = (msg: Record<string, unknown>) => void;
type Rect = { id: string; top: number; height: number };

const EDIT_CSS = `
[data-section-wrap]{position:relative;cursor:pointer}
[data-section-wrap]:hover{outline:2px dashed rgba(91,79,232,.55);outline-offset:-2px}
[data-section-wrap].bt-selected{outline:3px solid #5B4FE8;outline-offset:-3px}
[data-section-wrap].bt-off{opacity:.38}
[data-section-wrap] [data-section]:hover{outline:none}
[data-section-wrap] [data-section].bt-selected{outline:none}
[data-section]{cursor:pointer}
[data-section]:hover{outline:2px dashed rgba(91,79,232,.55);outline-offset:-2px}
[data-section].bt-selected{outline:3px solid #5B4FE8;outline-offset:-3px}
[data-section].bt-off{opacity:.38}
[data-edit]{cursor:text;min-width:1ch}
[data-edit]:hover{background:rgba(91,79,232,.08);border-radius:3px}
[data-edit]:focus{outline:2px solid #5B4FE8;outline-offset:2px;background:rgba(91,79,232,.08);border-radius:3px}
[data-edit]:empty::before{content:"Type here";opacity:.5}
[data-edit-image]{cursor:pointer;position:relative}
[data-edit-image]:hover{outline:2px solid #5B4FE8;outline-offset:-2px}
[data-edit-image]::after{content:"📷 Replace Picture";position:absolute;right:10px;bottom:10px;padding:5px 12px;background:rgba(15,23,42,0.85);backdrop-filter:blur(8px);color:#fff;font:600 11px/1 system-ui,sans-serif;border-radius:999px;border:1px solid rgba(255,255,255,0.2);box-shadow:0 4px 12px rgba(0,0,0,0.25);pointer-events:none;opacity:0;transform:translateY(4px);transition:all .15s ease;z-index:40}
[data-edit-image]:hover::after{opacity:1;transform:translateY(0)}
[data-edit-image].bt-drag-over{outline:3px dashed #5B4FE8 !important;outline-offset:-3px;background-color:rgba(91,79,232,0.12) !important}
[data-edit-image].bt-drag-over::after{content:"📥 Drop image here";background:#5B4FE8;color:#fff;opacity:1;transform:translateY(0)}
.lp-pick-btn{margin-top:10px;padding:8px 14px;border-radius:99px;border:2px dashed #5B4FE8;background:rgba(255,255,255,.92);color:#5B4FE8;font:700 13px/1 system-ui;cursor:pointer}
.lp-pick{display:flex;align-items:center;justify-content:center;min-height:120px;border:2px dashed rgba(91,79,232,.55);border-radius:12px;color:#5B4FE8;font-weight:700;cursor:pointer}
.bt-ovl{position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:60}
.bt-bar{position:absolute;right:12px;display:flex;align-items:center;gap:3px;padding:4px 6px;background:rgba(255,255,255,0.96);backdrop-filter:blur(10px);border:1px solid #D1D5DB;border-radius:999px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.18),0 8px 10px -6px rgba(0,0,0,0.1);pointer-events:auto;z-index:70}
.bt-bar-badge{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:linear-gradient(135deg,#5B4FE8,#4338CA);color:#fff;font:600 12px/1.2 system-ui;white-space:nowrap;user-select:none;margin-right:2px}
.bt-bar-badge .bt-pos{opacity:0.85;font-size:10px;font-weight:500;padding-left:4px;border-left:1px solid rgba(255,255,255,0.3)}
.bt-bar button{all:unset;box-sizing:border-box;width:30px;height:30px;display:grid;place-items:center;border-radius:999px;cursor:pointer;color:#334155;font:600 14px/1 system-ui;transition:background 0.12s ease,color 0.12s ease}
.bt-bar button:hover:not(:disabled){background:#F1F5F9;color:#0F172A}
.bt-bar button:disabled{opacity:.3;cursor:not-allowed}
.bt-bar .bt-grip{cursor:grab;touch-action:none}
.bt-bar .bt-del:hover:not(:disabled){background:#FEE2E2;color:#DC2626}
.bt-bar .bt-settings:hover:not(:disabled){background:#EDE9FE;color:#5B4FE8}
.bt-gap{position:absolute;left:0;width:100%;height:32px;display:flex;align-items:center;justify-content:center;pointer-events:auto;opacity:0;transition:opacity .15s ease;z-index:55}
.bt-gap:hover,.bt-gap:focus-within{opacity:1}
.bt-gap::before{content:"";position:absolute;left:6%;right:6%;top:50%;height:2px;background:linear-gradient(90deg,transparent,#5B4FE8 20%,#5B4FE8 80%,transparent);transform:translateY(-50%)}
.bt-gap button{all:unset;position:relative;z-index:2;display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 12px;border-radius:999px;background:#5B4FE8;color:#fff;font:700 12px/1 system-ui;cursor:pointer;box-shadow:0 4px 12px rgba(91,79,232,.35),0 0 0 2px #fff;transition:transform .15s ease,background .15s ease}
.bt-gap button:hover{transform:scale(1.05);background:#473dc7}
@media (hover:none){.bt-gap{opacity:.75}}
.bt-drop{position:absolute;left:4%;width:92%;height:4px;background:#5B4FE8;border-radius:4px;box-shadow:0 0 0 3px rgba(91,79,232,.25);pointer-events:none}
/* Floating in-canvas Notion-style text toolbar */
.bt-text-toolbar{position:absolute;z-index:90;display:flex;align-items:center;gap:3px;padding:4px 6px;background:rgba(255,255,255,0.98);backdrop-filter:blur(12px);border:1px solid #CBD5E1;border-radius:10px;box-shadow:0 12px 28px -4px rgba(0,0,0,0.22),0 6px 12px -3px rgba(0,0,0,0.12);pointer-events:auto;animation:btToolbarPop 0.15s cubic-bezier(0.16,1,0.3,1)}
@keyframes btToolbarPop{0%{opacity:0;transform:scale(0.95) translateY(4px)}100%{opacity:1;transform:scale(1) translateY(0)}}
.bt-text-toolbar button{all:unset;box-sizing:border-box;min-width:28px;height:28px;padding:0 6px;display:flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;color:#334155;font:600 13px/1 system-ui;transition:background 0.12s ease,color 0.12s ease;user-select:none}
.bt-text-toolbar button:hover{background:#F1F5F9;color:#0F172A}
.bt-text-toolbar button.active{background:#EDE9FE;color:#5B4FE8;font-weight:700}
.bt-text-toolbar .bt-sep{width:1px;height:16px;background:#E2E8F0;margin:0 2px}
.bt-text-toolbar .bt-lang-btn{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:#F1F5F9;color:#475569;border:1px solid #E2E8F0}
.bt-text-toolbar .bt-lang-btn:hover{background:#EEF2FF;color:#4F46E5;border-color:#C7D2FE}
.bt-text-toolbar .bt-font-btn{font-size:12px;font-weight:600}
.bt-text-toolbar .bt-done-btn{background:#5B4FE8;color:#fff;border-radius:6px;padding:0 8px;font-weight:700}
.bt-text-toolbar .bt-done-btn:hover{background:#4338CA;color:#fff}
.bt-noto-bn{font-family:var(--font-notosansbn),sans-serif !important}
/* Visual section spacing drag bands */
.bt-space-band{position:absolute;left:0;width:100%;display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:65;user-select:none}
.bt-space-top{transform:translateY(-50%)}
.bt-space-bottom{transform:translateY(-50%)}
.bt-space-grip{height:24px;padding:0 12px;display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:rgba(255,255,255,0.96);backdrop-filter:blur(8px);border:1px solid #C7D2FE;color:#4F46E5;font:600 11px/1 system-ui;box-shadow:0 4px 12px rgba(79,70,229,0.18);cursor:ns-resize;transition:all 0.15s ease}
.bt-space-grip:hover,.bt-space-grip.dragging{background:#4F46E5;color:#fff;border-color:#4338CA;transform:scale(1.05);box-shadow:0 6px 16px rgba(79,70,229,0.35)}
.bt-space-badge{font-size:10px;font-weight:700;letter-spacing:0.02em}
/* In-Canvas Contextual Block Picker Popover */
.bt-gap-popover{position:absolute;left:50%;transform:translateX(-50%);width:min(92vw,480px);max-height:480px;background:rgba(255,255,255,0.98);backdrop-filter:blur(16px);border:1px solid #CBD5E1;border-radius:16px;box-shadow:0 20px 40px -8px rgba(15,23,42,0.28),0 8px 16px -4px rgba(15,23,42,0.12);display:flex;flex-direction:column;z-index:100;pointer-events:auto;overflow:hidden;animation:btPopIn .18s cubic-bezier(0.16,1,0.3,1)}
@keyframes btPopIn{0%{opacity:0;transform:translate(-50%,-6px) scale(0.96)}100%{opacity:1;transform:translate(-50%,0) scale(1)}}
.bt-pop-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;border-bottom:1px solid #F1F5F9}
.bt-pop-title{font:700 14px/1.2 system-ui,sans-serif;color:#0F172A;display:flex;align-items:center;gap:6px}
.bt-pop-close{all:unset;box-sizing:border-box;width:26px;height:26px;display:grid;place-items:center;border-radius:999px;color:#64748B;cursor:pointer;font:600 14px/1 system-ui;transition:all .12s ease}
.bt-pop-close:hover{background:#F1F5F9;color:#0F172A}
.bt-pop-search-wrap{padding:8px 16px}
.bt-pop-search{width:100%;box-sizing:border-box;height:36px;padding:0 12px;border-radius:8px;border:1px solid #E2E8F0;background:#F8FAFC;font:500 13px/1 system-ui,sans-serif;color:#0F172A;outline:none;transition:all .15s ease}
.bt-pop-search:focus{border-color:#5B4FE8;background:#fff;box-shadow:0 0 0 3px rgba(91,79,232,0.12)}
.bt-pop-cats{display:flex;gap:6px;padding:4px 16px 8px;overflow-x:auto;scrollbar-width:none}
.bt-pop-cats::-webkit-scrollbar{display:none}
.bt-pop-cat-btn{all:unset;box-sizing:border-box;padding:4px 10px;border-radius:999px;background:#F1F5F9;color:#475569;font:600 11px/1.2 system-ui,sans-serif;cursor:pointer;white-space:nowrap;transition:all .12s ease}
.bt-pop-cat-btn:hover{background:#E2E8F0;color:#0F172A}
.bt-pop-cat-btn.active{background:#5B4FE8;color:#fff}
.bt-pop-list{flex:1;overflow-y:auto;padding:8px 16px;display:flex;flex-direction:column;gap:8px;max-height:280px}
.bt-pop-card{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-radius:10px;border:1px solid #E2E8F0;background:#fff;cursor:pointer;transition:all .12s ease}
.bt-pop-card:hover{border-color:#5B4FE8;background:#F5F3FF;transform:translateY(-1px);box-shadow:0 4px 12px rgba(91,79,232,0.08)}
.bt-pop-card-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.bt-pop-card-title{font:600 13px/1.2 system-ui,sans-serif;color:#0F172A}
.bt-pop-card-desc{font:400 11px/1.3 system-ui,sans-serif;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px}
.bt-pop-card-add{font:700 11px/1 system-ui,sans-serif;color:#5B4FE8;padding:4px 10px;border-radius:6px;background:#EDE9FE;flex-shrink:0;transition:all .12s ease}
.bt-pop-card:hover .bt-pop-card-add{background:#5B4FE8;color:#fff}
.bt-pop-footer{padding:8px 16px;background:#F8FAFC;border-top:1px solid #F1F5F9;display:flex;justify-content:flex-end}
.bt-pop-sidebar-btn{all:unset;font:600 11px/1.2 system-ui,sans-serif;color:#5B4FE8;cursor:pointer;display:flex;align-items:center;gap:4px}
.bt-pop-sidebar-btn:hover{text-decoration:underline}
`;

const MAGNETIC_SPACINGS = [0, 16, 24, 32, 48, 64, 80, 96, 128];
function snapSpacing(val: number): number {
  for (const s of MAGNETIC_SPACINGS) {
    if (Math.abs(val - s) <= 6) return s;
  }
  return Math.max(0, Math.min(240, Math.round(val)));
}

export function EditOverlay({ page, selectedId, send, onTyping }: { page: PageJson; selectedId: string | null; send: Send; onTyping: (typing: boolean) => void }) {
  const [rects, setRects] = useState<Rect[]>([]);
  const [drop, setDrop] = useState<number | null>(null);
  const [activeEdit, setActiveEdit] = useState<{
    id: string;
    path: string;
    hasTwin: boolean;
    rect: { top: number; left: number; width: number; height: number };
    targetEl: HTMLElement;
  } | null>(null);
  const [spacingDrag, setSpacingDrag] = useState<{
    id: string;
    edge: "top" | "bottom";
    startY: number;
    startPx: number;
    currentPx: number;
  } | null>(null);
  const [pickerGap, setPickerGap] = useState<{ index: number; top: number } | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCategory, setPickerCategory] = useState("all");
  const spacingDragRef = useRef<typeof spacingDrag>(null);
  spacingDragRef.current = spacingDrag;
  const dragging = useRef<{ id: string; pointer: number } | null>(null);
  const dropRef = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Where each section is now, so the toolbar, the plus signs and the drop line can sit on top of it.
  useLayoutEffect(() => {
    const measure = () => {
      const next: Rect[] = [];
      for (const s of page.sections) {
        const el = document.querySelector<HTMLElement>(`[data-section-wrap="${CSS.escape(s.id)}"]`) || document.querySelector<HTMLElement>(`[data-section="${CSS.escape(s.id)}"]`);
        if (!el) continue;
        el.classList.toggle("bt-off", Boolean(s.disabled));
        const r = el.getBoundingClientRect();
        next.push({ id: s.id, top: r.top + window.scrollY, height: r.height });
      }
      setRects((old) => (old.length === next.length && old.every((o, i) => o.id === next[i]!.id && Math.abs(o.top - next[i]!.top) < 1 && Math.abs(o.height - next[i]!.height) < 1) ? old : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    const mo = new MutationObserver(measure);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); mo.disconnect(); window.removeEventListener("resize", measure); };
  }, [page]);

  // Text on the page can be typed into. Marked again after every redraw, because the page is drawn by React.
  useEffect(() => {
    for (const el of document.querySelectorAll<HTMLElement>("[data-edit]")) {
      if (el.getAttribute("contenteditable") !== "plaintext-only") el.setAttribute("contenteditable", "plaintext-only");
      el.spellcheck = false;
    }
  });

  useEffect(() => {
    const target = (e: Event) => (e.target as Element | null)?.closest?.("[data-edit]") as HTMLElement | null;
    const idOf = (el: Element | null) => el?.closest("[data-section-wrap]")?.getAttribute("data-section-wrap") || el?.closest("[data-section]")?.getAttribute("data-section") || null;
    const flush = (el: HTMLElement) => {
      const id = idOf(el);
      const path = el.getAttribute("data-edit");
      if (!id || !path) return;
      send({ type: "bt-preview:edit", id, path, twin: el.hasAttribute("data-tw"), value: el.innerText.replace(/\u00a0/g, " ").replace(/\n+$/g, "") });
    };
    const onInput = (e: Event) => {
      const el = target(e);
      if (!el) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(el), 180);
    };
    const onFocusIn = (e: Event) => {
      const el = target(e);
      if (el) {
        onTyping(true);
        const id = idOf(el);
        const path = el.getAttribute("data-edit");
        if (id && path) {
          const r = el.getBoundingClientRect();
          setActiveEdit({
            id,
            path,
            hasTwin: el.hasAttribute("data-tw"),
            rect: { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height },
            targetEl: el,
          });
        }
      }
    };
    const onFocusOut = (e: Event) => {
      const el = target(e);
      if (!el) return;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      flush(el);
      onTyping(false);
      setTimeout(() => {
        if (!document.activeElement?.closest("[data-edit]") && !document.activeElement?.closest(".bt-text-toolbar")) {
          setActiveEdit(null);
        }
      }, 180);
    };
    const onKey = (e: KeyboardEvent) => {
      const el = target(e);
      // Enter finishes a line of text; in a paragraph box it starts a new line.
      if (el && e.key === "Enter" && !el.hasAttribute("data-ml")) { e.preventDefault(); el.blur(); }
    };
    // Pasted text arrives as plain text only: no styles or markup from wherever it was copied.
    const onPaste = (e: ClipboardEvent) => {
      if (!target(e)) return;
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      document.execCommand("insertText", false, target(e)?.hasAttribute("data-ml") ? text.replace(/[ \t]+/g, " ").replace(/\r/g, "") : text.replace(/\s+/g, " "));
    };
    const onClick = (e: MouseEvent) => {
      const img = (e.target as Element | null)?.closest?.("[data-edit-image]");
      if (!img) return;
      const id = idOf(img);
      if (id) send({ type: "bt-preview:image", id, path: img.getAttribute("data-edit-image") });
    };
    const onDragOver = (e: DragEvent) => {
      const img = (e.target as Element | null)?.closest?.("[data-edit-image]");
      if (img && e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        e.stopPropagation();
        img.classList.add("bt-drag-over");
      }
    };
    const onDragLeave = (e: DragEvent) => {
      const img = (e.target as Element | null)?.closest?.("[data-edit-image]");
      if (img) {
        img.classList.remove("bt-drag-over");
      }
    };
    const onDrop = (e: DragEvent) => {
      const img = (e.target as Element | null)?.closest?.("[data-edit-image]") as HTMLElement | null;
      if (!img) return;
      img.classList.remove("bt-drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      e.preventDefault();
      e.stopPropagation();
      const id = idOf(img);
      const path = img.getAttribute("data-edit-image");
      if (!id || !path) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          send({
            type: "bt-preview:upload-image",
            id,
            path,
            dataUrl: reader.result,
            filename: file.name,
          });
        }
      };
      reader.readAsDataURL(file);
    };

    document.addEventListener("input", onInput, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("dragleave", onDragLeave, true);
    document.addEventListener("drop", onDrop, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("dragleave", onDragLeave, true);
      document.removeEventListener("drop", onDrop, true);
    };
  }, [send, onTyping]);

  useEffect(() => {
    if (!pickerGap) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerGap(null);
    };
    const onDocClick = (e: MouseEvent) => {
      if (
        !(e.target as Element | null)?.closest(".bt-gap-popover") &&
        !(e.target as Element | null)?.closest(".bt-gap")
      ) {
        setPickerGap(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onDocClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onDocClick);
    };
  }, [pickerGap]);

  // ---- dragging a section by its grip: mouse or finger
  const slotAt = (y: number): number => {
    let slot = 0;
    for (const r of rects) { if (y > r.top + r.height / 2) slot++; }
    return slot;
  };
  const onGripDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = { id, pointer: e.pointerId };
    dropRef.current = null;
  };
  const onGripMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    const slot = slotAt(e.clientY + window.scrollY);
    dropRef.current = slot;
    setDrop(slot);
    // Near the top or bottom of the screen the page scrolls so a long page can be crossed in one drag.
    if (e.clientY < 70) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
  };
  // However a drag ends (let go, cancelled, or the browser took the pointer back) the drag is over: it can never stay stuck and swallow later clicks.
  const finishDrag = () => {
    const d = dragging.current;
    dragging.current = null;
    const slot = dropRef.current;
    setDrop(null);
    dropRef.current = null;
    if (d && slot !== null) send({ type: "bt-preview:move", id: d.id, slot });
  };
  const onGripUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    finishDrag();
  };

  const onSpacingDown = (e: React.PointerEvent, id: string, edge: "top" | "bottom", initialPx: number) => {
    e.preventDefault();
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setSpacingDrag({
      id,
      edge,
      startY: e.clientY,
      startPx: initialPx,
      currentPx: initialPx,
    });
  };

  const onSpacingMove = (e: React.PointerEvent) => {
    const d = spacingDragRef.current;
    if (!d) return;
    const delta = d.edge === "top" ? (d.startY - e.clientY) : (e.clientY - d.startY);
    const raw = Math.max(0, Math.min(240, d.startPx + delta));
    const snapped = snapSpacing(raw);
    setSpacingDrag((prev) => (prev ? { ...prev, currentPx: snapped } : null));
  };

  const onSpacingUp = (e: React.PointerEvent) => {
    const d = spacingDragRef.current;
    if (!d) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const finalPx = d.currentPx;
    const edge = d.edge;
    const id = d.id;
    setSpacingDrag(null);
    send({ type: "bt-preview:spacing", id, edge, px: finalPx });
  };

  const yOfSlot = (slot: number): number => {
    if (rects.length === 0) return 0;
    if (slot <= 0) return rects[0]!.top;
    const r = rects[Math.min(slot, rects.length) - 1]!;
    return r.top + r.height;
  };

  const height = rects.length ? rects[rects.length - 1]!.top + rects[rects.length - 1]!.height : 0;
  const idx = (id: string) => page.sections.findIndex((s) => s.id === id);

  const allDefs = sectionsFor("home");
  const filteredDefs = allDefs.filter((d) => {
    if (pickerCategory !== "all") {
      const cat = STORE_SECTION_CATEGORIES.find((c) => c.id === pickerCategory);
      if (cat && !cat.types.includes(d.type)) return false;
    }
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase().trim();
      return (
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <>
      <style id="bt-edit-css">{EDIT_CSS}</style>
      <div className="bt-ovl" style={{ height }} aria-hidden={false}>
        {rects.map((r, i) => (
          <div key={`gap-${r.id}`} className="bt-gap" style={{ top: r.top - 16 }}>
            <button
              type="button"
              aria-label={`Add a section ${i === 0 ? "at the top" : "here"}`}
              data-testid={`gap-${i}`}
              onClick={(e) => {
                e.stopPropagation();
                setPickerGap((prev) => (prev?.index === i ? null : { index: i, top: r.top }));
                setPickerSearch("");
              }}
            >
              <span>+</span>
              <span>Add section</span>
            </button>
          </div>
        ))}
        {rects.length > 0 && (
          <div className="bt-gap" style={{ top: rects[rects.length - 1]!.top + rects[rects.length - 1]!.height - 16 }}>
            <button
              type="button"
              aria-label="Add a section at the end"
              data-testid="gap-end"
              onClick={(e) => {
                e.stopPropagation();
                const endTop = rects[rects.length - 1]!.top + rects[rects.length - 1]!.height;
                setPickerGap((prev) => (prev?.index === rects.length ? null : { index: rects.length, top: endTop }));
                setPickerSearch("");
              }}
            >
              <span>+</span>
              <span>Add section</span>
            </button>
          </div>
        )}

        {/* In-Canvas Contextual Block Picker Popover */}
        {pickerGap !== null && (
          <div
            className="bt-gap-popover"
            style={{ top: Math.max(16, pickerGap.top + 16) }}
            role="dialog"
            aria-label="Choose a block to insert"
            data-testid="gap-popover"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bt-pop-header">
              <span className="bt-pop-title">
                <span>➕ Add Block</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B" }}>
                  (at position {pickerGap.index + 1})
                </span>
              </span>
              <button
                type="button"
                className="bt-pop-close"
                aria-label="Close block picker"
                onClick={() => setPickerGap(null)}
              >
                ✕
              </button>
            </div>

            <div className="bt-pop-search-wrap">
              <input
                type="text"
                className="bt-pop-search"
                placeholder="Search blocks (e.g. Menu, Hero, Reviews, FAQ)..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="bt-pop-cats">
              {STORE_SECTION_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`bt-pop-cat-btn${pickerCategory === cat.id ? " active" : ""}`}
                  onClick={() => setPickerCategory(cat.id)}
                >
                  {cat.title}
                </button>
              ))}
            </div>

            <div className="bt-pop-list">
              {filteredDefs.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "#64748B", fontSize: 13 }}>
                  No matching blocks found for &quot;{pickerSearch}&quot;
                </div>
              ) : (
                filteredDefs.map((d) => (
                  <button
                    key={d.type}
                    type="button"
                    className="bt-pop-card"
                    data-testid={`pop-card-${d.type}`}
                    onClick={() => {
                      send({ type: "bt-preview:insert", index: pickerGap.index, blockType: d.type });
                      setPickerGap(null);
                    }}
                  >
                    <div className="bt-pop-card-info">
                      <div className="bt-pop-card-title">{d.label}</div>
                      <div className="bt-pop-card-desc">{d.description}</div>
                    </div>
                    <span className="bt-pop-card-add">+ Insert</span>
                  </button>
                ))
              )}
            </div>

            <div className="bt-pop-footer">
              <button
                type="button"
                className="bt-pop-sidebar-btn"
                onClick={() => {
                  send({ type: "bt-preview:add", index: pickerGap.index });
                  setPickerGap(null);
                }}
              >
                Browse full block library in sidebar →
              </button>
            </div>
          </div>
        )}
        {rects.filter((r) => r.id === selectedId).map((r) => {
          const section = page.sections[idx(r.id)];
          const required = Boolean(section && sectionDef(section.type)?.required);
          const i = idx(r.id);
          const def = section ? sectionDef(section.type) : undefined;
          const label = section?.label || def?.label || section?.type || "Section";
          const currentTopPx = typeof section?.style?.paddingTop === "number" ? section.style.paddingTop : 48;
          const currentBottomPx = typeof section?.style?.paddingBottom === "number" ? section.style.paddingBottom : 48;

          return (
            <div key={`sel-group-${r.id}`}>
              {/* Floating Action Pill */}
              <div key={`bar-${r.id}`} className="bt-bar" style={{ top: Math.max(8, r.top + 8) }} role="toolbar" aria-label="This section" data-testid="section-bar">
                <div className="bt-bar-badge" title={def?.description || label}>
                  <span>{label}</span>
                  <span className="bt-pos">{i + 1}/{page.sections.length}</span>
                </div>
                <button type="button" className="bt-grip" aria-label="Drag to move this section" title="Drag to move" onPointerDown={(e) => onGripDown(e, r.id)} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp} onLostPointerCapture={finishDrag}>⠿</button>
                <button type="button" aria-label="Move up" title="Move up" disabled={i <= 0} onClick={() => send({ type: "bt-preview:op", id: r.id, op: "up" })}>↑</button>
                <button type="button" aria-label="Move down" title="Move down" disabled={i < 0 || i >= page.sections.length - 1} onClick={() => send({ type: "bt-preview:op", id: r.id, op: "down" })}>↓</button>
                <button type="button" className="bt-settings" aria-label="Edit section settings" title="Edit settings in inspector" onClick={() => send({ type: "bt-preview:open-settings", id: r.id })}>⚙</button>
                <button type="button" aria-label={section?.disabled ? "Show this section" : "Hide this section"} title={section?.disabled ? "Show section" : "Hide section"} disabled={required} onClick={() => send({ type: "bt-preview:op", id: r.id, op: "hide" })}>{section?.disabled ? "◌" : "◉"}</button>
                <button type="button" aria-label="Duplicate this section" title="Duplicate section (Ctrl+D)" onClick={() => send({ type: "bt-preview:op", id: r.id, op: "dup" })}>⧉</button>
                <button type="button" className="bt-del" aria-label="Delete this section" title="Delete section" disabled={required} onClick={() => send({ type: "bt-preview:op", id: r.id, op: "delete" })}>✕</button>
              </div>

              {/* Top Spacing Drag Handle */}
              <div className="bt-space-band bt-space-top" style={{ top: r.top }}>
                <div
                  className={`bt-space-grip${spacingDrag?.id === r.id && spacingDrag.edge === "top" ? " dragging" : ""}`}
                  onPointerDown={(e) => onSpacingDown(e, r.id, "top", currentTopPx)}
                  onPointerMove={onSpacingMove}
                  onPointerUp={onSpacingUp}
                  onPointerCancel={onSpacingUp}
                  title="Drag vertically to adjust top section padding"
                >
                  <span>↕ Top</span>
                  <span className="bt-space-badge">
                    {spacingDrag?.id === r.id && spacingDrag.edge === "top" ? `${spacingDrag.currentPx}px` : `${currentTopPx}px`}
                  </span>
                </div>
              </div>

              {/* Bottom Spacing Drag Handle */}
              <div className="bt-space-band bt-space-bottom" style={{ top: r.top + r.height }}>
                <div
                  className={`bt-space-grip${spacingDrag?.id === r.id && spacingDrag.edge === "bottom" ? " dragging" : ""}`}
                  onPointerDown={(e) => onSpacingDown(e, r.id, "bottom", currentBottomPx)}
                  onPointerMove={onSpacingMove}
                  onPointerUp={onSpacingUp}
                  onPointerCancel={onSpacingUp}
                  title="Drag vertically to adjust bottom section padding"
                >
                  <span>↕ Bottom</span>
                  <span className="bt-space-badge">
                    {spacingDrag?.id === r.id && spacingDrag.edge === "bottom" ? `${spacingDrag.currentPx}px` : `${currentBottomPx}px`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {drop !== null && <div className="bt-drop" style={{ top: yOfSlot(drop) - 2 }} />}

        {/* Floating in-canvas Notion-style text toolbar */}
        {activeEdit && (
          <div
            className="bt-text-toolbar"
            style={{
              top: Math.max(8, activeEdit.rect.top - 46),
              left: Math.max(12, Math.min(window.innerWidth - 300, activeEdit.rect.left)),
            }}
            onMouseDown={(e) => e.preventDefault()}
            role="toolbar"
            aria-label="Text formatting toolbar"
          >
            <button
              type="button"
              className="bt-font-btn"
              title="Toggle Bengali typography font (Aa / বা)"
              onClick={() => {
                if (activeEdit?.targetEl) {
                  const hasBn = activeEdit.targetEl.classList.toggle("bt-noto-bn");
                  activeEdit.targetEl.style.fontFamily = hasBn ? "var(--font-notosansbn), sans-serif" : "";
                }
              }}
            >
              Aa/বা
            </button>

            {activeEdit.hasTwin && (
              <button
                type="button"
                className="bt-lang-btn"
                title="Switch between English and Bengali view in preview"
                onClick={() => {
                  send({ type: "bt-preview:set-lang", lang: "bn" });
                }}
              >
                EN ⇄ বাং
              </button>
            )}

            <div className="bt-sep" />

            <button
              type="button"
              className="bt-done-btn"
              title="Done editing text (Esc or Enter)"
              onClick={() => {
                activeEdit?.targetEl.blur();
                setActiveEdit(null);
              }}
            >
              ✓ Done
            </button>
          </div>
        )}
      </div>
    </>
  );
}
