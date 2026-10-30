import { NextResponse } from "next/server";
import { signInWithPassword, getMerchantBusinesses, AuthFailure, PERMISSIONS } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { authMode } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // Development bypass
    if (authMode() === "dev") {
      const devSub = process.env.DEV_TENANT_SUBDOMAIN || "rongdhonu";
      const t = await withTenant("system", async (tx) => {
        return tx.tenant.findFirst({
          where: { subdomain: devSub },
          select: { id: true, name: true, subdomain: true, status: true, siteMode: true, businessVertical: true, customDomain: true },
        });
      });

      if (!t) {
        return NextResponse.json({ error: "Demo store not found." }, { status: 404 });
      }

      const user = await withTenant(t.id, async (tx) => {
        return (
          (await tx.tenantUser.findFirst({ where: { email, isActive: true } })) ??
          (await tx.tenantUser.findFirst({ where: { role: "STORE_OWNER", isActive: true } })) ??
          (await tx.tenantUser.findFirst({ where: { isActive: true } }))
        );
      });

      if (!user) {
        return NextResponse.json({ error: "No active staff found for demo login." }, { status: 404 });
      }

      const mockToken = "dev-token";
      const mockBusiness = {
        userId: user.id,
        tenantId: t.id,
        subdomain: t.subdomain,
        storeName: t.name,
        role: user.role,
        name: user.name,
        isActive: true,
        tenantStatus: t.status,
        siteMode: t.siteMode,
        businessVertical: t.businessVertical,
        customDomain: t.customDomain,
        isCurrent: true,
      };

      return NextResponse.json({
        accessToken: mockToken,
        refreshToken: "dev-refresh-token",
        expiresAt: Math.floor(Date.now() / 1000) + 86400 * 30,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        activeStore: {
          tenantId: t.id,
          subdomain: t.subdomain,
          name: t.name,
          role: user.role,
        },
        permissions: PERMISSIONS[user.role],
        stores: [mockBusiness],
      });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    // Production Supabase password authentication
    const tokens = await signInWithPassword(email, password);
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
  } catch (err) {
    if (err instanceof AuthFailure) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[Mobile Login Error]", err);
    return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}
