import { NextResponse, type NextRequest } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import {
  getProductForEdit,
  saveProduct,
  archiveProduct,
  DomainError,
  can,
} from "@biztrackbd/core";
import { removeImage } from "@biztrackbd/media";
import { releaseStorage } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { id } = await params;

  try {
    const product = await getProductForEdit(session.tenantId, session.actor, id);
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus || 404 });
    }
    console.error("[Mobile Product Detail GET Error]", err);
    return NextResponse.json({ error: "Product not found or unavailable." }, { status: 404 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  if (!can(session.user.role, "products", "edit")) {
    return NextResponse.json({ error: "You do not have permission to edit products." }, { status: 403 });
  }

  if (session.access.state === "READ_ONLY" || session.access.state === "LOCKED") {
    return NextResponse.json({ error: "Your store is read-only until your plan is paid." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const result = await saveProduct(session.tenantId, session.actor, body, id);

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
    console.error("[Mobile Product PUT Error]", e);
    return NextResponse.json({ error: "Failed to update product." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  if (!can(session.user.role, "products", "edit")) {
    return NextResponse.json({ error: "You do not have permission to archive products." }, { status: 403 });
  }

  const { id } = await params;

  try {
    await archiveProduct(session.tenantId, id, session.actor);
    return NextResponse.json({ ok: true, message: "Product archived successfully." });
  } catch (e) {
    if (e instanceof DomainError) {
      return NextResponse.json({ error: e.message }, { status: e.httpStatus || 400 });
    }
    console.error("[Mobile Product DELETE Error]", e);
    return NextResponse.json({ error: "Failed to archive product." }, { status: 500 });
  }
}
