import type { Metadata } from "next";
import Link from "next/link";
import { can, getStoreSettings } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { PageHeader } from "@biztrackbd/ui";
import { requireAccess } from "@/lib/session";
import { pauseAction } from "./actions";
import { StoreForm } from "./store-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store details" };

export default async function StoreDetails() {
  const s = await requireAccess("design");
  const st = await getStoreSettings(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "design", "edit");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000");
  return (
    <>
      <PageHeader
        title="Store details"
        crumbs={[{ label: "Settings", href: "/settings/store" }, { label: "Store details" }]}
        sub="This information appears on invoices, emails and your store footer."
      />
      <div className="card p-sm mb-md flex-between items-center" style={{ background: "var(--bg)", border: "1px solid var(--line)", flexWrap: "wrap", gap: 8 }}>
        <div className="row items-center gap-xs">
          <span className="muted text-xs">Store Address:</span>
          <code className="font-mono text-xs font-bold" style={{ color: "var(--brand, #0B4D3B)" }}>
            {s.tenantSubdomain}.{root}
          </code>
        </div>
        <Link href="/settings/domains" className="link text-xs font-bold" style={{ textDecoration: "none" }}>
          Change subdomain or custom domain →
        </Link>
      </div>
      {canEdit ? (
        <>
          <StoreForm initial={{
            storeName: st.storeName, storeNameBn: st.storeNameBn ?? "", tagline: st.tagline ?? "", description: st.description ?? "", contactPhone: st.contactPhone ?? "", whatsappNumber: st.whatsappNumber ?? "",
            email: st.email ?? "", facebookUrl: st.facebookUrl ?? "", instagramUrl: st.instagramUrl ?? "", addressLine: st.addressLine ?? "", pickupAddress: st.pickupAddress ?? "", logoUrl: st.logoUrl ?? "",
            announcement: st.announcement ?? "", announcementBn: st.announcementBn ?? "", orderPrefix: st.orderPrefix,
          }} />
          <section className="card mt-md" data-testid="pause-card">
            <h2 className="text-base font-bold mb-xs">Pause or reopen your store</h2>
            {st.ordersPaused ? (
              <form action={pauseAction.bind(null, false)} className="stack gap-sm">
                <div className="notice warn">Your store is paused. Customers can look around but cannot place orders.</div>
                <div>
                  <SubmitButton className="btn btn-primary" pending="Reopening…">Reopen the store</SubmitButton>
                </div>
              </form>
            ) : (
              <form action={pauseAction.bind(null, true)} className="stack gap-sm">
                <p className="muted text-sm m-0">Pausing stops new orders. Customers see a notice. Your products and existing orders are not affected.</p>
                <div>
                  <SubmitButton className="btn btn-danger" pending="Pausing…">Pause store</SubmitButton>
                </div>
              </form>
            )}
          </section>
        </>
      ) : (
        <div className="card p-md">
          <b className="text-base">{st.storeName}</b>
          <p className="muted text-sm mt-xs m-0">You can view these details but not change them.</p>
        </div>
      )}
    </>
  );
}
