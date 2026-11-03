"use client";

import { useId, useState } from "react";

/**
 * On a phone, a row of filter chips pushes the list below the fold. This keeps the search box in view and tucks the rest behind one
 * "Filters" button that says how many are on. On a wide screen it is invisible: the filters are always shown. The filters stay in the
 * form either way, so a browser without scripts still submits them.
 */
export function FilterDisclosure({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(activeCount > 0);
  const id = useId();
  return (
    <>
      <button type="button" className="btn btn-secondary filters-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      <div id={id} className="filters-body" data-open={open ? "true" : "false"}>
        {children}
      </div>
    </>
  );
}
