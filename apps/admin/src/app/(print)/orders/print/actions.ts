"use server";

import { recordPrinted } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

/** Notes on each order's timeline that a document was printed, so the team can see a slip already went out. */
export async function markPrintedAction(ids: string[], doc: string): Promise<void> {
  const s = await requireAction("orders", "view");
  await recordPrinted(s.tenantId, s.actor, ids.slice(0, 100), doc === "slip" ? "Packing slip" : doc === "label" ? "Courier label" : "Invoice");
}
