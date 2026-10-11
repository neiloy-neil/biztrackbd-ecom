import { MediaError, readImage } from "@biztrackbd/media";

export const dynamic = "force-dynamic";

/** Serves stored store photos (so the admin can show what it uploaded). Only <store>/<id>.webp shapes resolve. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  try {
    const data = await readImage(path);
    if (!data) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    if (e instanceof MediaError) return new Response("Not found", { status: 404 });
    throw e;
  }
}
