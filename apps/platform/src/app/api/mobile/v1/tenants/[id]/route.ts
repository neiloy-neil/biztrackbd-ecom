import { NextResponse } from "next/server";
import {
  getTenantDetail,
  suspendTenant,
  reactivateTenant,
  extendTrial,
  addTenantNote,
  listTenantNotes,
} from "@biztrackbd/core";
import { getPlatformMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { id } = await params;
    const tenant = await getTenantDetail(session.actor, id);
    const notes = await listTenantNotes(session.actor, id).catch(() => []);

    return NextResponse.json({
      tenant,
      notes,
    });
  } catch (err: any) {
    console.error("Platform mobile tenant detail error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load tenant details." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "").toLowerCase();

    if (action === "suspend") {
      const reason = String(body.reason ?? "").trim();
      if (!reason || reason.length < 5) {
        return NextResponse.json(
          { error: "Suspension reason must be at least 5 characters." },
          { status: 400 }
        );
      }
      await suspendTenant(session.actor, id, reason);
      const updated = await getTenantDetail(session.actor, id);
      return NextResponse.json({ ok: true, message: "Store suspended successfully.", tenant: updated });
    }

    if (action === "reactivate") {
      await reactivateTenant(session.actor, id);
      const updated = await getTenantDetail(session.actor, id);
      return NextResponse.json({ ok: true, message: "Store reactivated successfully.", tenant: updated });
    }

    if (action === "extend_trial") {
      const days = parseInt(String(body.days ?? "14"), 10) || 14;
      const newTrialEnd = await extendTrial(session.actor, id, days);
      const updated = await getTenantDetail(session.actor, id);
      return NextResponse.json({ ok: true, message: `Trial extended by ${days} days.`, trialEndsAt: newTrialEnd, tenant: updated });
    }

    if (action === "add_note") {
      const noteBody = String(body.note ?? "").trim();
      if (!noteBody) {
        return NextResponse.json({ error: "Note cannot be empty." }, { status: 400 });
      }
      const note = await addTenantNote(session.actor, id, noteBody);
      return NextResponse.json({ ok: true, note });
    }

    return NextResponse.json({ error: `Unknown action '${action}'.` }, { status: 400 });
  } catch (err: any) {
    console.error("Platform mobile tenant action error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to perform action on tenant." },
      { status: 500 }
    );
  }
}
