import type { Metadata } from "next";
import { getRealtimeStudioMetrics } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { ReportTabs } from "../components/report-tabs";
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
      <div className="page-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>⚡ Real-Time Performance Studio</h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: "12px",
                fontWeight: 700,
                background: "var(--success-bg)",
                color: "var(--success)",
                border: "1px solid color-mix(in srgb, var(--success) 30%, transparent)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "var(--success)",
                  boxShadow: "0 0 0 3px color-mix(in srgb, var(--success) 25%, transparent)",
                }}
              />
              LIVE ANALYTICS
            </span>
          </div>
          <p className="page-sub" style={{ margin: "4px 0 0" }}>
            Sub-second sales velocity curves, 5-stage conversion drop-off funnel, and customer cohort retention.
          </p>
        </div>
      </div>

      <ReportTabs currentTab="realtime" />

      <RealtimeStudioClient initialData={initialData} />
    </>
  );
}
