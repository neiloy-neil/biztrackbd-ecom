import { NextResponse, type NextRequest } from "next/server";
import { handleAdminCopilotChat } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAccess("orders");
    const body = await req.json();

    const response = await handleAdminCopilotChat(session.tenantId, session.actor, {
      message: typeof body.message === "string" ? body.message : "",
      history: Array.isArray(body.history) ? body.history : [],
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[admin copilot route] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to execute Copilot request";
    return NextResponse.json(
      {
        reply: `দুঃখিত, সংযোগে সাময়িক সমস্যা হচ্ছে: ${msg}। অনুগ্রহ করে AI সেটিংস থেকে আপনার API কী যাচাই করুন।`,
        suggestedQuestions: ["আজকের সেলস ও অর্ডার সামারি দিন"],
        actionLinks: [{ label: "AI সেটিংস চেক করুন", href: "/settings/ai" }],
      },
      { status: 500 }
    );
  }
}
