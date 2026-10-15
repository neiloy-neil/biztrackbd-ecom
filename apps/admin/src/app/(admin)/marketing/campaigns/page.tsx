import type { Metadata } from "next";
import Link from "next/link";
import {
  can,
  listCampaigns,
  getModuleStatus,
  getWhatsAppConfig,
  type CampaignChannel,
} from "@biztrackbd/core";
import { friendlyDate } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { NewCampaignModal } from "./new-campaign-modal";
import { CampaignCancelButton } from "./campaign-cancel-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Broadcast Campaigns & Bulk Marketing" };

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const s = await requireAccess("marketing");
  const mod = await getModuleStatus(s.tenantId, "marketing_campaigns");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="Marketing Command Center & Campaigns"
        appKey="marketing_campaigns"
        planTier={mod.planTier}
        minPlan="PRO"
        description="Broadcast targeted promotional SMS, Email & WhatsApp campaigns to VIP segments and recover inactive customers."
      />
    );
  }

  const channelFilter = (one(sp.channel) as CampaignChannel | undefined) || undefined;

  const [campaigns, waConfig] = await Promise.all([
    listCampaigns(s.tenantId, s.actor, channelFilter),
    getWhatsAppConfig(s.tenantId),
  ]);

  const canEdit = can(s.user.role, "marketing", "edit");
  const err = one(sp.err);
  const ok = one(sp.ok);

  const totalReached = campaigns.reduce((acc, c) => acc + c.recipientsCount, 0);
  const totalCredits = campaigns.reduce((acc, c) => acc + c.creditsUsed, 0);
  const waCampaignsCount = campaigns.filter((c) => c.channel === "WHATSAPP").length;

  return (
    <>
      <Link href="/marketing" className="back" prefetch={false}>← Marketing</Link>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span>Broadcast Campaigns</span>
            <span
              className="pill"
              style={{
                fontSize: 12,
                background: waConfig.status === "CONNECTED" ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                color: waConfig.status === "CONNECTED" ? "#065F46" : "#B45309",
                border: `1px solid ${waConfig.status === "CONNECTED" ? "#10B981" : "#F59E0B"}`,
              }}
            >
              {waConfig.status === "CONNECTED" ? "🟢 WhatsApp Ready" : "⚠️ WhatsApp Offline"}
            </span>
          </h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            Targeted promotional broadcasts across WhatsApp, SMS, and Email with anti-ban pacing and automated cart recovery.
          </p>
        </div>
        <div className="actions">
          {canEdit && (
            <NewCampaignModal
              isWhatsAppConnected={waConfig.status === "CONNECTED"}
              whatsAppNumber={waConfig.phoneNumber}
            />
          )}
        </div>
      </div>

      {err && <div className="notice bad" role="alert" style={{ marginBottom: 16 }}>{err}</div>}
      {ok === "sent" && <div className="notice good" role="status" style={{ marginBottom: 16 }}>Broadcast campaign dispatched successfully!</div>}
      {ok === "scheduled" && <div className="notice good" role="status" style={{ marginBottom: 16 }}>Broadcast campaign scheduled successfully!</div>}

      {/* 4-Stat KPI Grid */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="k">Total Campaigns</div>
          <div className="v num">{campaigns.length}</div>
        </div>
        <div className="stat">
          <div className="k">Customers Reached</div>
          <div className="v num">{totalReached.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="k">WhatsApp Blasts</div>
          <div className="v num" style={{ color: "#059669" }}>{waCampaignsCount}</div>
        </div>
        <div className="stat">
          <div className="k">SMS Credits Used</div>
          <div className="v num">{totalCredits.toLocaleString()}</div>
        </div>
      </div>

      {/* Channel Filter Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--line, #E2E8F0)", paddingBottom: 8 }}>
        <Link
          href="/marketing/campaigns"
          className={`btn btn-sm ${!channelFilter ? "btn-primary" : "btn-secondary"}`}
          prefetch={false}
        >
          All Channels
        </Link>
        <Link
          href="/marketing/campaigns?channel=WHATSAPP"
          className={`btn btn-sm ${channelFilter === "WHATSAPP" ? "btn-primary" : "btn-secondary"}`}
          prefetch={false}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <span>📱</span> WhatsApp
        </Link>
        <Link
          href="/marketing/campaigns?channel=SMS"
          className={`btn btn-sm ${channelFilter === "SMS" ? "btn-primary" : "btn-secondary"}`}
          prefetch={false}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <span>💬</span> SMS
        </Link>
        <Link
          href="/marketing/campaigns?channel=EMAIL"
          className={`btn btn-sm ${channelFilter === "EMAIL" ? "btn-primary" : "btn-secondary"}`}
          prefetch={false}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <span>✉️</span> Email
        </Link>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Campaign History ({campaigns.length})</h2>
        </div>

        {campaigns.length === 0 ? (
          <div className="empty" style={{ padding: "36px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📢</div>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              No broadcast campaigns found. Click <b>+ New Broadcast</b> to launch your first promotional blast.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Channel</th>
                  <th>Target Audience</th>
                  <th className="r">Progress</th>
                  <th className="r">Credits</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const isScheduled = c.status === "SCHEDULED";
                  const isWhatsApp = c.channel === "WHATSAPP";
                  const isSms = c.channel === "SMS";

                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        {c.subject && <div className="muted" style={{ fontSize: 11.5 }}>Subject: {c.subject}</div>}
                        {c.couponCode && (
                          <span
                            style={{
                              fontSize: 10.5,
                              background: "rgba(99, 102, 241, 0.1)",
                              color: "#4338CA",
                              padding: "1px 5px",
                              borderRadius: 4,
                              fontWeight: 600,
                              display: "inline-block",
                              marginTop: 2,
                            }}
                          >
                            🏷️ Code: {c.couponCode}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className="pill"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            background: isWhatsApp
                              ? "rgba(16, 185, 129, 0.15)"
                              : isSms
                              ? "rgba(2, 132, 199, 0.15)"
                              : "rgba(100, 116, 139, 0.15)",
                            color: isWhatsApp
                              ? "#047857"
                              : isSms
                              ? "#0369A1"
                              : "#334155",
                          }}
                        >
                          {isWhatsApp ? "📱 WhatsApp" : isSms ? "💬 SMS" : "✉️ Email"}
                        </span>
                      </td>
                      <td className="muted" style={{ fontSize: 12.5 }}>
                        {c.targetSegment === "ABANDONED_CART" ? "🛒 Abandoned Cart" : c.targetSegment}
                      </td>
                      <td className="r num" style={{ fontSize: 13 }}>
                        <b>{c.sentCount > 0 ? c.sentCount : c.recipientsCount}</b> / {c.recipientsCount}
                        {c.failedCount > 0 && (
                          <div style={{ fontSize: 11, color: "#DC2626" }}>({c.failedCount} failed)</div>
                        )}
                      </td>
                      <td className="r num">{c.creditsUsed.toLocaleString()}</td>
                      <td>
                        <span
                          className={`pill ${
                            c.status === "SENT"
                              ? "ok"
                              : isScheduled
                              ? "warn"
                              : c.status === "CANCELLED"
                              ? "bad"
                              : "info"
                          }`}
                          style={{ fontSize: 11, fontWeight: 600 }}
                        >
                          {c.status}
                        </span>
                        {isScheduled && c.scheduledFor && (
                          <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>
                            {friendlyDate(c.scheduledFor)}
                          </div>
                        )}
                      </td>
                      <td className="muted" style={{ fontSize: 12.5 }}>
                        {friendlyDate(c.sentAt || c.createdAt)}
                      </td>
                      <td className="r">
                        {isScheduled && canEdit ? (
                          <CampaignCancelButton campaignId={c.id} />
                        ) : (
                          <span className="muted" style={{ fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
