import { NextResponse, type NextRequest } from "next/server";
import { processUddoktaPayOrderSuccess } from "@biztrackbd/core";
import { findStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const store = await findStore();
  const tenantId = req.nextUrl.searchParams.get("tenantId") || store?.id;
  if (!tenantId) {
    return NextResponse.json({ status: false, error: "Store not found" }, { status: 404 });
  }

  try {
    const rawData = await req.json().catch(() => ({}));
    const invoiceId = rawData.invoice_id || rawData.invoiceId;

    if (!invoiceId) {
      return NextResponse.json({ status: false, error: "Missing invoice_id" }, { status: 400 });
    }

    const res = await processUddoktaPayOrderSuccess(tenantId, invoiceId);
    return NextResponse.json({ status: res.ok, orderId: res.orderId });
  } catch (err) {
    console.error("[uddoktapay-webhook] processing failed", err);
    return NextResponse.json({ status: false, error: "Processing error" }, { status: 500 });
  }
}
