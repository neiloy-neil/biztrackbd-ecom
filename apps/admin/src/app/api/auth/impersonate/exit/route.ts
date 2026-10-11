import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyImpersonationSessionCookie } from "@biztrackbd/core";
import { IMPERSONATION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

async function handleExit(req: NextRequest) {
  const jar = await cookies();
  const current = jar.get(IMPERSONATION_COOKIE)?.value;
  const verified = current ? verifyImpersonationSessionCookie(current) : null;
  jar.delete(IMPERSONATION_COOKIE);

  const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || "http://localhost:3002";
  const target = verified ? `${platformUrl}/tenants/${verified.tenantId}` : `${platformUrl}/tenants`;
  return NextResponse.redirect(target);
}

export async function POST(req: NextRequest) {
  return handleExit(req);
}

export async function GET(req: NextRequest) {
  return handleExit(req);
}
