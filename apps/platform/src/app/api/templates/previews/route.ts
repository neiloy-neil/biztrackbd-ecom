import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { DomainError, setTemplatePreviews } from "@biztrackbd/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorised(req: NextRequest): boolean {
  const secret = process.env.TEMPLATE_PREVIEW_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * The preview worker reports the pictures it made: { templateId, desktop, mobile } with addresses in the template-previews storage.
 * Authenticated with `Authorization: Bearer $TEMPLATE_PREVIEW_SECRET`.
 */
export async function POST(req: NextRequest) {
  if (!process.env.TEMPLATE_PREVIEW_SECRET) return NextResponse.json({ ok: false, error: "TEMPLATE_PREVIEW_SECRET is not set" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { templateId?: unknown; desktop?: unknown; mobile?: unknown } | null;
  if (!body || typeof body.templateId !== "string") return NextResponse.json({ ok: false, error: "templateId is required" }, { status: 400 });
  try {
    await setTemplatePreviews(body.templateId, {
      desktop: typeof body.desktop === "string" ? body.desktop : undefined,
      mobile: typeof body.mobile === "string" ? body.mobile : undefined,
    });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ ok: false, error: e.message }, { status: e.httpStatus });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
