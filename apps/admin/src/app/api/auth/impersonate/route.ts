import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyImpersonationTicket, createImpersonationSessionCookie } from "@biztrackbd/core";
import { IMPERSONATION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ticket = req.nextUrl.searchParams.get("ticket");
  if (!ticket) {
    return NextResponse.json({ error: "Missing impersonation ticket" }, { status: 400 });
  }

  const payload = verifyImpersonationTicket(ticket);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired impersonation ticket" }, { status: 403 });
  }

  const cookieVal = createImpersonationSessionCookie(payload);
  const jar = await cookies();
  jar.set(IMPERSONATION_COOKIE, cookieVal, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400, // 7 days (matches Platform Admin session)
  });

  // Template Studio opens the design editor directly. Only these places may be asked for; anything else lands on orders.
  const next = req.nextUrl.searchParams.get("next");
  return NextResponse.redirect(new URL(next === "/design" ? next : "/orders", req.nextUrl.origin));
}
