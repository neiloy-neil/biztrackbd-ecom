import { NextResponse, type NextRequest } from "next/server";
import { DomainError, PlanLimitError, can, claimStorage } from "@biztrackbd/core";
import { MediaError, MAX_UPLOAD_BYTES, saveImage } from "@biztrackbd/media";
import { getMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  if (!can(session.user.role, "products", "edit") && !can(session.user.role, "design", "edit")) {
    return NextResponse.json({ error: "You do not have access to upload media." }, { status: 403 });
  }

  if (session.access.state === "READ_ONLY" || session.access.state === "LOCKED") {
    return NextResponse.json({ error: "Your store is read-only until your plan is paid." }, { status: 403 });
  }

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "That photo is too large. Use an image under 8 MB." }, { status: 413 });
  }

  let file: FormDataEntryValue | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("file");
  } catch (err) {
    console.error("[Mobile Media Upload] Failed to parse formData", err);
    return NextResponse.json({ error: "Could not read uploaded image data." }, { status: 400 });
  }

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Please provide a valid image file." }, { status: 400 });
  }

  try {
    const blob = file as unknown as Blob;
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const img = await saveImage(session.tenantId, buffer);
    await claimStorage(session.tenantId, img.bytes);

    return NextResponse.json({
      url: img.url,
      width: img.width,
      height: img.height,
      bytes: img.bytes,
    });
  } catch (e) {
    if (e instanceof MediaError) {
      return NextResponse.json({ error: e.message }, { status: e.code === "TOO_LARGE" ? 413 : 422 });
    }
    if (e instanceof PlanLimitError) {
      return NextResponse.json(
        { error: "You have used all the photo storage on your plan. Upgrade your plan to add more." },
        { status: 403 }
      );
    }
    if (e instanceof DomainError) {
      return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    }
    console.error("[Mobile Media Upload] Error:", e);
    return NextResponse.json({ error: "Could not save the photo." }, { status: 500 });
  }
}
