"use client";

import { useState } from "react";

/** A small button that copies a value (a TrxID, a phone number, an address) and says so. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button" className="btn btn-secondary btn-sm" aria-label={`Copy ${label}`} data-testid={`copy-${label.toLowerCase().replace(/\W+/g, "-")}`}
      onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* the value is on screen to select by hand */ } }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}
