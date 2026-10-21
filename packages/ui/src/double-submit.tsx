"use client";

import { useEffect } from "react";

/** A second submit of the same form inside this window is ignored. Long enough to cover a slow server action, short enough that a real retry still works. */
export const SUBMIT_LOCK_MS = 3000;

/** True when the same form was already submitted a moment ago. */
export function shouldBlockSubmit(lastSubmitAt: number | undefined, now: number, lockMs: number = SUBMIT_LOCK_MS): boolean {
  return lastSubmitAt !== undefined && now - lastSubmitAt < lockMs;
}

/**
 * Safety net for every action form on the page: if a visitor double-clicks, presses Enter twice, or taps again because nothing seemed to
 * happen, the second submit is swallowed. Forms that fetch (GET) are left alone, and a form can opt out with data-allow-resubmit.
 * Mount once near the top of the page body. It does not replace a visible loading state on the button.
 */
export function DoubleSubmitGuard({ lockMs = SUBMIT_LOCK_MS }: { lockMs?: number }) {
  useEffect(() => {
    const last = new WeakMap<HTMLFormElement, number>();
    const onSubmit = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      // Only forms that go to an action (a server action or a URL). A form with no action is handled by its own onSubmit, which may
      // reject the first try (a missing field) and must be free to send the corrected one straight away.
      if (!form.hasAttribute("action") || form.getAttribute("method")?.toLowerCase() === "get" || form.hasAttribute("data-allow-resubmit")) return;
      const now = Date.now();
      if (shouldBlockSubmit(last.get(form), now, lockMs)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      last.set(form, now);
    };
    // Capture phase: runs before React's own submit handling, so a blocked submit never reaches the action.
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [lockMs]);
  return null;
}
