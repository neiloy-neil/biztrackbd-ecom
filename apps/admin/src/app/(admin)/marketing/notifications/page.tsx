import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@biztrackbd/ui";
import { can, listMessageTemplates, getModuleStatus } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { SmsBalanceCard } from "@/components/sms-balance-card";
import { NotificationCard } from "./notification-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Automated Lifecycle Notifications | Marketing",
};

export default async function MarketingNotificationsPage() {
  const s = await requireAccess("marketing");
  const mod = await getModuleStatus(s.tenantId, "marketing_campaigns");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="Automated Notifications"
        appKey="marketing_campaigns"
        planTier={mod.planTier}
        minPlan="PRO"
        description="Automate order lifecycle SMS notifications for order confirmations, courier booking, and delivery reviews."
      />
    );
  }

  const { templates, storeName } = await listMessageTemplates(
    s.tenantId,
    s.actor
  );
  const canEdit = can(s.user.role, "marketing", "edit");

  const orderMessages = templates.filter((t) => !t.alwaysOn);
  const recoveryMessages = templates.filter((t) => t.alwaysOn);

  return (
    <>
      <PageHeader
        title="Automated Notifications"
        crumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Notifications" }]}
        sub="Trigger real-time transactional SMS and WhatsApp alerts to buyers as their order progresses."
        actions={
          <Link href="/marketing/campaigns" className="btn btn-secondary">
            Broadcast Campaigns &rarr;
          </Link>
        }
      />

      <SmsBalanceCard tenantId={s.tenantId} actor={s.actor} canBuy={can(s.user.role, "billing", "edit")} />

      {!canEdit && (
        <div className="notice mb-md">
          You have view-only access to automated notification templates.
        </div>
      )}

      {/* Order Progression Alerts */}
      <div className="mb-lg">
        <h2 className="text-base font-bold mb-xs">
          Order Lifecycle Alerts
        </h2>
        <p className="muted text-sm m-0 mb-md">
          Sent instantly to customer phones when their order status changes in BizTrack.
        </p>

        <div className="stack gap-md">
          {orderMessages.map((t) => (
            <NotificationCard
              key={t.event}
              template={t}
              storeName={storeName}
              canEdit={canEdit}
            />
          ))}
        </div>
      </div>

      {/* Abandoned Cart Recovery Alerts */}
      <div className="mb-lg">
        <h2 className="text-base font-bold mb-xs">
          Abandoned Checkout Recovery
        </h2>
        <p className="muted text-sm m-0 mb-md">
          Sent when a prospective shopper abandons their cart with an auto-generated 1-click recovery link.
        </p>

        <div className="stack gap-md">
          {recoveryMessages.map((t) => (
            <NotificationCard
              key={t.event}
              template={t}
              storeName={storeName}
              canEdit={canEdit}
            />
          ))}
        </div>
      </div>
    </>
  );
}
