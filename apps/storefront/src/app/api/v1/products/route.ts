import { type NextRequest } from "next/server";
import { type Prisma } from "@biztrackbd/db";
import { guardApiRequest, apiJsonResponse } from "../_lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/products
 * Scope required: products:read
 * Parameters: page (default 1), limit (default 20, max 100), status, search
 */
export async function GET(req: NextRequest) {
  const guard = await guardApiRequest(req, "products:read");
  if (!guard.ok) return guard.response;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const statusParam = searchParams.get("status")?.toUpperCase();
  const search = searchParams.get("search")?.trim();

  const where: Prisma.ProductWhereInput = {};
  if (statusParam) {
    where.status = statusParam as any;
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { titleBn: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, products] = await Promise.all([
    guard.prisma.product.count({ where }),
    guard.prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
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
    }),
  ]);

  const formatted = (products as any[]).map((p) => ({
    id: p.id,
    title: p.title,
    titleBn: p.titleBn,
    slug: p.slug,
    description: p.descriptionHtml,
    basePrice: p.basePrice.toString(),
    compareAtPrice: p.compareAtPrice ? p.compareAtPrice.toString() : null,
    status: p.status,
    category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
    images: (p.images || []).map((img: any) => ({
      id: img.id,
      url: img.url,
      altText: img.altText,
      position: img.sortOrder,
    })),
    variants: (p.variants || []).map((v: any) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      price: v.price.toString(),
      compareAtPrice: v.compareAtPrice ? v.compareAtPrice.toString() : null,
      stockQuantity: v.stockQuantity,
      isActive: v.isActive,
    })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
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
