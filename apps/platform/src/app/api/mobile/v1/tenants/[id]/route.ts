import { NextResponse } from "next/server";
import {
  getTenantDetail,
  suspendTenant,
  reactivateTenant,
  extendTrial,
  addTenantNote,
  listTenantNotes,
  changePlan,
  currentSmsSender,
  recordTenantCrmActivity,
  updateTenantLeadStage,
  scheduleTenantFollowUp,
} from "@biztrackbd/core";
import type { TenantLeadStage, TenantCrmActivityType } from "@biztrackbd/db";
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
      crmActivities: tenant?.crmActivities ?? [],
      leadStage: tenant?.leadStage ?? "NEW",
      leadLastContactedAt: tenant?.leadLastContactedAt ?? null,
      leadNextFollowUpAt: tenant?.leadNextFollowUpAt ?? null,
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

    if (action === "record_crm_activity") {
      const type = (body.type ?? "WHATSAPP") as TenantCrmActivityType;
      const outcome = body.outcome ? String(body.outcome) : undefined;
      const templateKey = body.templateKey ? String(body.templateKey) : undefined;
      const notes = body.notes ? String(body.notes) : undefined;
      const autoAdvanceStage = body.autoAdvanceStage !== false;

      const activity = await recordTenantCrmActivity(session.actor, id, {
        type,
        outcome,
        templateKey,
        notes,
        autoAdvanceStage,
      });

      const updated = await getTenantDetail(session.actor, id);
      return NextResponse.json({ ok: true, activity, tenant: updated });
    }

    if (action === "update_lead_stage") {
      const stage = String(body.stage ?? "").toUpperCase() as TenantLeadStage;
      const validStages: TenantLeadStage[] = [
        "NEW",
        "CONTACTED",
        "DEMO_IN_PROGRESS",
        "HOT_LEAD",
        "CONVERTED",
        "LOST",
      ];
      if (!validStages.includes(stage)) {
        return NextResponse.json(
          { error: `Invalid lead stage '${stage}'. Valid stages are: ${validStages.join(", ")}` },
          { status: 400 }
        );
      }
      const notes = body.notes ? String(body.notes) : undefined;
      await updateTenantLeadStage(session.actor, id, stage, notes);
      const updated = await getTenantDetail(session.actor, id);
      return NextResponse.json({ ok: true, stage, tenant: updated });
    }

    if (action === "schedule_follow_up") {
      const followUpRaw = body.followUpAt;
      const followUpAt = followUpRaw ? new Date(followUpRaw) : null;
      const notes = body.notes ? String(body.notes) : undefined;
      await scheduleTenantFollowUp(session.actor, id, followUpAt, notes);
      const updated = await getTenantDetail(session.actor, id);
      return NextResponse.json({ ok: true, followUpAt, tenant: updated });
    }

    if (action === "change_plan") {
      const tier = String(body.planTier ?? "").toUpperCase() as "STARTER" | "PRO" | "BUSINESS";
      if (!["STARTER", "PRO", "BUSINESS"].includes(tier)) {
        return NextResponse.json({ error: "Invalid plan tier. Choose STARTER, PRO, or BUSINESS." }, { status: 400 });
      }
      await changePlan(session.actor, id, tier);
      const updated = await getTenantDetail(session.actor, id);

      if (updated?.ownerPhone) {
        const smsSender = currentSmsSender();
        if (smsSender) {
          smsSender.send(
            id,
            updated.ownerPhone,
            `অভিনন্দন! আপনার BizTrackBD স্টোর (${updated.name}) সফলভাবে ${tier} প্ল্যানে উন্নীত হয়েছে। BizTrackBD`
          ).catch(() => {});
        }
      }

      return NextResponse.json({ ok: true, message: `Store upgraded to ${tier} plan.`, tenant: updated });
    }

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

      if (updated?.ownerPhone) {
        const smsSender = currentSmsSender();
        if (smsSender) {
          smsSender.send(
            id,
            updated.ownerPhone,
            `বিজ্ঞপ্তি: আপনার BizTrackBD স্টোর সাময়িকভাবে স্থগিত করা হয়েছে। কারণ: ${reason}। অনুসন্ধানের জন্য আমাদের সাথে যোগাযোগ করুন।`
          ).catch(() => {});
        }
      }

      return NextResponse.json({ ok: true, message: "Store suspended successfully.", tenant: updated });
    }

    if (action === "reactivate") {
      await reactivateTenant(session.actor, id);
      const updated = await getTenantDetail(session.actor, id);

      if (updated?.ownerPhone) {
        const smsSender = currentSmsSender();
        if (smsSender) {
          smsSender.send(
            id,
            updated.ownerPhone,
            `আপনার BizTrackBD স্টোর (${updated.name}) সফলভাবে পুনরায় সক্রিয় করা হয়েছে। শুভ ব্যবসা!`
          ).catch(() => {});
        }
      }

      return NextResponse.json({ ok: true, message: "Store reactivated successfully.", tenant: updated });
    }

    if (action === "extend_trial") {
      const days = parseInt(String(body.days ?? "14"), 10) || 14;
      const newTrialEnd = await extendTrial(session.actor, id, days);
      const updated = await getTenantDetail(session.actor, id);

      if (updated?.ownerPhone) {
        const smsSender = currentSmsSender();
        if (smsSender) {
          smsSender.send(
            id,
            updated.ownerPhone,
            `আপনার BizTrackBD স্টোরের (${updated.name}) ট্রায়াল মেয়াদ আরও ${days} দিন বৃদ্ধি করা হয়েছে। BizTrackBD`
          ).catch(() => {});
        }
      }

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
