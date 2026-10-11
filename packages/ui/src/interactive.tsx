"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/** A side panel on desktop and a bottom sheet on phones, built on the native <dialog> (focus trap, Esc and backdrop come free). */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="drawer" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-label={typeof title === "string" ? title : undefined}>
      <div className="drawer-head"><h2>{title}</h2><button type="button" className="drawer-x" onClick={onClose} aria-label="Close">×</button></div>
      <div className="drawer-body">{open ? children : null}</div>
    </dialog>
  );
}

interface Toast { id: number; text: string; kind: "good" | "bad" | "plain" }
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

/** Mount once near the root. Any client component can then call `useToast()("Saved")`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((text: string, kind: Toast["kind"] = "good") => {
    const id = next.current++;
    setItems((l) => [...l.slice(-2), { id, text, kind }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}

/** Sticks to the bottom of a long form. Says whether anything is unsaved and keeps Save and Discard in reach. */
export function SaveBar({ dirty, pending, onDiscard, saveLabel = "Save changes", savingLabel = "Saving…", children }: { dirty: boolean; pending?: boolean; onDiscard?: () => void; saveLabel?: string; savingLabel?: string; children?: ReactNode }) {
  return (
    <div className={`savebar${dirty ? " dirty" : ""}`} role="region" aria-label="Save">
      <div className="savebar-msg">{children ?? (dirty ? "You have unsaved changes" : "All changes saved")}</div>
      {dirty && onDiscard && <button type="button" className="btn btn-secondary btn-sm" onClick={onDiscard} disabled={pending}>Discard</button>}
      <button type="submit" className="btn btn-primary btn-sm" disabled={!dirty || pending} aria-busy={pending}>{pending ? savingLabel : saveLabel}</button>
    </div>
  );
}

/** Two or three choices as one control. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}
