import { NextResponse, type NextRequest } from "next/server";
import { handleStorefrontChat } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const store = await getStore();
    const body = await req.json();

    const response = await handleStorefrontChat(store.id, {
      message: typeof body.message === "string" ? body.message : "",
      history: Array.isArray(body.history) ? body.history : [],
      customerPhone: typeof body.customerPhone === "string" ? body.customerPhone : undefined,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("AI Chatbot error:", err);
    return NextResponse.json(
      {
        reply: "দুঃখিত, সংযোগে সাময়িক সমস্যা হচ্ছে। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন অথবা আমাদের হোয়াটসঅ্যাপে যোগাযোগ করুন।",
        suggestedQuestions: ["💬 সরাসরি কথা বলুন"],
      },
      { status: 500 }
    );
  }
}
