import { NextResponse } from "next/server";
import { signInWithPassword, platformMemberFor, recordPlatformLogin, AuthFailure } from "@biztrackbd/core";
import { getPlatformPrisma } from "@biztrackbd/db";
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
      const db = getPlatformPrisma();
      const user =
        (await db.platformUser.findFirst({ where: { email, isActive: true } })) ??
        (await db.platformUser.findFirst({ where: { role: "OWNER", isActive: true } })) ??
        (await db.platformUser.findFirst({ where: { isActive: true } }));

      if (!user) {
        return NextResponse.json({ error: "No active platform user found for demo mode." }, { status: 404 });
      }

      return NextResponse.json({
        accessToken: "dev-token",
        refreshToken: "dev-refresh-token",
        expiresAt: Math.floor(Date.now() / 1000) + 86400 * 30,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    // Production authentication via Supabase
    const tokens = await signInWithPassword(email, password);
    const authUser = { id: tokens.userId, email: tokens.email, emailConfirmed: true };
    const member = await platformMemberFor(authUser);

    if (!member || !member.isActive) {
      return NextResponse.json(
        { error: "Access denied. Account is not an authorized BizTrack platform administrator." },
        { status: 403 }
      );
    }

    await recordPlatformLogin(member.id);

    return NextResponse.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + 86400 * 7,
      user: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
      },
    });
  } catch (err: any) {
    if (err instanceof AuthFailure) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("Platform mobile login error:", err);
    return NextResponse.json(
      { error: err?.message || "Platform sign-in failed. Please verify credentials." },
      { status: 500 }
    );
  }
}
