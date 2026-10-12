import { NextResponse, type NextRequest } from "next/server";
import { DEMO } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Leaves the demo: forgets the cookie and goes back to the marketing site. The copy itself is deleted when its time is up. */
export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_MARKETING_URL || "https://biztrack.bd";
  const res = NextResponse.redirect(new URL(`${site}/templates`), { status: 303 });
  res.cookies.delete(DEMO);
  void req;
  return res;
}
