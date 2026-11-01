import { NextResponse, type NextRequest } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import {
  listAdminProducts,
  saveProduct,
  DomainError,
  can,
  type ProductTab,
} from "@biztrackbd/core";
import { removeImage } from "@biztrackbd/media";
import { releaseStorage } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const tab = (searchParams.get("tab") || "all") as ProductTab;
  const categoryId = searchParams.get("categoryId") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50", 10), 100);

  try {
    const result = await listAdminProducts(session.tenantId, session.actor, {
      tab,
      q,
      categoryId,
      page: isNaN(page) ? 1 : page,
      pageSize: isNaN(pageSize) ? 50 : pageSize,
    });

    return NextResponse.json({
      items: result.rows,
      total: result.total,
      counts: result.counts,
      categories: result.categories,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  } catch (err) {
    console.error("[Mobile Products GET Error]", err);
    return NextResponse.json({ error: "Failed to fetch products." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  if (!can(session.user.role, "products", "edit")) {
    return NextResponse.json({ error: "You do not have permission to add products." }, { status: 403 });
  }

  if (session.access.state === "READ_ONLY" || session.access.state === "LOCKED") {
    return NextResponse.json({ error: "Your store is read-only until your plan is paid." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const result = await saveProduct(session.tenantId, session.actor, body);

    if (result.removedImages && result.removedImages.length > 0) {
      for (const url of result.removedImages) {
        try {
          const freed = await removeImage(session.tenantId, url);
          if (freed) await releaseStorage(session.tenantId, freed);
        } catch (e) {
          console.error("cleaning removed image failed", e);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      slug: result.slug,
    });
  } catch (e) {
    if (e instanceof DomainError) {
      return NextResponse.json(
        {
          error: e.message,
          field: typeof e.details?.field === "string" ? e.details.field : undefined,
          limit: e.code === "PLAN_LIMIT",
        },
        { status: e.httpStatus || 400 }
      );
    }
    console.error("[Mobile Products POST Error]", e);
    return NextResponse.json({ error: "Failed to create product." }, { status: 500 });
  }
}
