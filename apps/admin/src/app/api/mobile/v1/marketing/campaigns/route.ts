import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { withTenant } from "@biztrackbd/db";
import {
  enqueueNotificationJob,
  consumeSmsCredit,
  smsParts,
  normalizeBdPhone,
} from "@biztrackbd/core";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/v1/marketing/campaigns
 * Broadcasts an SMS marketing or retention campaign to a targeted audience.
 * Body: {
 *   segment: "vip" | "at_risk" | "all" | "custom";
 *   phones?: string[];
 *   message: string;
 *   couponCode?: string;
 * }
 */
export async function POST(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const body = await req.json();
    const segment = String(body.segment || "all");
    const customPhones: string[] = Array.isArray(body.phones) ? body.phones : [];
    const rawMessage = String(body.message || "").trim();
    const couponCode = body.couponCode ? String(body.couponCode).trim() : null;

    if (!rawMessage) {
      return NextResponse.json({ error: "SMS message text is required" }, { status: 400 });
    }

    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

    const result = await withTenant(session.tenantId, async (tx) => {
      // 1. Resolve recipients based on segment
      let recipientPhones: string[] = [];

      if (segment === "custom" && customPhones.length > 0) {
        recipientPhones = customPhones;
      } else {
        const customers = await tx.customer.findMany({
          where: { isBlacklisted: false },
          select: {
            phone: true,
            totalOrders: true,
            totalSpent: true,
            createdAt: true,
            orders: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: { createdAt: true },
            },
          },
        });

        if (segment === "vip") {
          recipientPhones = customers
            .filter((c) => c.totalOrders >= 2 || Number(c.totalSpent) >= 3000)
            .map((c) => c.phone);
        } else if (segment === "at_risk") {
          recipientPhones = customers
            .filter((c) => {
              const lastOrder = c.orders[0]?.createdAt || c.createdAt;
              return c.totalOrders > 0 && new Date(lastOrder) < fortyFiveDaysAgo;
            })
            .map((c) => c.phone);
        } else {
          // 'all'
          recipientPhones = customers.map((c) => c.phone);
        }
      }

      // Normalize phone numbers & remove duplicates
      const validPhones = [
        ...new Set(
          recipientPhones
            .map((p) => {
              try {
                return normalizeBdPhone(p);
              } catch {
                return null;
              }
            })
            .filter(Boolean) as string[]
        ),
      ];

      if (validPhones.length === 0) {
        throw new Error("No valid recipient phone numbers found for this segment.");
      }

      // Check opt-outs
      const optOuts = await tx.smsOptOut.findMany({
        where: { phone: { in: validPhones } },
        select: { phone: true },
      });
      const optOutSet = new Set(optOuts.map((o) => o.phone));
      const targetPhones = validPhones.filter((p) => !optOutSet.has(p));

      if (targetPhones.length === 0) {
        throw new Error("All recipient numbers in this segment have opted out of SMS marketing.");
      }

      // 2. Calculate SMS parts
      const partsCalc = smsParts(rawMessage);
      const parts = partsCalc.parts;
      const totalCreditsRequired = targetPhones.length * parts;

      // 3. Consume credits atomically
      for (let i = 0; i < totalCreditsRequired; i++) {
        const consumed = await consumeSmsCredit(tx, session.tenantId);
        if (!consumed) {
          throw new Error(
            `Insufficient SMS credits. Required: ${totalCreditsRequired} credits for ${targetPhones.length} recipients (${parts} SMS parts each).`
          );
        }
      }

      // 4. Enqueue notification jobs
      for (const phone of targetPhones) {
        await enqueueNotificationJob({
          tenantId: session.tenantId,
          recipient: phone,
          body: rawMessage,
          channel: "SMS",
          event: "MARKETING_CAMPAIGN",
        });
      }

      return {
        recipientsCount: targetPhones.length,
        partsPerMessage: parts,
        totalCreditsDeducted: totalCreditsRequired,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to dispatch SMS campaign";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
