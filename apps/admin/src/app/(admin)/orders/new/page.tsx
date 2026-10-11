import type { Metadata } from "next";
import { divisionOfDistrict, getAbandoned, searchVariantsForOrder } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { QuickOrderDesk, type Prefill } from "./desk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quick order" };

export default async function NewOrder({ searchParams }: { searchParams: Promise<{ abandoned?: string }> }) {
  const s = await requireAccess("orders", "edit");
  const { abandoned } = await searchParams;
  let prefill: Prefill | undefined;
  // "Make this an order" from the call list: the customer's number, name and cart are already in the form. The address is still theirs to give on the call.
  if (abandoned) {
    const row = await getAbandoned(s.tenantId, s.actor, abandoned).catch(() => null);
    if (row && ["CAPTURED", "CALL_SCHEDULED", "CALL_CONNECTED"].includes(row.status)) {
      const catalog = await searchVariantsForOrder(s.tenantId, s.actor, "", 50);
      const district = row.district ?? "Dhaka";
      prefill = {
        phone: row.phone.slice(1), name: row.name ?? "", district, division: divisionOfDistrict(district) ?? "Dhaka", fromAbandoned: true,
        lines: row.lines.filter((l) => catalog.some((c) => c.variantId === l.variantId)).map((l) => ({
          variantId: l.variantId, label: `${l.title}${l.variantTitle && l.variantTitle.toLowerCase() !== "default" ? ` (${l.variantTitle})` : ""}`, price: l.price,
          stock: catalog.find((c) => c.variantId === l.variantId)!.stock, quantity: l.quantity,
        })),
      };
    }
  }
  return <QuickOrderDesk prefill={prefill} />;
}
