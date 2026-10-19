import { type NextRequest } from "next/server";
import { guardApiRequest, apiJsonResponse, apiProblemResponse } from "../../_lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/products/[id]
 * Scope required: products:read
 * Lookup by product ID or slug
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await guardApiRequest(req, "products:read");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const decodedId = decodeURIComponent(id).trim();

  const product = (await guard.prisma.product.findFirst({
    where: {
      OR: [{ id: decodedId }, { slug: decodedId }],
    },
    include: {
      variants: {
        orderBy: { createdAt: "asc" },
      },
      images: {
        orderBy: { sortOrder: "asc" },
      },
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  })) as any;

  if (!product) {
    guard.logResponse(404);
    return apiProblemResponse(
      {
        type: "https://api.biztrack.bd/errors/product_not_found",
        title: "Product Not Found",
        status: 404,
        detail: `No product found matching ID or slug '${decodedId}'.`,
      },
      guard.rateLimitHeaders
    );
  }

  const formatted = {
    id: product.id,
    title: product.title,
    titleBn: product.titleBn,
    slug: product.slug,
    description: product.descriptionHtml,
    basePrice: product.basePrice.toString(),
    compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toString() : null,
    status: product.status,
    category: product.category ? { id: product.category.id, name: product.category.name, slug: product.category.slug } : null,
    images: (product.images || []).map((img: any) => ({
      id: img.id,
      url: img.url,
      altText: img.altText,
      position: img.sortOrder,
    })),
    variants: (product.variants || []).map((v: any) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      price: v.price.toString(),
      compareAtPrice: v.compareAtPrice ? v.compareAtPrice.toString() : null,
      stockQuantity: v.stockQuantity,
      isActive: v.isActive,
    })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  guard.logResponse(200);
  return apiJsonResponse({ data: formatted }, 200, guard.rateLimitHeaders);
}
