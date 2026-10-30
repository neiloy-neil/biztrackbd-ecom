import { NextResponse } from "next/server";
import { refreshSession, platformMemberFor, AuthFailure } from "@biztrackbd/core";

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
    const member = await platformMemberFor(authUser);

    if (!member || !member.isActive) {
      return NextResponse.json(
        { error: "Access denied: Account is not an active platform administrator." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      user: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
      },
    });
  } catch (err: any) {
    console.error("Platform mobile token refresh error:", err);
    if (err instanceof AuthFailure) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to refresh platform session." },
      { status: 401 }
    );
  }
}
