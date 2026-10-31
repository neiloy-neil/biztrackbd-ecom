import { type NextRequest, NextResponse } from "next/server";
import { getCampaignAcquisitionMetrics } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const s = await requireAccess("marketing");
    const { searchParams } = req.nextUrl;

    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const touch = (searchParams.get("touch") as "first" | "last") || "last";

    const report = await getCampaignAcquisitionMetrics(s.tenantId, s.actor, {
      from,
      to,
      touch,
    });

    const rows: string[] = [];
    // Header
    rows.push(
      [
        "Campaign",
        "Source",
        "Medium",
        "Channel",
        "Orders",
        "Gross Revenue (BDT)",
        "Delivered Orders",
        "Delivered Revenue (BDT)",
        "Ad Spend (BDT)",
        "ROAS",
        "Delivered ROAS",
        "Net Profit (BDT)",
        "AOV (BDT)",
      ]
        .map((h) => `"${h}"`)
        .join(",")
    );

    // Data rows
    for (const c of report.campaigns) {
      rows.push(
        [
          c.name,
          c.source,
          c.medium,
          c.channelLabel,
          c.ordersCount,
          c.grossRevenue,
          c.deliveredCount,
          c.deliveredRevenue,
          c.adSpend,
          c.roas.toFixed(2),
          c.deliveredRoas.toFixed(2),
          c.netProfit,
          c.aov,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
    }

    const csvContent = rows.join("\r\n");
    const filename = `acquisition-report-${report.period.from}-to-${report.period.to}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[acquisition-csv-export] error", err);
    return NextResponse.json({ error: "Unauthorized or failed to generate report" }, { status: 500 });
  }
}
