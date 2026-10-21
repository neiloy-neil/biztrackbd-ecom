/** A second submit of the same form inside this window is ignored. Long enough to cover a slow server action, short enough that a real retry still works. */
export const SUBMIT_LOCK_MS = 3000;

/** True when the same form was already submitted a moment ago. */
export function shouldBlockSubmit(lastSubmitAt: number | undefined, now: number, lockMs: number = SUBMIT_LOCK_MS): boolean {
  return lastSubmitAt !== undefined && now - lastSubmitAt < lockMs;
}
