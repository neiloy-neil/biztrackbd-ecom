import { NextResponse, type NextRequest } from "next/server";
import { DomainError, PlanLimitError, can, claimStorage } from "@biztrackbd/core";
import { MediaError, MAX_UPLOAD_BYTES, saveImage } from "@biztrackbd/media";
import { getSessionOrNull } from "@/lib/session";

export const dynamic = "force-dynamic";

// Per person, per process. Stops a stuck script from filling the disk; real rate limiting belongs at the edge.
const recent = new Map<string, number[]>();
const LIMIT_PER_MINUTE = 20;

function tooMany(userId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > LIMIT_PER_MINUTE;
}

/** Uploads one photo. Staff who can edit products or store design may upload. Returns { url } for the page to use. */
export async function POST(req: NextRequest) {
  // Route handlers do not get Next's built-in cross-site check that server actions have, so make it here.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const s = await getSessionOrNull();
  if (!s) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!can(s.user.role, "products", "edit") && !can(s.user.role, "design", "edit")) return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });
  if (s.access.state === "READ_ONLY" || s.access.state === "LOCKED") return NextResponse.json({ error: "Your store is read-only until the plan is paid." }, { status: 403 });
  if (tooMany(s.user.id)) return NextResponse.json({ error: "Too many uploads. Wait a minute and try again." }, { status: 429 });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return NextResponse.json({ error: "That photo is too large. Use one under 8 MB." }, { status: 413 });

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });

  try {
    const img = await saveImage(s.tenantId, Buffer.from(await file.arrayBuffer()));
    // The size actually stored (after resizing) is what counts against the plan.
    await claimStorage(s.tenantId, img.bytes);
    return NextResponse.json({ url: img.url, width: img.width, height: img.height });
  } catch (e) {
    if (e instanceof MediaError) return NextResponse.json({ error: e.message }, { status: e.code === "TOO_LARGE" ? 413 : 422 });
    if (e instanceof PlanLimitError) return NextResponse.json({ error: "You have used all the photo storage on your plan. Upgrade to add more." }, { status: 403 });
    if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    console.error("media upload failed", e instanceof Error ? e.name : "unknown");
    return NextResponse.json({ error: "Could not save the photo." }, { status: 500 });
  }
}
