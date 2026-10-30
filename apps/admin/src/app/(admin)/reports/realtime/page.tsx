import type { Metadata } from "next";
import { getRealtimeStudioMetrics } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { ReportTabs } from "../components/report-tabs";
import { PageHeader } from "@biztrackbd/ui";
import { RealtimeStudioClient } from "./realtime-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Real-Time Performance Studio | Reports",
  description: "Live 24-hour velocity curve, 5-stage conversion funnel, and customer cohort retention.",
};

export default async function RealtimeStudioPage() {
  const s = await requireAccess("reports");
  const initialData = await getRealtimeStudioMetrics(s.tenantId, s.actor);

  return (
    <>
      <PageHeader
        title="Real-Time Performance Studio"
        crumbs={[{ label: "Reports", href: "/reports" }, { label: "Realtime" }]}
        badge={<span className="pill ok">Live Analytics</span>}
        sub="Sub-second sales velocity curves, 5-stage conversion drop-off funnel, and customer cohort retention."
      />

      <ReportTabs currentTab="realtime" />

      <RealtimeStudioClient initialData={initialData} />
    </>
  );
}
