import type { Metadata } from "next";
import Link from "next/link";
import { can, listCampaigns, getModuleStatus } from "@biztrackbd/core";
import { friendlyDate } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { NewCampaignModal } from "./new-campaign-modal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Broadcast Campaigns" };

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
        description="Broadcast targeted promotional SMS & Email campaigns to VIP segments and recover inactive customers."
      />
    );
  }

  const campaigns = await listCampaigns(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "marketing", "edit");
  const err = one(sp.err);
  const ok = one(sp.ok);

  const totalReached = campaigns.reduce((acc, c) => acc + c.recipientsCount, 0);
  const totalCredits = campaigns.reduce((acc, c) => acc + c.creditsUsed, 0);

  return (
    <>
      <Link href="/marketing" className="back" prefetch={false}>← Marketing</Link>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>Broadcast Campaigns</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            Promotional SMS and Email campaigns to drive repeat orders and sales.
          </p>
        </div>
        <div className="actions">
          {canEdit && <NewCampaignModal />}
        </div>
      </div>

      {err && <div className="notice bad" role="alert" style={{ marginBottom: 16 }}>{err}</div>}
      {ok === "sent" && <div className="notice good" role="status" style={{ marginBottom: 16 }}>Broadcast campaign dispatched successfully!</div>}

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="k">Total Campaigns</div>
          <div className="v num">{campaigns.length}</div>
        </div>
        <div className="stat">
          <div className="k">Customers Reached</div>
          <div className="v num">{totalReached.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="k">Total Credits Used</div>
          <div className="v num">{totalCredits.toLocaleString()}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Campaign History ({campaigns.length})</h2>
        </div>

        {campaigns.length === 0 ? (
          <div className="empty" style={{ padding: "32px 16px", textAlign: "center" }}>
            <p className="muted" style={{ margin: 0 }}>
              No broadcast campaigns sent yet. Click <b>+ New Broadcast</b> to launch your first promotional blast.
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
                  <th className="r">Recipients</th>
                  <th className="r">Credits</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                      {c.subject && <div className="muted" style={{ fontSize: 12 }}>Subject: {c.subject}</div>}
                    </td>
                    <td>
                      <span className={`pill ${c.channel === "SMS" ? "info" : "ok"}`} style={{ fontSize: 11 }}>
                        {c.channel}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {c.targetSegment}
                    </td>
                    <td className="r num">{c.recipientsCount.toLocaleString()}</td>
                    <td className="r num">{c.creditsUsed.toLocaleString()}</td>
                    <td>
                      <span className="pill ok" style={{ fontSize: 11 }}>
                        {c.status}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {friendlyDate(c.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
