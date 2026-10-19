import { type NextRequest } from "next/server";
import { getBasePrisma, Prisma } from "@biztrackbd/db";
import {
  normalizeBdPhone,
  checkIdempotency,
  recordIdempotency,
} from "@biztrackbd/core";
import {
  guardApiRequest,
  apiJsonResponse,
  apiProblemResponse,
} from "../_lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/orders
 * Scope required: orders:read
 * Parameters: page, limit, status, paymentStatus, phone
 */
export async function GET(req: NextRequest) {
  const guard = await guardApiRequest(req, "orders:read");
  if (!guard.ok) return guard.response;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const statusParam = searchParams.get("status")?.toUpperCase();
  const paymentStatusParam = searchParams.get("paymentStatus")?.toUpperCase();
  const phone = searchParams.get("phone")?.trim();

  const where: any = {};
  if (statusParam) where.status = statusParam;
  if (paymentStatusParam) where.paymentStatus = paymentStatusParam;
  if (phone) {
    where.customer = { phone: { contains: phone } };
  }

  const [total, orders] = await Promise.all([
    guard.prisma.order.count({ where }),
    guard.prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        items: {
          include: {
            product: { select: { title: true, slug: true } },
            variant: { select: { title: true, sku: true } },
          },
        },
      },
    }),
  ]);

  const formatted = (orders as any[]).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    subtotalAmount: o.subtotalAmount.toString(),
    deliveryCharge: o.deliveryCharge.toString(),
    discountAmount: o.discountAmount.toString(),
    totalAmount: o.totalAmount.toString(),
    notes: o.notes,
    customer: o.customer
      ? {
          id: o.customer.id,
          name: o.customer.name,
          phone: o.customer.phone,
          email: o.customer.email,
          address: o.shippingAddress,
          district: o.shippingDistrict,
          division: o.shippingDivision,
        }
      : null,
    items: (o.items || []).map((item: any) => ({
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
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }));

  const totalPages = Math.ceil(total / limit) || 1;
  guard.logResponse(200);

  return apiJsonResponse(
    {
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
    200,
    guard.rateLimitHeaders
  );
}

interface OrderItemInput {
  variantId: string;
  quantity: number;
}

/**
 * POST /api/v1/orders
 * Scope required: orders:write
 * Headers: X-Idempotency-Key (optional, UUID v4)
 * Body: {
 *   customer: { name, phone, address, district, division? },
 *   items: [{ variantId, quantity }],
 *   paymentMethod?: "COD" | "GATEWAY_BKASH" | "GATEWAY_SSLCOMMERZ",
 *   couponCode?: string,
 *   notes?: string
 * }
 */
