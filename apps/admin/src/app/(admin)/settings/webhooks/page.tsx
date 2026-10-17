import type { Metadata } from "next";
import { can, getMerchantWebhookOverview } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { WebhookForm } from "./webhook-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Webhook Integrations — BizTrack Admin",
};

export default async function WebhooksPage() {
  const s = await requireAccess("design");
  const canEdit = can(s.user.role, "design", "edit");
  const overview = await getMerchantWebhookOverview(s.tenantId, s.actor);

  return (
    <>
      <div className="page-head">
        <h1>Webhook Integrations</h1>
      </div>
      <p className="page-sub">
        Receive real-time signed HTTP POST payloads whenever critical business events occur in your store,
        including order checkouts, parcel deliveries, quotation leads, and appointment bookings.
      </p>

      {!canEdit && (
        <div className="notice" style={{ marginBottom: 16 }}>
          You have view-only access to webhook settings. Contact the store owner to make changes.
        </div>
      )}

      <WebhookForm overview={overview} canEdit={canEdit} />
    </>
  );
}
