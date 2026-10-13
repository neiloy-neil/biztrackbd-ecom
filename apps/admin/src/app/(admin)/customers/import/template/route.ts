import { CUSTOMER_IMPORT_TEMPLATE } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

/** A sample CSV with the right columns, to fill in and upload. */
export async function GET(): Promise<Response> {
  await requireAccess("customers");
  return new Response(CUSTOMER_IMPORT_TEMPLATE, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="customers-template.csv"', "cache-control": "no-store" } });
}
