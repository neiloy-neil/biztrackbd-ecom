import type { Metadata } from "next";
import { can, getStoreSettings } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { requireAccess } from "@/lib/session";
import { pauseAction } from "./actions";
import { StoreForm } from "./store-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store details" };

export default async function StoreDetails() {
  const s = await requireAccess("design");
  const st = await getStoreSettings(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "design", "edit");
  return (
    <>
      <div className="page-head"><h1>Store details</h1></div>
      <p className="page-sub">This information appears on invoices, emails and your store footer.</p>
      {canEdit ? (
        <>
          <StoreForm initial={{
            storeName: st.storeName, storeNameBn: st.storeNameBn ?? "", tagline: st.tagline ?? "", description: st.description ?? "", contactPhone: st.contactPhone ?? "", whatsappNumber: st.whatsappNumber ?? "",
            email: st.email ?? "", facebookUrl: st.facebookUrl ?? "", instagramUrl: st.instagramUrl ?? "", addressLine: st.addressLine ?? "", pickupAddress: st.pickupAddress ?? "", logoUrl: st.logoUrl ?? "",
            announcement: st.announcement ?? "", announcementBn: st.announcementBn ?? "", orderPrefix: st.orderPrefix, invoiceFooter: st.invoiceFooter ?? "",
            showLogo: st.invoiceOptions.showLogo, showSku: st.invoiceOptions.showSku, showPricesOnSlip: st.invoiceOptions.showPricesOnSlip,
          }} />
          <section className="card" style={{ marginTop: 14 }} data-testid="pause-card">
            <h2>Pause or reopen your store</h2>
            {st.ordersPaused ? (
              <form action={pauseAction.bind(null, false)} className="stack">
                <div className="notice">Your store is paused. Customers can look around but cannot place orders.</div>
                <SubmitButton className="btn btn-primary" pending="Reopening…">Reopen the store</SubmitButton>
              </form>
            ) : (
              <form action={pauseAction.bind(null, true)} className="stack">
                <p className="muted">Pausing stops new orders. Customers see a notice. Your products and existing orders are not affected.</p>
                <SubmitButton className="btn btn-danger" pending="Pausing…">Pause store</SubmitButton>
              </form>
            )}
          </section>
        </>
      ) : (
        <div className="card"><b>{st.storeName}</b><p className="muted">You can view these details but not change them.</p></div>
      )}
    </>
  );
}
