"use client";

import { useEffect } from "react";

/**
 * Warns before the tab is closed, reloaded or left through a link to another site while a form has unsaved edits.
 * (Browsers show their own wording; the text cannot be changed.) Pass `dirty` from the form's state.
 */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}
