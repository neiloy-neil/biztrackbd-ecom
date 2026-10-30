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

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const platformUrl =
    process.env.NEXT_PUBLIC_PLATFORM_URL ||
    (root && !root.includes("localhost")
      ? `https://platform.${root}`
      : process.env.NODE_ENV === "production"
      ? "https://platform.biztrack.bd"
      : "http://localhost:3003");
  const target = verified ? `${platformUrl}/tenants/${verified.tenantId}` : `${platformUrl}/tenants`;
  return NextResponse.redirect(target);
}

export async function POST(req: NextRequest) {
  return handleExit(req);
}

export async function GET(req: NextRequest) {
  return handleExit(req);
}
