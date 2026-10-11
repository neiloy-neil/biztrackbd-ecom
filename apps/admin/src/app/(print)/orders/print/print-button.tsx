"use client";

import { markPrintedAction } from "./actions";

export function PrintButton({ ids, doc }: { ids: string[]; doc: string }) {
  return (
    <button
      type="button" className="btn btn-primary"
      onClick={async () => { try { await markPrintedAction(ids, doc); } catch { /* printing still works if the note fails */ } window.print(); }}
    >
      Print
    </button>
  );
}
