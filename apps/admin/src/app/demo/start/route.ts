import { NextResponse, type NextRequest } from "next/server";
import { DEMO_TEMPLATE_IDS, DEMO_SESSION_HOURS, DomainError, createDemoSession, demoCreatorKey } from "@biztrackbd/core";
import { DEMO } from "@/lib/auth";
import { cookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Making a copy takes a few seconds (about forty queries). 60 seconds is the longest Vercel Hobby allows.
export const maxDuration = 60;

const back = (req: NextRequest, to: string) => NextResponse.redirect(new URL(to, req.nextUrl.origin), { status: 303 });

/** One click into a private demo admin: makes a copy of the chosen demo store, signs the visitor in to it and opens the dashboard. */
export async function GET(req: NextRequest) {
  const template = req.nextUrl.searchParams.get("template") ?? "";
  if (!DEMO_TEMPLATE_IDS.includes(template as never)) return back(req, "/demo");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    const d = await createDemoSession(template, demoCreatorKey(ip, req.headers.get("user-agent") ?? ""));
    const res = back(req, "/");
    res.cookies.set(DEMO, d.cookie, cookieOptions(DEMO_SESSION_HOURS * 3600));
    return res;
  } catch (e) {
    if (e instanceof DomainError) return back(req, `/demo?msg=${encodeURIComponent(e.message)}`);
    console.error("demo start failed", e instanceof Error ? `${e.name}: ${e.message}` : "unknown");
    return back(req, `/demo?msg=${encodeURIComponent("Something went wrong starting the demo. Please try again.")}`);
  }
}
