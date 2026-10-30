import type { Metadata } from "next";
import { can, getMerchantWebhookOverview } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { PageHeader } from "@biztrackbd/ui";
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
      <PageHeader
        title="Webhook Integrations"
        crumbs={[{ label: "Home", href: "/" }, { label: "Settings" }, { label: "Webhooks" }]}
        sub="Receive real-time signed HTTP POST payloads whenever critical business events occur in your store, including order checkouts, parcel deliveries, quotation leads, and appointment bookings."
      />

      {!canEdit && (
        <div className="notice mb-3">
          You have view-only access to webhook settings. Contact the store owner to make changes.
        </div>
      )}

      <WebhookForm overview={overview} canEdit={canEdit} />
    </>
  );
}
