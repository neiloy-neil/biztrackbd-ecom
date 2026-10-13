"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sectionDef, type PageJson } from "@biztrackbd/core/builder-client";

/**
 * Editing a landing page on the page itself (docs/46, stage 4). It lives in the editor's preview only: the live store never loads it.
 * Text marked data-edit is typed into directly (plain text), pictures marked data-edit-image open the chooser, the selected section gets a
 * small toolbar, a grip drags it to a new place, and a plus between sections adds one there. Every change is a message to the editor,
 * which checks it against the section's own definition and keeps the draft, the undo history and the saving.
 */

type Send = (msg: Record<string, unknown>) => void;
type Rect = { id: string; top: number; height: number };

const EDIT_CSS = `
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
.lp-pick{display:flex;align-items:center;justify-content:center;min-height:120px;border:2px dashed rgba(91,79,232,.55);border-radius:12px;color:#5B4FE8;font-weight:700;cursor:pointer}
.bt-ovl{position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:60}
.bt-bar{position:absolute;right:8px;display:flex;gap:2px;padding:3px;background:#fff;border:1px solid #cfcdf5;border-radius:10px;box-shadow:0 4px 14px rgba(26,26,78,.2);pointer-events:auto}
.bt-bar button{all:unset;box-sizing:border-box;width:36px;height:36px;display:grid;place-items:center;border-radius:8px;cursor:pointer;color:#26264f;font:600 16px/1 system-ui}
.bt-bar button:hover:not(:disabled){background:#eceafd}
.bt-bar button:disabled{opacity:.35;cursor:not-allowed}
.bt-bar .bt-grip{cursor:grab;touch-action:none}
.bt-bar .bt-del{color:#b42318}
.bt-gap{position:absolute;left:0;width:100%;height:26px;display:grid;place-items:center;pointer-events:auto;opacity:0}
.bt-gap:hover,.bt-gap:focus-within{opacity:1}
.bt-gap::before{content:"";position:absolute;left:8%;right:8%;top:12px;height:2px;background:#5B4FE8;border-radius:2px}
.bt-gap button{all:unset;position:relative;box-sizing:border-box;width:26px;height:26px;border-radius:99px;background:#5B4FE8;color:#fff;display:grid;place-items:center;cursor:pointer;font:700 18px/1 system-ui}
@media (hover:none){.bt-gap{opacity:.75}}
.bt-drop{position:absolute;left:4%;width:92%;height:4px;background:#5B4FE8;border-radius:4px;box-shadow:0 0 0 3px rgba(91,79,232,.25);pointer-events:none}
`;

export function EditOverlay({ page, selectedId, send, onTyping }: { page: PageJson; selectedId: string | null; send: Send; onTyping: (typing: boolean) => void }) {
  const [rects, setRects] = useState<Rect[]>([]);
  const [drop, setDrop] = useState<number | null>(null);
  const dragging = useRef<{ id: string; pointer: number } | null>(null);
  const dropRef = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Where each section is now, so the toolbar, the plus signs and the drop line can sit on top of it.
  useLayoutEffect(() => {
    const measure = () => {
      const next: Rect[] = [];
      for (const s of page.sections) {
        const el = document.querySelector<HTMLElement>(`[data-section="${CSS.escape(s.id)}"]`);
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
    const idOf = (el: Element | null) => el?.closest("[data-section]")?.getAttribute("data-section") ?? null;
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
    const onFocusIn = (e: Event) => { if (target(e)) onTyping(true); };
    const onFocusOut = (e: Event) => {
      const el = target(e);
      if (!el) return;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      flush(el);
      onTyping(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const el = target(e);
      if (el && e.key === "Enter") { e.preventDefault(); el.blur(); }
    };
    // Pasted text arrives as plain text only: no styles or markup from wherever it was copied.
    const onPaste = (e: ClipboardEvent) => {
      if (!target(e)) return;
      e.preventDefault();
      document.execCommand("insertText", false, (e.clipboardData?.getData("text/plain") ?? "").replace(/\s+/g, " "));
    };
    const onClick = (e: MouseEvent) => {
      const img = (e.target as Element | null)?.closest?.("[data-edit-image]");
      if (!img) return;
      const id = idOf(img);
      if (id) send({ type: "bt-preview:image", id, path: img.getAttribute("data-edit-image") });
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [send, onTyping]);

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

  const yOfSlot = (slot: number): number => {
    if (rects.length === 0) return 0;
    if (slot <= 0) return rects[0]!.top;
    const r = rects[Math.min(slot, rects.length) - 1]!;
    return r.top + r.height;
  };

  const height = rects.length ? rects[rects.length - 1]!.top + rects[rects.length - 1]!.height : 0;
  const idx = (id: string) => page.sections.findIndex((s) => s.id === id);

  return (
    <>
      <style id="bt-edit-css">{EDIT_CSS}</style>
      <div className="bt-ovl" style={{ height }} aria-hidden={false}>
        {rects.map((r, i) => (
          <div key={`gap-${r.id}`} className="bt-gap" style={{ top: r.top - 13 }}>
            <button type="button" aria-label={`Add a section ${i === 0 ? "at the top" : "here"}`} data-testid={`gap-${i}`} onClick={() => send({ type: "bt-preview:add", index: i })}>+</button>
          </div>
        ))}
        {rects.length > 0 && (
          <div className="bt-gap" style={{ top: rects[rects.length - 1]!.top + rects[rects.length - 1]!.height - 13 }}>
            <button type="button" aria-label="Add a section at the end" data-testid="gap-end" onClick={() => send({ type: "bt-preview:add", index: rects.length })}>+</button>
          </div>
        )}
        {rects.filter((r) => r.id === selectedId).map((r) => {
          const section = page.sections[idx(r.id)];
          const required = Boolean(section && sectionDef(section.type)?.required);
          const i = idx(r.id);
          return (
            <div key={`bar-${r.id}`} className="bt-bar" style={{ top: r.top + 8 }} role="toolbar" aria-label="This section" data-testid="section-bar">
              <button type="button" className="bt-grip" aria-label="Drag to move this section" title="Drag to move" onPointerDown={(e) => onGripDown(e, r.id)} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp} onLostPointerCapture={finishDrag}>⠿</button>
              <button type="button" aria-label="Move up" disabled={i <= 0} onClick={() => send({ type: "bt-preview:op", id: r.id, op: "up" })}>↑</button>
              <button type="button" aria-label="Move down" disabled={i < 0 || i >= page.sections.length - 1} onClick={() => send({ type: "bt-preview:op", id: r.id, op: "down" })}>↓</button>
              <button type="button" aria-label={section?.disabled ? "Show this section" : "Hide this section"} disabled={required} onClick={() => send({ type: "bt-preview:op", id: r.id, op: "hide" })}>{section?.disabled ? "◌" : "◉"}</button>
              <button type="button" aria-label="Duplicate this section" onClick={() => send({ type: "bt-preview:op", id: r.id, op: "dup" })}>⧉</button>
              <button type="button" className="bt-del" aria-label="Delete this section" disabled={required} onClick={() => send({ type: "bt-preview:op", id: r.id, op: "delete" })}>✕</button>
            </div>
          );
        })}
        {drop !== null && <div className="bt-drop" style={{ top: yOfSlot(drop) - 2 }} />}
      </div>
    </>
  );
}
