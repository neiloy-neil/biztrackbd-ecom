import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyOnboardingPassTicket } from "@biztrackbd/core";
import { DEV_TENANT_COOKIE } from "@/lib/session";
import { DEMO, DEMO_PREV, TENANT } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ticket = req.nextUrl.searchParams.get("ticket");
  if (!ticket) {
    return NextResponse.redirect(new URL("/login?err=session", req.nextUrl.origin));
  }

  const payload = verifyOnboardingPassTicket(ticket);
  if (!payload) {
    return NextResponse.redirect(new URL("/login?err=session", req.nextUrl.origin));
  }

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const cookieOpts = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 86400, // 30 days
  };

  // Set the tenant cookies so the admin session immediately activates for this store
  jar.set(TENANT, payload.tenantId, cookieOpts);
  jar.delete(DEMO);
  jar.delete(DEMO_PREV);
  jar.set(DEV_TENANT_COOKIE, payload.subdomain, cookieOpts);

  return NextResponse.redirect(new URL("/?welcome=1", req.nextUrl.origin));
}
