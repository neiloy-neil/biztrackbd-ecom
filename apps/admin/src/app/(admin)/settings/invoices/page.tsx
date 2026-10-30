import type { Metadata } from "next";
import { can, getStoreSettings } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { PageHeader } from "@biztrackbd/ui";
import { InvoiceForm } from "./invoice-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoices" };

export default async function Invoices() {
  const s = await requireAccess("design");
  const st = await getStoreSettings(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "design", "edit");
  return (
    <>
      <PageHeader
        title="Invoice & Packing Slip Layout"
        crumbs={[{ label: "Home", href: "/" }, { label: "Settings" }, { label: "Invoices" }]}
        sub="How your invoices, packing slips and courier labels look when you print them from an order."
      />
      {canEdit ? (
        <InvoiceForm initial={{ footer: st.invoiceFooter ?? "", showLogo: st.invoiceOptions.showLogo, showSku: st.invoiceOptions.showSku, showPricesOnSlip: st.invoiceOptions.showPricesOnSlip, paper: st.invoiceOptions.paper, hasLogo: Boolean(st.logoUrl) }} />
      ) : (
        <div className="card"><b>Invoice layout</b><p className="muted">You can print invoices but not change how they look.</p></div>
      )}
    </>
  );
}
