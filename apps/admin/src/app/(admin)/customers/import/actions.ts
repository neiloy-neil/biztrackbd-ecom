"use server";

import { revalidatePath } from "next/cache";
import { DomainError, importCustomersCsv, type CustomerImportResult } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export type CustomerImportState = ({ ok: true } & CustomerImportResult) | { ok: false; error: string } | null;

/** Reads the chosen CSV file and adds the customers in it. */
export async function importCustomersAction(_prev: CustomerImportState, form: FormData): Promise<CustomerImportState> {
  const s = await requireAction("customers", "edit");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file first." };
  if (file.size > 2_000_000) return { ok: false, error: "That file is too big. Split it into files of 2,000 customers or fewer." };
  try {
    const r = await importCustomersCsv(s.tenantId, s.actor, await file.text());
    revalidatePath("/customers");
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("importCustomersAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Something went wrong. Nothing was imported." };
  }
}
