import { NextResponse } from "next/server";
import {
  listPayments,
  approveSubscriptionPayment,
  rejectSubscriptionPayment,
  getTenantDetail,
  currentSmsSender,
} from "@biztrackbd/core";
import { getPlatformMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const filterStatus = (searchParams.get("status")?.toUpperCase() as any) || "PENDING";
    const payments = await listPayments(session.actor, filterStatus);

    return NextResponse.json({ payments });
  } catch (err: any) {
    console.error("Platform mobile payments error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load subscription payment queue." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "").toLowerCase();
    const proofId = String(body.proofId ?? "").trim();

    if (!proofId) {
      return NextResponse.json({ error: "proofId is required." }, { status: 400 });
    }

    if (action === "approve") {
      const result = await approveSubscriptionPayment(session.actor, proofId);

      // Notify the store owner via SMS
      if (result?.tenantId) {
        const tenant = await getTenantDetail(session.actor, result.tenantId).catch(() => null);
        if (tenant?.ownerPhone) {
          const smsSender = currentSmsSender();
          if (smsSender) {
            const expiry = result.periodEnd
              ? new Date(result.periodEnd).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })
              : "";
            smsSender.send(
              result.tenantId,
              tenant.ownerPhone,
              `অভিনন্দন! আপনার BizTrackBD ${result.plan} সাবস্ক্রিপশন পেমেন্ট অনুমোদিত হয়েছে। মেয়াদ: ${expiry}। BizTrackBD`
            ).catch(() => {});
          }
        }
      }

      return NextResponse.json({
        ok: true,
        message: "Payment approved and subscription extended successfully.",
        result,
      });
    }

    if (action === "reject") {
      const reason = String(body.reason ?? "").trim() || "TrxID verification failed or mismatched amount.";
      await rejectSubscriptionPayment(session.actor, proofId, reason);

      if (body.tenantId) {
        const tenant = await getTenantDetail(session.actor, body.tenantId).catch(() => null);
        if (tenant?.ownerPhone) {
          const smsSender = currentSmsSender();
          if (smsSender) {
            smsSender.send(
              body.tenantId,
              tenant.ownerPhone,
              `আপনার BizTrackBD পেমেন্ট ভেরিফিকেশন বাতিল হয়েছে। কারণ: ${reason}। সহায়তার জন্য যোগাযোগ করুন: BizTrackBD`
            ).catch(() => {});
          }
        }
      }

      return NextResponse.json({
        ok: true,
        message: "Payment proof rejected.",
      });
    }

    return NextResponse.json({ error: `Unknown payment action '${action}'.` }, { status: 400 });
  } catch (err: any) {
    console.error("Platform mobile payment decision error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process payment approval." },
      { status: 500 }
    );
  }
}
