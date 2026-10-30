"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A bar that appears when rows of a list are selected, with what you can do to them. It lives inside the list's <form>, so the buttons
 * in it submit the selected rows. It watches the form's `ids` checkboxes, counting only the ones on screen (the phone and computer
 * layouts are both in the page, one hidden).
 */
export function BulkBar({ noun = "order", children }: { noun?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState({ picked: 0, total: 0 });

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const visible = () => [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]')].filter((b) => b.offsetParent !== null);
    const sync = () => { const all = visible(); setState({ picked: all.filter((b) => b.checked).length, total: all.length }); };
    sync();
    form.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => { form.removeEventListener("change", sync); window.removeEventListener("resize", sync); };
  }, []);

  function setAll(on: boolean) {
    const form = anchor.current?.closest("form");
    if (!form) return;
    for (const b of form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]')) {
      if (b.offsetParent !== null && b.checked !== on) { b.checked = on; b.dispatchEvent(new Event("change", { bubbles: true })); }
    }
  }

  return (
    <>
      <span ref={anchor} hidden />
      <div className="bulk-top">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll(state.picked < state.total)} disabled={state.total === 0}>
          {state.picked > 0 && state.picked === state.total ? "Clear selection" : `Select all ${state.total}`}
        </button>
      </div>
      {state.picked > 0 && (
        <div className="bulkbar" ref={ref} role="region" aria-label={`Actions for the selected ${noun}s`} data-testid="bulk-bar">
          <strong>{state.picked} selected</strong>
          <div className="bulk-actions">{children}</div>
          <button type="button" className="bulk-x" onClick={() => setAll(false)} aria-label="Clear selection">×</button>
        </div>
      )}
    </>
  );
}

/**
 * Head checkbox that selects / deselects all row checkboxes in the containing <form>.
 * Safe to render in Server Component tables because it is a Client Component.
 */
export function SelectAllCheckbox({
  label = "Select all",
  className,
  style,
}: {
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const form = el.closest("form");
    if (!form) return;

    const sync = () => {
      const visible = [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]')].filter(
        (b) => b.offsetParent !== null
      );
      const picked = visible.filter((b) => b.checked).length;
      if (visible.length === 0 || picked === 0) {
        el.checked = false;
        el.indeterminate = false;
      } else if (picked === visible.length) {
        el.checked = true;
        el.indeterminate = false;
      } else {
        el.checked = false;
        el.indeterminate = true;
      }
    };

    sync();
    form.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      form.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const form = el.closest("form");
    if (!form) return;
    const visible = [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]')].filter(
      (b) => b.offsetParent !== null
    );
    const on = el.checked;
    for (const b of visible) {
      if (b.checked !== on) {
        b.checked = on;
        b.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  };

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      onChange={handleChange}
      className={className}
      style={{ width: 18, height: 18, cursor: "pointer", ...style }}
    />
  );
}
