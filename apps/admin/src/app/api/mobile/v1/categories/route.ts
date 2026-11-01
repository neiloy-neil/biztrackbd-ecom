import { NextResponse, type NextRequest } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { saveCategory, DomainError, can } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const categories = await withTenant(session.tenantId, (tx) =>
      tx.category.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          imageUrl: true,
        },
      })
    );

    return NextResponse.json({ categories });
  } catch (err) {
    console.error("[Mobile Categories GET Error]", err);
    return NextResponse.json({ error: "Failed to fetch categories." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  if (!can(session.user.role, "products", "edit")) {
    return NextResponse.json({ error: "You do not have access to create categories." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const parentId = body.parentId || null;

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Category name must be at least 2 characters." }, { status: 400 });
    }

    const created = await saveCategory(session.tenantId, session.actor, {
      name,
      parentId,
    });

    return NextResponse.json({
      ok: true,
      category: {
        id: created.id,
        name,
        parentId,
      },
    });
  } catch (e) {
    if (e instanceof DomainError) {
      return NextResponse.json({ error: e.message }, { status: e.httpStatus || 400 });
    }
    console.error("[Mobile Categories POST Error]", e);
    return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
  }
}
