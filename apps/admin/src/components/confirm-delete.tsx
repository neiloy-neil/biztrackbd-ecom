"use client";

import { SubmitButton } from "./ui";

/** A delete button that asks first. Deleting a page cannot be undone, and a live page's address stops working at once. */
export function ConfirmDelete({ action, message, label = "Delete", testId }: { action: () => Promise<void>; message: string; label?: string; testId?: string }) {
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      <SubmitButton className="btn btn-secondary btn-sm" pending="Deleting…" data-testid={testId}>{label}</SubmitButton>
    </form>
  );
}
