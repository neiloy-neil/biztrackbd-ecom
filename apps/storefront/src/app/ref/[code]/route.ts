import { NextResponse, type NextRequest } from "next/server";
import { getReferralOffer, getAffiliatePartnerByCode } from "@biztrackbd/core";
import { findStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** 
 * Handles referral links:
 * 1. Customer loyalty referral: /ref/REF-ANISA-K7Q -> sets bt_ref cookie
 * 2. Influencer / Affiliate partner referral: /ref/tanvir -> sets bt_aff_ref cookie (30 days)
 * Redirects to target path in `?to=` query (e.g. `?to=/l/gadget`), defaulting to "/"
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const targetUrl = req.nextUrl.searchParams.get("to") || req.nextUrl.searchParams.get("redirect") || "/";
  const safeTarget = targetUrl.startsWith("/") && !targetUrl.startsWith("//") ? targetUrl : "/";

  const res = new NextResponse(null, { status: 307, headers: { Location: safeTarget } });
  const store = await findStore();
  if (!store) return res;

  // 1. Check affiliate partner link
  const aff = await getAffiliatePartnerByCode(store.id, code);
  if (aff) {
    res.cookies.set("bt_aff_ref", aff.code, {
      path: "/",
      maxAge: 30 * 86_400,
      sameSite: "lax",
      httpOnly: false,
      secure: req.nextUrl.protocol === "https:",
    });
    return res;
  }

  // 2. Fallback to customer referral offer
  const offer = await getReferralOffer(store.id, code);
  if (offer) {
    res.cookies.set("bt_ref", offer.code, {
      path: "/",
      maxAge: 30 * 86_400,
      sameSite: "lax",
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
    });
  }

  return res;
}
