import { NextResponse, type NextRequest } from "next/server";
import { processSslCommerzOrderSuccess } from "@biztrackbd/core";
import { findStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * SSLCommerz Server-to-Server IPN (Instant Payment Notification).
 * Guarantees payment capture even if the shopper loses connection or closes their tab before returning.
 */
export async function POST(req: NextRequest) {
  const store = await findStore();
  let valId: string | null = null;
  let tenantId: string | null = null;

  try {
    const formData = await req.formData();
    valId = (formData.get("val_id") as string) || null;
    tenantId = (formData.get("value_a") as string) || null;
  } catch {
    try {
      const json = await req.json();
      valId = json.val_id || null;
      tenantId = json.value_a || null;
    } catch {
      // ignore
    }
  }

  valId = valId || req.nextUrl.searchParams.get("val_id");
  tenantId = tenantId || req.nextUrl.searchParams.get("tenantId") || store?.id || null;

  if (!valId || !tenantId) {
    return NextResponse.json({ ok: false, error: "Missing val_id or tenantId" }, { status: 400 });
  }

  try {
    const res = await processSslCommerzOrderSuccess(tenantId, valId);
    return NextResponse.json({
      ok: true,
      orderId: res.orderId,
      status: res.status,
    });
  } catch (err) {
    console.error("[sslcommerz-ipn] processing failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "IPN processing failed" },
      { status: 500 },
    );
  }
}
