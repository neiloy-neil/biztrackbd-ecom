import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeMetaOAuthCode,
  fetchMetaPixels,
  saveTrackingConfig,
  can,
} from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/marketing/pixels?err=${encodeURIComponent(error)}`, req.url));
  }

  const jar = await cookies();
  const savedState = jar.get("meta_oauth_state")?.value;
  jar.delete("meta_oauth_state");

  if (!state || state !== savedState || !code) {
    return NextResponse.redirect(new URL("/marketing/pixels?err=Invalid+or+expired+Facebook+authorization+session", req.url));
  }

  try {
    const s = await requireAccess("marketing");
    if (!can(s.user.role, "marketing", "edit")) {
      return NextResponse.redirect(new URL("/marketing/pixels?err=Unauthorized", req.url));
    }

    const clientId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL("/marketing/pixels?err=Meta+App+credentials+missing+on+server.+Use+manual+token+entry.", req.url),
      );
    }

    const redirectUri = `${url.origin}/api/auth/facebook/callback`;
    const { accessToken } = await exchangeMetaOAuthCode(clientId, clientSecret, redirectUri, code);

    const pixels = await fetchMetaPixels(accessToken);

    const [selected] = pixels;
    if (selected) {
      await saveTrackingConfig(s.tenantId, s.actor, {
        pixelId: selected.pixelId,
      });
    }

    return NextResponse.redirect(new URL("/marketing/pixels?done=fb_connected", req.url));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to connect Meta account";
    return NextResponse.redirect(new URL(`/marketing/pixels?err=${encodeURIComponent(msg)}`, req.url));
  }
}
