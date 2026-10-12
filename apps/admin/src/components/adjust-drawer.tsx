"use client";

import { useState, type ReactNode } from "react";
import { Drawer } from "@biztrackbd/ui";

/** A button that opens its children in a side panel (a bottom sheet on a phone). The children are only built while it is open. */
export function ActionDrawer({ label, title, testId, children }: { label: string; title: string; testId?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="quick-btn" onClick={() => setOpen(true)} data-testid={testId} aria-label={`${label}: ${title}`}>{label}</button>
      <Drawer open={open} onClose={() => setOpen(false)} title={title}>{children}</Drawer>
    </>
  );
}
