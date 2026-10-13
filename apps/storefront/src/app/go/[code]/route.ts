import { NextResponse, type NextRequest } from "next/server";
import { landingSlugByCode } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** The short address for ads (/go/<code>): sends the visitor to the landing page, keeping the ad's tracking tags. Unknown codes are an ordinary not-found. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const store = await getStore();
  const slug = await landingSlugByCode(store.id, code.toLowerCase());
  if (!slug) return new NextResponse("Not found", { status: 404 });
  const to = new URL(`/l/${slug}`, req.nextUrl.origin);
  req.nextUrl.searchParams.forEach((v, k) => { if (/^(utm_[a-z]+|fbclid|gclid|ttclid)$/.test(k)) to.searchParams.set(k, v.slice(0, 200)); });
  return NextResponse.redirect(to, 302);
}
