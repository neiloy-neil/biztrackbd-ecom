import { NextResponse, type NextRequest } from "next/server";
import { exportAccountingJournal } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAccess("reports");
  const { id } = await params;
  const csv = await exportAccountingJournal(s.tenantId, s.actor, id);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="journal-voucher-${id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
