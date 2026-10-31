import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { withTenant } from "@biztrackbd/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/coupons
 * Returns active and past coupons for the current store.
 */
export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const coupons = await withTenant(session.tenantId, async (tx) => {
      const rows = await tx.coupon.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return rows.map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        value: Number(c.value),
        minOrderValue: c.minOrderValue ? Number(c.minOrderValue) : null,
        usageLimit: c.usageLimit,
        usageCount: c.usageCount,
        startsAt: c.startsAt,
        expiresAt: c.expiresAt,
        isActive: c.isActive,
        createdAt: c.createdAt,
      }));
    });

    return NextResponse.json({ coupons });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load coupons";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/mobile/v1/coupons
 * Creates a new discount coupon.
 * Body: { code: string; type: "PERCENTAGE" | "FIXED_AMOUNT"; value: number; minOrderValue?: number; expiryDays?: number; usageLimit?: number }
 */
export async function POST(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const body = await req.json();
    const rawCode = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const type = body.type === "PERCENTAGE" ? "PERCENTAGE" : "FIXED_AMOUNT";
    const value = Number(body.value);
    const minOrderValue = body.minOrderValue ? Number(body.minOrderValue) : null;
    const expiryDays = body.expiryDays ? Number(body.expiryDays) : 30;
    const usageLimit = body.usageLimit ? Number(body.usageLimit) : null;

    if (!rawCode || rawCode.length < 3) {
      return NextResponse.json({ error: "Coupon code must be at least 3 characters" }, { status: 400 });
    }
    if (isNaN(value) || value <= 0) {
      return NextResponse.json({ error: "Valid discount value is required" }, { status: 400 });
    }
    if (type === "PERCENTAGE" && value > 100) {
      return NextResponse.json({ error: "Percentage discount cannot exceed 100%" }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const created = await withTenant(session.tenantId, async (tx) => {
      // Check code uniqueness
      const existing = await tx.coupon.findFirst({
        where: { code: rawCode },
      });
      if (existing) {
        throw new Error(`Coupon code '${rawCode}' already exists.`);
      }

      const row = await tx.coupon.create({
        data: {
          tenantId: session.tenantId,
          code: rawCode,
          type,
          value,
          minOrderValue,
          usageLimit,
          startsAt: new Date(),
          expiresAt,
          isActive: true,
        },
      });

      return {
        id: row.id,
        code: row.code,
        type: row.type,
        value: Number(row.value),
        minOrderValue: row.minOrderValue ? Number(row.minOrderValue) : null,
        usageLimit: row.usageLimit,
        usageCount: 0,
        expiresAt: row.expiresAt,
        isActive: true,
      };
    });

    return NextResponse.json({
      success: true,
      coupon: created,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create coupon";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