export async function POST(req: NextRequest) {
  const guard = await guardApiRequest(req, "orders:write");
  if (!guard.ok) return guard.response;

  const idempotencyKey = req.headers.get("x-idempotency-key");
  const endpoint = req.nextUrl.pathname;

  // 1. Idempotency Check
  if (idempotencyKey) {
    const cached = await checkIdempotency(
      getBasePrisma(),
      guard.context.tenantId,
      idempotencyKey,
      endpoint
    );
    if (cached.cached) {
      guard.logResponse(cached.statusCode || 200);
      return apiJsonResponse(
        cached.body,
        cached.statusCode || 200,
        {
          ...guard.rateLimitHeaders,
          "X-Cache": "HIT-IDEMPOTENT",
        }
      );
    }
  }

  // 2. Parse & Validate Payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    guard.logResponse(400);
    return apiProblemResponse(
      {
        type: "https://api.biztrack.bd/errors/invalid_json",
        title: "Invalid JSON Body",
        status: 400,
        detail: "Request body could not be parsed as valid JSON.",
      },
      guard.rateLimitHeaders
    );
  }

  const invalidParams: Array<{ name: string; reason: string }> = [];

  if (!body.customer || typeof body.customer !== "object") {
    invalidParams.push({ name: "customer", reason: "Field 'customer' is required and must be an object." });
  }

  const customerInput = body.customer || {};
  if (!customerInput.name || typeof customerInput.name !== "string" || !customerInput.name.trim()) {
    invalidParams.push({ name: "customer.name", reason: "Customer name is required." });
  }

  let normalizedPhone = "";
  try {
    normalizedPhone = normalizeBdPhone(customerInput.phone || "");
  } catch {
    invalidParams.push({
      name: "customer.phone",
      reason: "Field 'customer.phone' must be a valid 11-digit Bangladesh mobile number starting with 01.",
    });
  }

  if (!customerInput.address || typeof customerInput.address !== "string" || !customerInput.address.trim()) {
    invalidParams.push({ name: "customer.address", reason: "Customer delivery address is required." });
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    invalidParams.push({ name: "items", reason: "Field 'items' must be a non-empty array." });
  }

  if (invalidParams.length > 0) {
    guard.logResponse(422);
    return apiProblemResponse(
      {
        type: "https://api.biztrack.bd/errors/invalid_parameters",
        title: "Invalid Request Parameters",
        status: 422,
        detail: "Validation failed for one or more request fields.",
        invalidParams,
      },
      guard.rateLimitHeaders
    );
  }

  const itemsInput: OrderItemInput[] = body.items;

  // 3. Resolve Variants & Calculate Pricing
  const variantIds = itemsInput.map((it) => it.variantId).filter(Boolean);
  const variants = await guard.prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: {
      product: { select: { id: true, title: true, status: true } },
    },
  });

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  for (let i = 0; i < itemsInput.length; i++) {
    const it = itemsInput[i]!;
    const found = variantMap.get(it.variantId);
    if (!found) {
      invalidParams.push({
        name: `items[${i}].variantId`,
        reason: `Product variant with ID '${it.variantId}' does not exist.`,
      });
    } else if (!it.quantity || it.quantity < 1 || !Number.isInteger(it.quantity)) {
      invalidParams.push({
        name: `items[${i}].quantity`,
        reason: "Quantity must be an integer greater than or equal to 1.",
      });
    }
  }

  if (invalidParams.length > 0) {
    guard.logResponse(422);
    return apiProblemResponse(
      {
        type: "https://api.biztrack.bd/errors/invalid_parameters",
        title: "Invalid Items",
        status: 422,
        detail: "One or more order items are invalid.",
        invalidParams,
      },
      guard.rateLimitHeaders
    );
  }

  let subtotalAmount = new Prisma.Decimal(0);
  const orderLinesToCreate: Array<{
    tenantId: string;
    productId: string;
    variantId: string;
    productTitle: string;
    variantTitle: string | null;
    sku: string | null;
    quantity: number;
    unitPrice: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
  }> = [];

  for (const it of itemsInput) {
    const v = variantMap.get(it.variantId)!;
    const unitPrice = v.price;
    const lineTotal = unitPrice.mul(it.quantity);
    subtotalAmount = subtotalAmount.add(lineTotal);

    orderLinesToCreate.push({
      tenantId: guard.context.tenantId,
      productId: v.product.id,
      variantId: v.id,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku,
      quantity: it.quantity,
      unitPrice,
      totalPrice: lineTotal,
    });
  }

  // Delivery zone & charge calculation
  const district = (customerInput.district || "Dhaka").trim();
  const division = (customerInput.division || "Dhaka").trim();
  const isDhaka = district.toLowerCase() === "dhaka";
  const deliveryZone = isDhaka ? "INSIDE_DHAKA" : "OUTSIDE_DHAKA";
  const deliveryCharge = new Prisma.Decimal(isDhaka ? 70 : 130);

  // Optional coupon calculation
  let discountAmount = new Prisma.Decimal(0);
  let couponId: string | null = null;
  const couponCode = (body.couponCode || "").trim().toUpperCase();

  if (couponCode) {
    const coupon = await guard.prisma.coupon.findFirst({
      where: {
        code: couponCode,
        isActive: true,
      },
    });

    if (coupon) {
      couponId = coupon.id;
      if (coupon.type === "PERCENTAGE") {
        discountAmount = subtotalAmount.mul(coupon.value).div(100);
      } else {
        discountAmount = Prisma.Decimal.min(subtotalAmount, coupon.value);
      }
    }
  }

  const totalAmount = subtotalAmount.add(deliveryCharge).sub(discountAmount);

  // 4. Sandbox Test Key Handling
  const isTest = guard.context.environment === "TEST";
  let notes = body.notes || "";
  if (isTest) {
    notes = `[TEST API ORDER] ${notes}`.trim();
  }

  // 5. Customer find-or-create
  let customer = await guard.prisma.customer.findFirst({
    where: { phone: normalizedPhone },
  });

  if (!customer) {
    customer = await guard.prisma.customer.create({
      data: {
        tenantId: guard.context.tenantId,
        name: customerInput.name.trim(),
        phone: normalizedPhone,
      },
    });
  }

  // 6. Generate Order Number
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `ORD-${Date.now().toString().slice(-5)}${randomSuffix}`;

  // 7. Create Order & OrderItems in Database
  const createdOrder = (await guard.prisma.order.create({
    data: {
      tenantId: guard.context.tenantId,
      orderNumber,
      idempotencyKey: idempotencyKey || null,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      shippingAddress: customerInput.address.trim(),
      shippingCity: district,
      shippingDistrict: district,
      shippingDivision: division,
      deliveryZone,
      status: "PENDING",
      paymentStatus: "UNPAID",
      paymentMethod: body.paymentMethod === "GATEWAY_BKASH" ? "GATEWAY_BKASH" : "COD",
      subtotalAmount,
      deliveryCharge,
      discountAmount,
      totalAmount,
      notes,
      channel: isTest ? "API_TEST" : "PUBLIC_REST_API",
      items: {
        create: orderLinesToCreate,
      },
    },
    include: {
      items: {
        include: {
          product: { select: { title: true } },
          variant: { select: { title: true, sku: true } },
        },
      },
    },
  })) as any;

  // 8. Decrement Stock only if LIVE key
  if (!isTest) {
    for (const item of itemsInput) {
      await guard.prisma.productVariant
        .update({
          where: { id: item.variantId },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        })
        .catch(() => {});
    }
  }

  const responsePayload = {
    id: createdOrder.id,
    orderNumber: createdOrder.orderNumber,
    status: createdOrder.status,
    paymentStatus: createdOrder.paymentStatus,
    paymentMethod: createdOrder.paymentMethod,
    subtotalAmount: createdOrder.subtotalAmount.toString(),
    deliveryCharge: createdOrder.deliveryCharge.toString(),
    discountAmount: createdOrder.discountAmount.toString(),
    totalAmount: createdOrder.totalAmount.toString(),
    environment: guard.context.environment,
    notes: createdOrder.notes,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: createdOrder.shippingAddress,
      district: createdOrder.shippingDistrict,
      division: createdOrder.shippingDivision,
    },
    items: (createdOrder.items || []).map((it: any) => ({
      id: it.id,
      productId: it.productId,
      variantId: it.variantId,
      productTitle: it.productTitle || it.product?.title,
      variantTitle: it.variantTitle || it.variant?.title || null,
      sku: it.sku || it.variant?.sku || null,
      quantity: it.quantity,
      unitPrice: it.unitPrice.toString(),
      totalPrice: it.totalPrice.toString(),
    })),
    createdAt: createdOrder.createdAt,
  };

  // 9. Store Idempotency Record
  if (idempotencyKey) {
    await recordIdempotency(
      getBasePrisma(),
      guard.context.tenantId,
      idempotencyKey,
      endpoint,
      201,
      responsePayload
    );
  }

  guard.logResponse(201);
  return apiJsonResponse(responsePayload, 201, guard.rateLimitHeaders);
}
