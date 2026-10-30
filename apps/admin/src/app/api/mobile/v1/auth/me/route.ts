import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { PERMISSIONS } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const permissions = PERMISSIONS[session.user.role] || {};

  return NextResponse.json({
    user: session.user,
    activeStore: {
      tenantId: session.tenantId,
      subdomain: session.tenantSubdomain,
      name: session.storeName,
      role: session.user.role,
      accessState: session.access.state,
    },
    permissions,
    stores: session.stores,
  });
}
