import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@biztrackbd/ui";
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
      <PageHeader
        title="Broadcast Campaigns"
        crumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Campaigns" }]}
        badge={
          <span className={`pill ${waConfig.status === "CONNECTED" ? "ok" : "warn"}`}>
            {waConfig.status === "CONNECTED" ? "WhatsApp Ready" : "WhatsApp Offline"}
          </span>
        }
        sub="Targeted promotional broadcasts across WhatsApp, SMS, and Email with anti-ban pacing and automated cart recovery."
        actions={
          canEdit ? (
            <NewCampaignModal
              isWhatsAppConnected={waConfig.status === "CONNECTED"}
              whatsAppNumber={waConfig.phoneNumber}
            />
          ) : undefined
        }
      />

      {err && <div className="notice bad mb-md" role="alert">{err}</div>}
      {ok === "sent" && <div className="notice good mb-md" role="status">Broadcast campaign dispatched successfully!</div>}
      {ok === "scheduled" && <div className="notice good mb-md" role="status">Broadcast campaign scheduled successfully!</div>}

      {/* 4-Stat KPI Grid */}
      <div className="grid grid-4 mb-md">
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
          <div className="v num text-success">{waCampaignsCount}</div>
        </div>
        <div className="stat">
          <div className="k">SMS Credits Used</div>
          <div className="v num">{totalCredits.toLocaleString()}</div>
        </div>
      </div>

      {/* Channel Filter Tabs */}
      <div className="tab-strip mb-md">
        <Link
          href="/marketing/campaigns"
          className={`tab-item ${!channelFilter ? "active" : ""}`}
          prefetch={false}
        >
          All Channels
        </Link>
        <Link
          href="/marketing/campaigns?channel=WHATSAPP"
          className={`tab-item ${channelFilter === "WHATSAPP" ? "active" : ""}`}
          prefetch={false}
        >
          WhatsApp
        </Link>
        <Link
          href="/marketing/campaigns?channel=SMS"
          className={`tab-item ${channelFilter === "SMS" ? "active" : ""}`}
          prefetch={false}
        >
          SMS
        </Link>
        <Link
          href="/marketing/campaigns?channel=EMAIL"
          className={`tab-item ${channelFilter === "EMAIL" ? "active" : ""}`}
          prefetch={false}
        >
          Email
        </Link>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="text-base font-bold m-0">Campaign History ({campaigns.length})</h2>
        </div>

        {campaigns.length === 0 ? (
          <div className="empty p-xl text-center">
            <p className="muted text-sm m-0">
              No broadcast campaigns found. Click <b>+ New Broadcast</b> to launch your first promotional blast.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
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
                        <div className="font-semibold">{c.name}</div>
                        {c.subject && <div className="muted text-xs">Subject: {c.subject}</div>}
                        {c.couponCode && (
                          <span className="pill info text-xs mt-xs">
                            Code: {c.couponCode}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${isWhatsApp ? "ok" : isSms ? "info" : "grey"}`}>
                          {isWhatsApp ? "WhatsApp" : isSms ? "SMS" : "Email"}
                        </span>
                      </td>
                      <td className="muted text-sm">
                        {c.targetSegment === "ABANDONED_CART" ? "Abandoned Cart" : c.targetSegment}
                      </td>
                      <td className="r num text-sm">
                        <b>{c.sentCount > 0 ? c.sentCount : c.recipientsCount}</b> / {c.recipientsCount}
                        {c.failedCount > 0 && (
                          <div className="text-xs text-error">({c.failedCount} failed)</div>
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
                        >
                          {c.status}
                        </span>
                        {isScheduled && c.scheduledFor && (
                          <div className="muted text-xs mt-xs">
                            {friendlyDate(c.scheduledFor)}
                          </div>
                        )}
                      </td>
                      <td className="muted text-sm">
                        {friendlyDate(c.sentAt || c.createdAt)}
                      </td>
                      <td className="r">
                        {isScheduled && canEdit ? (
                          <CampaignCancelButton campaignId={c.id} />
                        ) : (
                          <span className="muted text-xs">—</span>
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
