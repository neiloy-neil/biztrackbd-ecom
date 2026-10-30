import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { withTenant } from "@biztrackbd/db";
import { createOrder, normalizeBdPhone } from "@biztrackbd/core";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const body = await req.json();
    const {
      name,
      phone,
      address,
      deliveryZone = "INSIDE_DHAKA",
      paymentMethod = "COD",
      itemQuery = "",
      variantId: suppliedVariantId,
      quantity = 1,
      notes,
    } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: "Customer phone is required" }, { status: 400 });
    }

    let cleanPhone = phone.trim().replace(/[^\d+]/g, "");
    try {
      cleanPhone = normalizeBdPhone(cleanPhone);
    } catch {
      // Keep cleaned numeric phone if normalization fails
    }

    if (!address || address.trim().length < 5) {
      return NextResponse.json({ error: "A valid delivery address is required (at least 5 characters)" }, { status: 400 });
    }

    // 1. Resolve variant to order
    let variantId = suppliedVariantId;
    if (!variantId) {
      // Find variant by SKU, title, or fallback to first active product variant
      const found = await withTenant(session.tenantId, async (tx) => {
        if (itemQuery && itemQuery.trim()) {
          const match = await tx.productVariant.findFirst({
            where: {
              isActive: true,
              OR: [
                { sku: { contains: itemQuery.trim(), mode: "insensitive" } },
                { title: { contains: itemQuery.trim(), mode: "insensitive" } },
                { product: { title: { contains: itemQuery.trim(), mode: "insensitive" } } },
              ],
            },
            select: { id: true },
          });
          if (match) return match;
        }

        // Fallback: pick the first available active variant in this tenant store
        return tx.productVariant.findFirst({
          where: { isActive: true, product: { deletedAt: null } },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
      });

      if (!found) {
        return NextResponse.json(
          { error: "No products exist in your store inventory yet. Please add a product first." },
          { status: 400 }
        );
      }
      variantId = found.id;
    }

    const isInsideDhaka = deliveryZone === "INSIDE_DHAKA" || address.toLowerCase().includes("dhaka");
    const city = isInsideDhaka ? "Dhaka" : "Outside Dhaka";
    const district = isInsideDhaka ? "Dhaka" : "Bangladesh";
    const division = isInsideDhaka ? "Dhaka" : "Other";

    // 2. Call createOrder in the tenant database
    const order = await createOrder(session.tenantId, {
      idempotencyKey: randomUUID(),
      customer: {
        name: name.trim(),
        phone: cleanPhone,
      },
      shipping: {
        address: address.trim(),
        city,
        district,
        division,
      },
      items: [
        {
          variantId,
          quantity: Math.max(1, parseInt(String(quantity), 10) || 1),
        },
      ],
      paymentMethod: paymentMethod === "MANUAL_BKASH" ? "MANUAL_BKASH" : paymentMethod === "MANUAL_NAGAD" ? "MANUAL_NAGAD" : "COD",
      notes: notes || "Created via Merchant Mobile App Quick Order Desk",
      channel: "STAFF_MOBILE",
      createdByName: session.user.name,
      createdByUserId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
      },
    });
  } catch (err: any) {
    console.error("[Mobile Quick Order Error]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create quick order in database." },
      { status: 500 }
    );
  }
}
