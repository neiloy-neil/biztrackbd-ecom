import { NextResponse } from "next/server";
import {
  getDownloadById,
  recordDownloadIncrement,
  createPublicLead,
} from "@biztrackbd/core";
import { findStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET /api/downloads/[id]
 * Direct download delivery or returns lead gate requirement.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const store = await findStore();
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const download = await getDownloadById(store.id, id);

    // If direct 1-click download: increment count and redirect to file
    if (download.isPublic) {
      await recordDownloadIncrement(store.id, id);
      return NextResponse.redirect(download.fileUrl, { status: 302 });
    }

    // If gated (Lead Magnet mode): indicate that contact capture is required
    return NextResponse.json({
      requiresLead: true,
      asset: {
        id: download.id,
        label: download.label,
        labelBn: download.labelBn,
        fileName: download.fileName,
        fileSize: download.fileSize,
        kind: download.kind,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Download asset not found" },
      { status: 404 }
    );
  }
}

/**
 * POST /api/downloads/[id]
 * Unlocks a gated download (Lead Magnet) by capturing visitor contact info.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const store = await findStore();
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const download = await getDownloadById(store.id, id);
    const body = await request.json().catch(() => ({}));

    // 1. Capture public lead with bot shield
    await createPublicLead(store.id, {
      name: body.name || "Download Visitor",
      phone: body.phone,
      email: body.email,
      hp: body.hp,
      elapsedMs: body.elapsedMs,
      type: "CONTACT",
      message: `Downloaded lead magnet: ${download.label} (${download.fileName})`,
      metadata: {
        downloadId: download.id,
        downloadLabel: download.label,
        fileName: download.fileName,
      },
    });

    // 2. Increment download stats
    await recordDownloadIncrement(store.id, id);

    // 3. Return secure file URL
    return NextResponse.json({
      success: true,
      downloadUrl: download.fileUrl,
      fileName: download.fileName,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process download request" },
      { status: 400 }
    );
  }
}
