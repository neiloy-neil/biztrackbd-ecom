import { NextResponse } from "next/server";
import { refreshSession, getMerchantBusinesses, AuthFailure, PERMISSIONS } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const refreshToken = String(body.refreshToken ?? "").trim();

    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token is required." }, { status: 400 });
    }

    const tokens = await refreshSession(refreshToken);
    const authUser = { id: tokens.userId, email: tokens.email, emailConfirmed: true };
    const stores = await getMerchantBusinesses(authUser);
    const activeStores = stores.filter((s) => s.isActive);

    if (activeStores.length === 0) {
      return NextResponse.json(
        { error: "No active merchant stores found for this account." },
        { status: 403 }
      );
    }

    const primaryStore = activeStores[0]!;
    const permissions = PERMISSIONS[primaryStore.role] || {};

    return NextResponse.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      user: {
        id: primaryStore.userId,
        name: primaryStore.name,
        email: tokens.email,
        role: primaryStore.role,
      },
      activeStore: {
        tenantId: primaryStore.tenantId,
        subdomain: primaryStore.subdomain,
        name: primaryStore.storeName,
        role: primaryStore.role,
      },
      permissions,
      stores,
    });
  } catch (err: any) {
    console.error("[Mobile Token Refresh Error]", err);
    if (err instanceof AuthFailure) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to refresh session." },
      { status: 401 }
    );
  }
}
