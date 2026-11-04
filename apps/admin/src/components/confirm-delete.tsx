"use client";

import { useTransition } from "react";
import { askConfirm } from "@biztrackbd/ui";

/** A delete button that asks first. Executes a server action directly without an enclosing <form> to prevent invalid nested forms. */
export function ConfirmDelete({
  action,
  message,
  label = "Delete",
  testId,
  className = "btn btn-secondary btn-sm",
}: {
  action: () => Promise<void>;
  message: string;
  label?: string;
  testId?: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      disabled={isPending}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!(await askConfirm({ message, confirmLabel: label, tone: "danger" }))) return;
        startTransition(async () => {
          await action();
        });
      }}
      data-testid={testId}
    >
      {isPending ? "Deleting…" : label}
    </button>
  );
}
