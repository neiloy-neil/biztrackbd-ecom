"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Runs one async action at a time. A second call while the first is still running is ignored (even in the same tick, before React
 * re-renders), and `busy` holds the key of the running action so the button can show a disabled/pending state.
 */
export function useBusyAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const locked = useRef(false);
  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
    if (locked.current) return undefined;
    locked.current = true;
    setBusy(key);
    try {
      return await fn();
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }, []);
  return { busy, run };
}
