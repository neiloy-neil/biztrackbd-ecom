import type { Metadata } from "next";
import Link from "next/link";
import { getCampaignAcquisitionMetrics, resolveReportRange } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { ReportTabs } from "../components/report-tabs";
import { AcquisitionClient } from "./acquisition-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ad Campaigns & ROAS | Reports" };

export default async function AcquisitionReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const s = await requireAccess("reports");

  const rangeParam = one(sp.range) || "30d";
  const fromParam = one(sp.from);
  const toParam = one(sp.to);
  const touchParam = (one(sp.touch) as "first" | "last") || "last";
  const channelParam = one(sp.channel) || "ALL";
  const searchParam = one(sp.search) || "";

  const resolved = resolveReportRange({ range: rangeParam, from: fromParam, to: toParam });

  const report = await getCampaignAcquisitionMetrics(s.tenantId, s.actor, {
    from: resolved.from,
    to: resolved.to,
    touch: touchParam,
    channel: channelParam,
    search: searchParam,
  });

  const queryString = `range=${rangeParam}&from=${resolved.from}&to=${resolved.to}&touch=${touchParam}`;

  return (
    <>
      <PageHeader
        title="Ad Campaigns & ROAS"
        crumbs={[{ label: "Home", href: "/" }, { label: "Reports", href: "/reports" }, { label: "Acquisition & ROAS" }]}
        sub="Track UTM ad campaigns, calculated ROAS (Revenue ÷ Ad Spend), multi-channel customer acquisition, and Meta CAPI conversion sync."
        actions={
          <div className="flex-center-y gap-xs">
            <Link href="/marketing/pixels" className="btn btn-secondary btn-sm">
              ⚙️ Meta Pixel & CAPI
            </Link>
            <a
              className="btn btn-primary btn-sm"
              href={`/reports/acquisition/export?from=${resolved.from}&to=${resolved.to}&touch=${touchParam}`}
              download
            >
              📥 Export CSV
            </a>
          </div>
        }
      />

      <ReportTabs currentTab="acquisition" queryString={queryString} />

      <AcquisitionClient
        report={report}
        currentRange={rangeParam}
        currentChannel={channelParam}
        currentSearch={searchParam}
      />
    </>
  );
}
