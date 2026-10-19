import { type NextRequest } from "next/server";
import { getBasePrisma } from "@biztrackbd/db";
import { checkIdempotency, recordIdempotency } from "@biztrackbd/core";
import {
  guardApiRequest,
  apiJsonResponse,
  apiProblemResponse,
} from "../../_lib/api-guard";

export const dynamic = "force-dynamic";

interface AdjustmentItem {
  variantId?: string;
  sku?: string;
  newQuantity: number;
  reason?: string;
}

/**
 * PATCH /api/v1/inventory/adjust
 * Scope required: inventory:update
 * Headers: X-Idempotency-Key (optional, UUID v4)
 * Body: { adjustments: [ { variantId?: string, sku?: string, newQuantity: number, reason?: string } ] }
 */
export async function PATCH(req: NextRequest) {
  const guard = await guardApiRequest(req, "inventory:update");
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

  if (!body || !Array.isArray(body.adjustments) || body.adjustments.length === 0) {
    guard.logResponse(422);
    return apiProblemResponse(
      {
        type: "https://api.biztrack.bd/errors/invalid_parameters",
        title: "Invalid Adjustments Array",
        status: 422,
        detail: "Field 'adjustments' must be a non-empty array of variant adjustments.",
        invalidParams: [{ name: "adjustments", reason: "Must be a non-empty array" }],
      },
      guard.rateLimitHeaders
    );
  }

  const adjustments: AdjustmentItem[] = body.adjustments;
  const results: Array<{
    variantId: string;
    sku: string | null;
    oldQuantity: number;
    newQuantity: number;
    productTitle: string;
  }> = [];

  const invalidParams: Array<{ name: string; reason: string }> = [];

  for (let i = 0; i < adjustments.length; i++) {
    const adj = adjustments[i]!;
    if (!adj.variantId && !adj.sku) {
      invalidParams.push({
        name: `adjustments[${i}]`,
        reason: "Either 'variantId' or 'sku' must be provided.",
      });
      continue;
    }
    if (typeof adj.newQuantity !== "number" || adj.newQuantity < 0 || !Number.isInteger(adj.newQuantity)) {
      invalidParams.push({
        name: `adjustments[${i}].newQuantity`,
        reason: "Must be a non-negative integer.",
      });
    }
  }

  if (invalidParams.length > 0) {
    guard.logResponse(422);
    return apiProblemResponse(
      {
        type: "https://api.biztrack.bd/errors/invalid_parameters",
        title: "Validation Error",
        status: 422,
        detail: "One or more adjustments contain invalid parameters.",
        invalidParams,
      },
      guard.rateLimitHeaders
    );
  }

  // 3. Process Adjustments
  for (const adj of adjustments) {
    const variant = await guard.prisma.productVariant.findFirst({
      where: {
        OR: [
          ...(adj.variantId ? [{ id: adj.variantId }] : []),
          ...(adj.sku ? [{ sku: adj.sku }] : []),
        ],
      },
      include: {
        product: { select: { title: true } },
      },
    });

    if (!variant) {
      continue;
    }

    const oldQuantity = variant.stockQuantity;
    const newQuantity = adj.newQuantity;

    await guard.prisma.productVariant.update({
      where: { id: variant.id },
      data: {
        stockQuantity: newQuantity,
      },
    });

    results.push({
      variantId: variant.id,
      sku: variant.sku,
      oldQuantity,
      newQuantity,
      productTitle: variant.product.title,
    });
  }

  const responsePayload = {
    success: true,
    updatedCount: results.length,
    adjustments: results,
  };

  // 4. Save Idempotency Record
  if (idempotencyKey) {
    await recordIdempotency(
      getBasePrisma(),
      guard.context.tenantId,
      idempotencyKey,
      endpoint,
      200,
      responsePayload
    );
  }

  guard.logResponse(200);
  return apiJsonResponse(responsePayload, 200, guard.rateLimitHeaders);
}
