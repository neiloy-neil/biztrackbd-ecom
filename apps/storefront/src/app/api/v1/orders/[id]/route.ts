import { type NextRequest } from "next/server";
import { guardApiRequest, apiJsonResponse, apiProblemResponse } from "../../_lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/orders/[id]
 * Scope required: orders:read
 * Lookup by order ID or orderNumber
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await guardApiRequest(req, "orders:read");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const decodedId = decodeURIComponent(id).trim();

  const order = (await guard.prisma.order.findFirst({
    where: {
      OR: [{ id: decodedId }, { orderNumber: decodedId }],
    },
    include: {
      customer: true,
      items: {
        include: {
          product: { select: { title: true, slug: true } },
          variant: { select: { title: true, sku: true } },
        },
      },
    },
  })) as any;

  if (!order) {
    guard.logResponse(404);
    return apiProblemResponse(
      {
        type: "https://api.biztrack.bd/errors/order_not_found",
        title: "Order Not Found",
        status: 404,
        detail: `No order found matching ID or number '${decodedId}'.`,
      },
      guard.rateLimitHeaders
    );
  }

  const formatted = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    subtotalAmount: order.subtotalAmount.toString(),
    deliveryCharge: order.deliveryCharge.toString(),
    discountAmount: order.discountAmount.toString(),
    totalAmount: order.totalAmount.toString(),
    notes: order.notes,
    customer: order.customer
      ? {
          id: order.customer.id,
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email,
          address: order.shippingAddress,
          district: order.shippingDistrict,
          division: order.shippingDivision,
        }
      : null,
    items: (order.items || []).map((item: any) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productTitle: item.productTitle || item.product?.title,
      variantTitle: item.variantTitle || item.variant?.title || null,
      sku: item.sku || item.variant?.sku || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };

  guard.logResponse(200);
  return apiJsonResponse({ data: formatted }, 200, guard.rateLimitHeaders);
}
