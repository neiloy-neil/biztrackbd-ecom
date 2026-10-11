import { MediaError, readImage } from "@biztrackbd/media";

export const dynamic = "force-dynamic";

/**
 * Serves store photos uploaded from the admin (development and self-hosting; production uses Supabase Storage).
 * File names are random UUIDs, the shape is checked strictly, and the content type is fixed, so this cannot read
 * other files or serve anything but WebP.
 */
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
