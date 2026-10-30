import { NextResponse, type NextRequest } from "next/server";
import { ForbiddenError } from "@biztrackbd/core";
import { MediaError, saveImage } from "@biztrackbd/media";
import { requireAction } from "@/lib/session";
import { BLOG_FOLDER, blogDriver } from "@/lib/blog-media";

export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/** Uploads one picture for a blog guide. Signed-in staff who can edit the blog only; the picture is re-encoded as WebP before it is stored. */
export async function POST(req: NextRequest) {
  // Cookies sign people in here, so refuse a request that another website's page sent on their behalf.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return fail("Not allowed", 403);

  try {
    await requireAction("blog", "edit");
  } catch (e) {
    if (e instanceof ForbiddenError) return fail("You cannot edit the blog", 403);
    throw e;
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Choose a picture to upload", 400);

  try {
    const saved = await saveImage(BLOG_FOLDER, Buffer.from(await file.arrayBuffer()), await blogDriver());
    return NextResponse.json({ url: saved.url, width: saved.width, height: saved.height });
  } catch (e) {
    if (e instanceof MediaError) return fail(e.message, 400);
    if (e instanceof Error && e.message.startsWith("Image storage is not set up")) return fail(e.message, 503);
    console.error("[blog-images] upload failed", e instanceof Error ? e.name : "unknown");
    return fail("The picture could not be saved. Please try again.", 500);
  }
}
