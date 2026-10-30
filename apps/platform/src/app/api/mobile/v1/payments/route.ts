import { NextResponse } from "next/server";
import {
  listPayments,
  approveSubscriptionPayment,
  rejectSubscriptionPayment,
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
      return NextResponse.json({
        ok: true,
        message: "Payment approved and subscription extended successfully.",
        result,
      });
    }

    if (action === "reject") {
      const reason = String(body.reason ?? "").trim() || "TrxID verification failed or mismatched amount.";
      await rejectSubscriptionPayment(session.actor, proofId, reason);
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
