"use client";

import { useBusyAction } from "@biztrackbd/ui";
import { markPrintedAction } from "./actions";

export function PrintButton({ ids, doc }: { ids: string[]; doc: string }) {
  const { busy, run } = useBusyAction();
  return (
    <button
      type="button" className="btn btn-primary"
      disabled={busy !== null}
      onClick={() => run("print", async () => { try { await markPrintedAction(ids, doc); } catch { /* printing still works if the note fails */ } window.print(); })}
    >
      Print
    </button>
  );
}
