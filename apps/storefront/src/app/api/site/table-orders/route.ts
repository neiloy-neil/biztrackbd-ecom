import { NextResponse, type NextRequest } from "next/server";
import { createTableOrder } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const requestId = "req_to_" + Math.random().toString(36).slice(2, 10);

  try {
    const store = await getStore();
    const body = await req.json().catch(() => ({}));

    const result = await createTableOrder(store.id, {
      table: body.table,
      customerPhone: body.customerPhone,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      notes: body.notes,
      items: body.items,
    });

    return NextResponse.json({
      ok: true,
      data: result,
      requestId,
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Failed to submit table order.",
        code: err.code || "BAD_REQUEST",
        field: err.data?.field,
        requestId,
      },
      { status }
    );
  }
}
