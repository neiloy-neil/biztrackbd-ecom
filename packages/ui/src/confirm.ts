export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  /** Pass null for an information-only box with a single button. */
  cancelLabel?: string | null;
  /** "danger" colours the confirm button red; use it when the action cannot be taken back in one click. */
  tone?: "default" | "danger";
}

/**
 * An accessible replacement for window.confirm: a native <dialog> (focus trap, Esc and focus return come free) that names the
 * consequence and the action. Resolves true on confirm, false on cancel, Esc or a click outside. Client-side only.
 */
export function askConfirm(opts: ConfirmOptions | string): Promise<boolean> {
  const o: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const opener = document.activeElement as HTMLElement | null;
    const d = document.createElement("dialog");
    d.className = "confirm-dialog";
    const titleId = `confirm-t-${Math.random().toString(36).slice(2, 8)}`;
    const descId = `confirm-d-${Math.random().toString(36).slice(2, 8)}`;
    d.setAttribute("aria-labelledby", titleId);
    d.setAttribute("aria-describedby", descId);
    const h = document.createElement("h2");
    h.id = titleId;
    h.textContent = o.title ?? (o.tone === "danger" ? "Are you sure?" : "Please confirm");
    const p = document.createElement("p");
    p.id = descId;
    p.textContent = o.message;
    const row = document.createElement("div");
    row.className = "confirm-actions";
    let result = false;
    const finish = () => {
      d.close();
      d.remove();
      opener?.focus?.();
      resolve(result);
    };
    if (o.cancelLabel !== null) {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn btn-secondary";
      cancel.textContent = o.cancelLabel ?? "Cancel";
      cancel.onclick = finish;
      row.append(cancel);
    }
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = o.tone === "danger" ? "btn btn-danger" : "btn btn-primary";
    ok.textContent = o.confirmLabel ?? "Confirm";
    ok.onclick = () => { result = true; finish(); };
    row.append(ok);
    d.append(h, p, row);
    // Esc and the backdrop both count as "no".
    d.addEventListener("cancel", (e) => { e.preventDefault(); result = false; finish(); });
    d.addEventListener("click", (e) => { if (e.target === d) { result = false; finish(); } });
    document.body.append(d);
    d.showModal();
    // Focus the safe choice when the action is destructive, so Enter does not delete.
    (o.tone === "danger" && o.cancelLabel !== null ? (row.firstElementChild as HTMLElement) : ok).focus();
  });
}
