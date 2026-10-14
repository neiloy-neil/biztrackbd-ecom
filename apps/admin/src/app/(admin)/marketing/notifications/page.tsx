import type { Metadata } from "next";
import Link from "next/link";
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
      <div
        className="page-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link
              href="/marketing"
              className="muted"
              style={{ textDecoration: "none", fontSize: 13 }}
            >
              Marketing
            </Link>
            <span className="muted">/</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Notifications</span>
          </div>
          <h1 style={{ margin: 0 }}>Automated Notifications</h1>
          <p className="page-sub" style={{ margin: "4px 0 0" }}>
            Trigger real-time transactional SMS and WhatsApp alerts to buyers as their order progresses.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/marketing/campaigns" className="btn btn-secondary">
            Broadcast Campaigns &rarr;
          </Link>
        </div>
      </div>

      {/* SMS Credits Status Card */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          marginBottom: 24,
          background: "linear-gradient(135deg, rgba(37,99,235,0.04) 0%, rgba(79,70,229,0.06) 100%)",
          border: "1px solid rgba(37,99,235,0.15)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>
              Monthly SMS Balance
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
              {smsCredits.limit == null
                ? `${smsCredits.used} SMS sent (Unlimited Tier)`
                : `${smsCredits.used.toLocaleString()} / ${smsCredits.limit.toLocaleString()} credits used`}
            </div>
          </div>
          {smsCredits.limit != null && (
            <div style={{ textAlign: "right" }}>
              <span className={`pill ${percentUsed > 85 ? "orange" : "green"}`}>
                {Math.max(0, smsCredits.limit - smsCredits.used).toLocaleString()} credits remaining
              </span>
            </div>
          )}
        </div>

        {smsCredits.limit != null && (
          <div
            style={{
              width: "100%",
              height: 6,
              background: "#e2e8f0",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${percentUsed}%`,
                height: "100%",
                background: percentUsed > 85 ? "#f59e0b" : "#2563eb",
                borderRadius: 3,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}
      </div>

      {!canEdit && (
        <div className="notice" style={{ marginBottom: 16 }}>
          You have view-only access to automated notification templates.
        </div>
      )}

      {/* Order Progression Alerts */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
          Order Lifecycle Alerts
        </h2>
        <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px" }}>
          Sent instantly to customer phones when their order status changes in BizTrack.
        </p>

        <div className="stack" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
          Abandoned Checkout Recovery
        </h2>
        <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px" }}>
          Sent when a prospective shopper abandons their cart with an auto-generated 1-click recovery link.
        </p>

        <div className="stack" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
