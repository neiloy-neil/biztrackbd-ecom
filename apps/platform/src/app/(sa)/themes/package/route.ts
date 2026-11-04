import type { NextRequest } from "next/server";
import { DomainError, MAX_TEMPLATE_ZIP_BYTES, TEMPLATE_MEDIA_OWNER, canPlatform, importTemplatePackage } from "@biztrackbd/core";
import { removeImage, saveImage } from "@biztrackbd/media";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const back = (params: Record<string, string>) =>
  new Response(null, { status: 303, headers: { Location: `/themes?${new URLSearchParams(params)}`, "Cache-Control": "no-store" } });

/**
 * Uploads a theme package (.zip with theme.json and pictures). This is a route and not a server action because a package can be several
 * megabytes, more than a server action accepts. Because a route has no built-in cross-site check, the request must come from this site.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let sameSite = false;
  try { sameSite = Boolean(origin && host && new URL(origin).host === host); } catch { sameSite = false; }
  if (!sameSite) return new Response("Not allowed", { status: 403 });

  const s = await getSession();
  if (!canPlatform(s.user.role, "plans", "edit")) return new Response("Not allowed", { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_TEMPLATE_ZIP_BYTES + 64 * 1024) return back({ err: "The zip is too large (4 MB at most)." });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return back({ err: "Choose a .zip theme package to upload." });
  if (file.size > MAX_TEMPLATE_ZIP_BYTES) return back({ err: "The zip is too large (4 MB at most)." });
  const publish = form?.get("draft") !== "on";
  try {
    const r = await importTemplatePackage(s.actor, Buffer.from(await file.arrayBuffer()), { publish }, {
      save: async (bytes) => (await saveImage(TEMPLATE_MEDIA_OWNER, bytes)).url,
      discard: async (url) => { await removeImage(TEMPLATE_MEDIA_OWNER, url); },
    });
    const extra = `${r.pictures} picture${r.pictures === 1 ? "" : "s"} stored${r.unused.length ? `; not used by theme.json and left out: ${r.unused.join(", ")}` : ""}.`;
    return back({ done: `${r.created ? "Added" : "Updated"} ${r.template.id} (v${r.template.version}), ${extra} ${publish ? "It is live." : "Saved as a draft. Press Publish to show it."}` });
  } catch (e) {
    if (e instanceof DomainError) return back({ err: e.message });
    // The media layer's own messages are written for people too.
    if (e instanceof Error && e.name === "MediaError") return back({ err: `A picture in the package could not be used: ${e.message}` });
    console.error("theme package upload failed", e);
    return back({ err: "The package could not be saved. Please try again." });
  }
}
