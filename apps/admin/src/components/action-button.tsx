"use client";

import { useTransition } from "react";

/** An inline action button that invokes a Server Action without needing a <form> wrapper. Prevents HTML nested form invalidity. */
export function ActionButton({
  action,
  label,
  pending = "…",
  className = "btn btn-secondary btn-sm",
  testId,
}: {
  action: () => Promise<void>;
  label: string;
  pending?: string;
  className?: string;
  testId?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          await action();
        });
      }}
      data-testid={testId}
    >
      {isPending ? pending : label}
    </button>
  );
}
