import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import {
  listInventory,
  adjustStock,
  STOCK_REASONS,
  type StockFilter,
  type AdjustInput,
} from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { searchParams } = new URL(req.url);
  const filter = (searchParams.get("filter") || "all") as StockFilter;
  const q = searchParams.get("q") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50", 10), 100);

  try {
    const result = await listInventory(session.tenantId, session.actor, {
      filter,
      q,
      page: isNaN(page) ? 1 : page,
      pageSize: isNaN(pageSize) ? 50 : pageSize,
    });

    return NextResponse.json({
      items: result.rows,
      summary: result.summary,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  } catch (err) {
    console.error("[Mobile Inventory GET Error]", err);
    return NextResponse.json({ error: "Failed to fetch inventory from database." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const body = await req.json();
    const { variantId, delta, setTo, reason = "CORRECTION", note = "Mobile rapid adjustment", isActive } = body;

    if (!variantId || typeof variantId !== "string") {
      return NextResponse.json({ error: "variantId is required" }, { status: 400 });
    }

    // Toggle active status if provided
    if (typeof isActive === "boolean") {
      await withTenant(session.tenantId, async (tx) => {
        return tx.productVariant.update({
          where: { id: variantId },
          data: { isActive },
        });
      });
    }

    // Adjust stock count if delta or setTo is provided
    if (typeof delta === "number" || typeof setTo === "number") {
      const validReason = STOCK_REASONS.includes(reason) ? reason : "CORRECTION";
      const adjustInput: AdjustInput = {
        reason: validReason,
        note,
        ...(typeof delta === "number" ? { delta } : { setTo }),
      };

      const adjusted = await adjustStock(session.tenantId, session.actor, variantId, adjustInput);
      return NextResponse.json({ success: true, adjusted, isActive });
    }

    return NextResponse.json({ success: true, isActive });
  } catch (err: any) {
    console.error("[Mobile Inventory POST Error]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update inventory in database." },
      { status: 500 }
    );
  }
}
