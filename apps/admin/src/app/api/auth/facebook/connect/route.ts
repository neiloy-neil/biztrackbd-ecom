import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildMetaOAuthUrl, can } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const s = await requireAccess("marketing");
    if (!can(s.user.role, "marketing", "edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clientId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
    if (!clientId) {
      return NextResponse.redirect(
        new URL(
          "/marketing/pixels?err=Meta+App+ID+is+not+configured+on+the+server.+Please+use+manual+token+entry+below.",
          req.url,
        ),
      );
    }

    const url = new URL(req.url);
    const redirectUri = `${url.origin}/api/auth/facebook/callback`;
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);

    const jar = await cookies();
    jar.set("meta_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
    });

    const metaUrl = buildMetaOAuthUrl(clientId, redirectUri, state);
    return NextResponse.redirect(metaUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication error";
    return NextResponse.redirect(new URL(`/marketing/pixels?err=${encodeURIComponent(msg)}`, req.url));
  }
}
