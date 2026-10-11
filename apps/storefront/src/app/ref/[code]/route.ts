import { NextResponse, type NextRequest } from "next/server";
import { getReferralOffer } from "@biztrackbd/core";
import { findStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** A friend's link, /ref/REF-ANISA-K7Q. Remembers the code for 30 days (a cookie, no sign-in) and takes them to the store. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  // A relative Location, so the browser stays on the store address it used. (req.url may carry the internal host.)
  const res = new NextResponse(null, { status: 307, headers: { Location: "/" } });
  const store = await findStore();
  if (!store) return res;
  const offer = await getReferralOffer(store.id, code);
  if (offer) res.cookies.set("bt_ref", offer.code, { path: "/", maxAge: 30 * 86_400, sameSite: "lax", httpOnly: true, secure: req.nextUrl.protocol === "https:" });
  return res;
}
