import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@biztrackbd/ui";
import { can, listMessageTemplates, getModuleStatus } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
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

  const { templates, storeName, smsCredits } = await listMessageTemplates(
    s.tenantId,
    s.actor
  );
  const canEdit = can(s.user.role, "marketing", "edit");

  const orderMessages = templates.filter((t) => !t.alwaysOn);
  const recoveryMessages = templates.filter((t) => t.alwaysOn);

  const percentUsed =
    smsCredits.limit && smsCredits.limit > 0
      ? Math.min(100, Math.round((smsCredits.used / smsCredits.limit) * 100))
      : 0;

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

      {/* SMS Credits Status Card */}
      <div className="card p-md mb-lg bg-subtle border">
        <div className="flex-between items-center flex-wrap gap-md mb-sm">
          <div>
            <div className="text-xs font-bold text-primary uppercase">
              Monthly SMS Balance
            </div>
            <div className="text-xl font-bold text-ink">
              {smsCredits.limit == null
                ? `${smsCredits.used} SMS sent (Unlimited Tier)`
                : `${smsCredits.used.toLocaleString()} / ${smsCredits.limit.toLocaleString()} credits used`}
            </div>
          </div>
          {smsCredits.limit != null && (
            <div className="text-right">
              <span className={`pill ${percentUsed > 85 ? "warn" : "ok"}`}>
                {Math.max(0, smsCredits.limit - smsCredits.used).toLocaleString()} credits remaining
              </span>
            </div>
          )}
        </div>

        {smsCredits.limit != null && (
          <div className="meter-track">
            <div
              className={`meter-fill ${percentUsed > 85 ? "bg-warning" : "bg-primary"}`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        )}
      </div>

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
