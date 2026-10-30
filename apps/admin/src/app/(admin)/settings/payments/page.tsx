import type { Metadata } from "next";
import { getStoreSettings } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { PageHeader } from "@biztrackbd/ui";
import { PaymentsForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payments" };

export default async function Payments() {
  const s = await requireAccess("billing", "edit");
  const st = await getStoreSettings(s.tenantId, s.actor);
  return (
    <>
      <PageHeader
        title="Payment Methods"
        crumbs={[{ label: "Home", href: "/" }, { label: "Settings" }, { label: "Payments" }]}
        sub="Choose how customers pay you. Turn methods on or off at any time."
      />
      <PaymentsForm initial={{
        codEnabled: st.codEnabled, codFee: st.codFee, codMaxAmount: st.codMaxAmount, bkashEnabled: st.bkashEnabled, bkashNumber: st.bkashNumber ?? "", bkashKind: st.bkashKind,
        bkashInstruction: st.bkashInstruction ?? "", nagadEnabled: st.nagadEnabled, nagadNumber: st.nagadNumber ?? "", nagadKind: st.nagadKind, nagadInstruction: st.nagadInstruction ?? "",
        paymentNote: st.paymentNote ?? "",
      }} />
    </>
  );
}
